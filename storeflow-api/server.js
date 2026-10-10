'use strict';

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const PORT = 3020;
const DB_PATH = path.join(__dirname, 'storeflow.db');

// ── Base de données ──────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rayons (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS catalog (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS github_sync (
    table_name TEXT PRIMARY KEY,
    sha TEXT NOT NULL DEFAULT '',
    synced_at TEXT NOT NULL DEFAULT ''
  );
`);

// ── Helpers DB ───────────────────────────────────────────────────────────────

function getTable(table) {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = 1`).get();
  return row ? JSON.parse(row.data) : null;
}

function setTable(table, data) {
  const json = JSON.stringify(data);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ${table} (id, data, updated_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(json, now);
}

function getSyncSha(table) {
  const row = db.prepare('SELECT sha FROM github_sync WHERE table_name = ?').get(table);
  return row?.sha ?? '';
}

function setSyncSha(table, sha) {
  db.prepare(`
    INSERT INTO github_sync (table_name, sha, synced_at) VALUES (?, ?, ?)
    ON CONFLICT(table_name) DO UPDATE SET sha = excluded.sha, synced_at = excluded.synced_at
  `).run(table, sha, new Date().toISOString());
}

// ── GitHub sync ──────────────────────────────────────────────────────────────

let githubConfig = null; // { pat, dataOwner, dataRepo } — reçu du client au 1er appel

function githubHeaders(pat) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function contentUrl(owner, repo, file) {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${file}`;
}

function encodeContent(data) {
  return Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
}

function decodeContent(base64) {
  return JSON.parse(Buffer.from(base64.replace(/\n/g, ''), 'base64').toString('utf-8'));
}

async function githubFetch(file) {
  if (!githubConfig) return null;
  const { pat, dataOwner, dataRepo } = githubConfig;
  try {
    const res = await fetch(contentUrl(dataOwner, dataRepo, file), {
      headers: githubHeaders(pat),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { data: decodeContent(json.content), sha: json.sha };
  } catch {
    return null;
  }
}

async function githubPush(file, data, currentSha, message) {
  if (!githubConfig) return null;
  const { pat, dataOwner, dataRepo } = githubConfig;
  const body = {
    message: message || `chore: sync ${file} [${new Date().toISOString()}]`,
    content: encodeContent(data),
  };
  if (currentSha) body.sha = currentSha;

  try {
    const res = await fetch(contentUrl(dataOwner, dataRepo, file), {
      method: 'PUT',
      headers: githubHeaders(pat),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.content.sha;
  } catch {
    return null;
  }
}

// Importer les données depuis GitHub (1ère connexion ou fallback)
async function importFromGitHub() {
  if (!githubConfig) return;
  console.log('[sync] Import depuis GitHub…');

  const files = [
    { file: 'lists.json', table: 'lists' },
    { file: 'recipes.json', table: 'recipes' },
    { file: 'rayons.json', table: 'rayons' },
    { file: 'products.json', table: 'catalog' },
    { file: 'history.json', table: 'history' },
  ];

  for (const { file, table } of files) {
    const result = await githubFetch(file);
    if (result) {
      setTable(table, result.data);
      setSyncSha(table, result.sha);
      console.log(`[sync] ${file} importé (sha: ${result.sha.slice(0, 7)})`);
    }
  }
  console.log('[sync] Import GitHub terminé');
}

// Pousser toutes les tables vers GitHub (cron horaire)
async function syncToGitHub() {
  if (!githubConfig) return;
  console.log('[sync] Push vers GitHub…');

  const tables = [
    { table: 'lists', file: 'lists.json' },
    { table: 'recipes', file: 'recipes.json' },
    { table: 'rayons', file: 'rayons.json' },
    { table: 'catalog', file: 'products.json' },
    { table: 'history', file: 'history.json' },
  ];

  for (const { table, file } of tables) {
    const data = getTable(table);
    if (!data) continue;
    const sha = getSyncSha(table);
    const newSha = await githubPush(file, data, sha);
    if (newSha) {
      setSyncSha(table, newSha);
      console.log(`[sync] ${file} poussé (sha: ${newSha.slice(0, 7)})`);
    } else {
      console.warn(`[sync] Échec push ${file}`);
    }
  }
}

// ── WebSocket ────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// Broadcaster : notifie tous les autres clients qu'une table a changé
function broadcast(table, excludeWs = null) {
  const msg = JSON.stringify({ type: 'update', table });
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(msg);
    }
  }
}

// ── Express ──────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, clients: clients.size }));

// ── Auth / init ──────────────────────────────────────────────────────────────

// Le client envoie sa config GitHub au démarrage.
// Si la DB est vide, on importe depuis GitHub.
app.post('/init', async (req, res) => {
  const { pat, dataOwner, dataRepo } = req.body ?? {};
  if (!pat || !dataOwner || !dataRepo) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }
  githubConfig = { pat, dataOwner, dataRepo };

  // Si la DB est vide, on importe depuis GitHub AVANT de répondre
  const existing = getTable('lists');
  if (!existing) {
    await importFromGitHub();
    broadcast('all'); // notifie les clients WebSocket que les données sont dispo
  }

  res.json({ ok: true, seeded: !existing });
});

// Force re-import depuis GitHub (utile si la DB est corrompue)
app.post('/sync/pull', async (req, res) => {
  await importFromGitHub();
  broadcast('all');
  res.json({ ok: true });
});

// Force push vers GitHub
app.post('/sync/push', async (_req, res) => {
  await syncToGitHub();
  res.json({ ok: true });
});

// ── CRUD générique ───────────────────────────────────────────────────────────

function makeTableRouter(table) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    const data = getTable(table);
    if (data === null) return res.status(404).json({ error: 'Pas de données' });
    res.json(data);
  });

  router.put('/', (req, res) => {
    const data = req.body;
    if (data === undefined || data === null) {
      return res.status(400).json({ error: 'Body manquant' });
    }
    setTable(table, data);
    broadcast(table);
    res.json({ ok: true });
  });

  return router;
}

app.use('/lists', makeTableRouter('lists'));
app.use('/recipes', makeTableRouter('recipes'));
app.use('/rayons', makeTableRouter('rayons'));
app.use('/catalog', makeTableRouter('catalog'));
app.use('/history', makeTableRouter('history'));

// Ajout d'une seule recette (depuis RecipeExplorer)
app.post('/recipes/add', (req, res) => {
  const recipe = req.body;
  if (!recipe || !recipe.id || !recipe.name) {
    return res.status(400).json({ error: 'Recette invalide (id et name requis)' });
  }
  const recipes = getTable('recipes') ?? [];
  if (recipes.some(r => r.id === recipe.id)) {
    return res.status(409).json({ error: 'Doublon', id: recipe.id });
  }
  recipes.push(recipe);
  setTable('recipes', recipes);
  broadcast('recipes');
  res.json({ ok: true, id: recipe.id });
});

// PATCH atomique : toggle un seul item ou essentiel sans réécrire tout le JSON
app.patch('/lists/toggle/:id', (req, res) => {
  const { id } = req.params;
  const { type } = req.body ?? {}; // 'item' | 'essential'
  if (!id || (type !== 'item' && type !== 'essential')) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  const lists = getTable('lists');
  if (!lists) return res.status(404).json({ error: 'Pas de données' });

  let changed = false;
  if (type === 'item') {
    lists.personalList = lists.personalList.map((item) => {
      if (item.id !== id) return item;
      changed = true;
      return {
        ...item,
        checked: !item.checked,
        checkedAt: !item.checked ? new Date().toISOString() : undefined,
      };
    });
  } else {
    lists.essentials = lists.essentials.map((e) => {
      if (e.id !== id) return e;
      changed = true;
      return { ...e, checked: !e.checked };
    });
  }

  if (!changed) return res.status(404).json({ error: 'Item introuvable' });

  setTable('lists', lists);
  broadcast('lists');
  res.json({ ok: true });
});

// ── Cron : sync GitHub toutes les heures ─────────────────────────────────────

cron.schedule('0 * * * *', () => {
  syncToGitHub().catch(console.error);
});

// ── Démarrage ────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[storeflow-api] Démarré sur http://localhost:${PORT}`);
  console.log(`[storeflow-api] WebSocket prêt`);
  console.log(`[storeflow-api] DB : ${DB_PATH}`);
  console.log(`[storeflow-api] Sync GitHub : toutes les heures`);
});
