'use strict';

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// Secrets (clé Mistral) dans storeflow-proxy/.env, jamais commité
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* pas de .env */ }

const PORT = 3001;
const DB_PATH = path.join(__dirname, 'storeflow.db');
const STATIC_DIR = path.join(__dirname, '..', 'dist');

// ── Base de données SQLite ───────────────────────────────────────────────────

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
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS github_sync (
    table_name TEXT PRIMARY KEY,
    sha TEXT NOT NULL DEFAULT '',
    synced_at TEXT NOT NULL DEFAULT ''
  );
`);

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

// Réglages du serveur (config GitHub, config IA) — survivent aux redémarrages
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

function setSetting(key, value) {
  if (value === null) return db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
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

// Mémorisée : le téléphone n'a plus besoin de renvoyer le jeton à chaque ouverture
let githubConfig = getSetting('github');

// Jeton expiré ou révoqué : on l'oublie, le prochain appareil qui s'ouvre le renverra
function forgetGithubConfig() {
  console.warn('[sync] Jeton GitHub refusé (401) → config oubliée');
  githubConfig = null;
  setSetting('github', null);
}

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
    if (res.status === 401) forgetGithubConfig();
    if (!res.ok) return null;
    const json = await res.json();
    return { data: decodeContent(json.content), sha: json.sha };
  } catch {
    return null;
  }
}

async function githubPush(file, data, currentSha) {
  if (!githubConfig) return null;
  const { pat, dataOwner, dataRepo } = githubConfig;
  const body = {
    message: `chore: sync ${file} [${new Date().toISOString()}]`,
    content: encodeContent(data),
  };
  if (currentSha) body.sha = currentSha;
  try {
    const res = await fetch(contentUrl(dataOwner, dataRepo, file), {
      method: 'PUT',
      headers: githubHeaders(pat),
      body: JSON.stringify(body),
    });
    if (res.status === 401) forgetGithubConfig();
    if (!res.ok) return null;
    const json = await res.json();
    return json.content.sha;
  } catch {
    return null;
  }
}

async function importFromGitHub() {
  if (!githubConfig) return;
  console.log('[sync] Import depuis GitHub…');
  const files = [
    { file: 'lists.json',    table: 'lists'   },
    { file: 'recipes.json',  table: 'recipes' },
    { file: 'rayons.json',   table: 'rayons'  },
    { file: 'products.json', table: 'catalog' },
    { file: 'history.json',  table: 'history' },
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

// Date du dernier commit GitHub touchant ce fichier (null si inconnue)
async function githubLastCommitDate(file) {
  const { pat, dataOwner, dataRepo } = githubConfig;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${dataOwner}/${dataRepo}/commits?path=${file}&per_page=1`,
      { headers: githubHeaders(pat) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json[0]?.commit?.committer?.date ?? null;
  } catch {
    return null;
  }
}

// Synchronise une table avec GitHub.
// Si le fichier a été modifié ailleurs (app en mode secours), la version la plus récente gagne.
async function syncTable(table, file) {
  if (!githubConfig) return; // jeton refusé en cours de synchro
  const row = db.prepare(`SELECT data, updated_at FROM ${table} WHERE id = 1`).get();
  if (!row) return;
  const local = JSON.parse(row.data);
  const remote = await githubFetch(file);

  if (remote && JSON.stringify(remote.data) === JSON.stringify(local)) {
    setSyncSha(table, remote.sha); // déjà identique, rien à pousser
    return;
  }

  if (remote && remote.sha !== getSyncSha(table)) {
    const remoteDate = await githubLastCommitDate(file);
    if (remoteDate && new Date(remoteDate) > new Date(row.updated_at)) {
      setTable(table, remote.data);
      setSyncSha(table, remote.sha);
      broadcast(table);
      console.log(`[sync] ${file} modifié sur GitHub (plus récent) → importé`);
      return;
    }
  }

  const newSha = await githubPush(file, local, remote?.sha);
  if (newSha) {
    setSyncSha(table, newSha);
    console.log(`[sync] ${file} poussé (sha: ${newSha.slice(0, 7)})`);
  } else {
    console.warn(`[sync] Échec push ${file}`);
  }
}

let syncRunning = false;
let syncPending = false;

async function syncToGitHub() {
  if (!githubConfig) return;
  if (syncRunning) { syncPending = true; return; }
  syncRunning = true;
  try {
    const tables = [
      { table: 'lists',   file: 'lists.json'    },
      { table: 'recipes', file: 'recipes.json'  },
      { table: 'rayons',  file: 'rayons.json'   },
      { table: 'catalog', file: 'products.json' },
      { table: 'history', file: 'history.json'  },
    ];
    for (const { table, file } of tables) {
      await syncTable(table, file);
    }
  } finally {
    syncRunning = false;
    if (syncPending) { syncPending = false; scheduleSync(); }
  }
}

// Pousse vers GitHub ~1 min après la dernière modification (en arrière-plan)
let syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncToGitHub().catch(console.error), 60_000);
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

function broadcast(table) {
  const msg = JSON.stringify({ type: 'update', table });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── API données ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({
  ok: true,
  clients: clients.size,
  // Dépôt déjà configuré (sans le jeton) : le client n'a pas besoin de renvoyer /init
  githubRepo: githubConfig ? `${githubConfig.dataOwner}/${githubConfig.dataRepo}` : null,
}));

app.post('/init', async (req, res) => {
  const { pat, dataOwner, dataRepo } = req.body ?? {};
  if (!pat || !dataOwner || !dataRepo) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }
  githubConfig = { pat, dataOwner, dataRepo };
  setSetting('github', githubConfig);
  const existing = getTable('lists');
  if (!existing) {
    await importFromGitHub();
    broadcast('all');
  } else {
    syncToGitHub().catch(console.error);
  }
  res.json({ ok: true, seeded: !existing });
});

app.post('/sync/pull', async (_req, res) => {
  await importFromGitHub();
  broadcast('all');
  res.json({ ok: true });
});

app.post('/sync/push', async (_req, res) => {
  await syncToGitHub();
  res.json({ ok: true });
});

function makeTableRouter(table) {
  const router = express.Router();
  router.get('/', (_req, res) => {
    const data = getTable(table);
    if (data === null) return res.status(404).json({ error: 'Pas de données' });
    res.json(data);
  });
  router.put('/', (req, res) => {
    if (req.body === undefined || req.body === null) {
      return res.status(400).json({ error: 'Body manquant' });
    }
    setTable(table, req.body);
    broadcast(table);
    scheduleSync();
    res.json({ ok: true });
  });
  return router;
}

app.use('/lists',   makeTableRouter('lists'));
app.use('/recipes', makeTableRouter('recipes'));
app.use('/rayons',  makeTableRouter('rayons'));
app.use('/catalog', makeTableRouter('catalog'));
app.use('/history', makeTableRouter('history'));

// Ajout d'une seule recette depuis RecipeExplorer
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
  scheduleSync();
  res.json({ ok: true, id: recipe.id });
});

// PATCH atomique : toggle un seul item ou essentiel sans réécrire tout le JSON
app.patch('/lists/toggle/:id', (req, res) => {
  const { id } = req.params;
  const { type } = req.body ?? {};
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
  scheduleSync();
  res.json({ ok: true });
});

// ── Mistral proxy ────────────────────────────────────────────────────────────

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY ?? '';

const PROMPTS = {
  products: `Tu es un assistant qui structure des listes de courses françaises.
À partir du texte brut fourni, extrais chaque produit et retourne un JSON valide avec ce format exact:
{
  "products": [
    {
      "name": "string (nom du produit en français, naturel)",
      "quantity": number (1 si non précisé),
      "unit": "string (kg, g, L, mL, pcs, sachet, boîte, etc.  'pcs' si non précisé)",
      "rayonId": "string (un des IDs ci-dessous)",
      "confidence": "high" | "medium" | "low"
    }
  ]
}
IDs de rayons disponibles:
- fruits-legumes, boulangerie, boucherie, cremerie, epicerie-seche, surgeles, boissons, hygiene, entretien, autre`,

  recipe: `Tu es un assistant culinaire qui structure des recettes françaises.
À partir du texte brut fourni, extrais la recette et retourne un JSON valide avec ce format exact:
{
  "name": "string (nom de la recette en français)",
  "servings": number (4 si non précisé),
  "ingredients": [
    {
      "name": "string",
      "quantity": number,
      "unit": "string",
      "rayonId": "string",
      "caloriesPerUnit": number (kcal pour 1 unité de cet ingrédient tel qu'exprimé dans la recette, ex: 1g de farine = 3.6, 1 œuf = 70 — omets si inconnu)
    }
  ]
}
IDs de rayons disponibles:
- fruits-legumes, boulangerie, boucherie, cremerie, epicerie-seche, surgeles, boissons, hygiene, entretien, autre`,

  recipeImage: `Tu es un assistant culinaire qui structure des recettes françaises à partir d'images.
Analyse l'image (photo de livre de cuisine, screenshot de site) et extrais la recette. Retourne un JSON valide avec ce format exact:
{
  "name": "string (nom de la recette en français)",
  "servings": number (4 si non précisé),
  "ingredients": [
    {
      "name": "string (ingrédient en français)",
      "quantity": number,
      "unit": "string (g, kg, mL, cL, L, pcs, sachet, c. à soupe, c. à café — pcs si non précisé)",
      "rayonId": "string",
      "caloriesPerUnit": number (kcal pour 1 unité de cet ingrédient tel qu'exprimé dans la recette, ex: 1g de farine = 3.6, 1 œuf = 70 — omets si inconnu)
    }
  ],
  "steps": ["string", "string"]
}
IDs de rayons disponibles:
- fruits-legumes, boulangerie, boucherie, cremerie, epicerie-seche, surgeles, boissons, hygiene, entretien, autre
Règles:
- steps: liste les étapes dans l'ordre de préparation, telles qu'elles apparaissent dans l'image
- Si les étapes ne sont pas découpées explicitement, crée des étapes logiques (préparation, cuisson, dressage)
- Ne jamais inventer d'ingrédients absents de l'image
- Le nom doit être court et naturel`,

  recipeSteps: `Tu es un assistant culinaire. À partir de cette image de recette, extrais uniquement les étapes de préparation.
Retourne un JSON valide avec ce format exact:
{
  "steps": ["string", "string", "string"]
}
Règles:
- Si l'image montre des étapes numérotées ou titrées, respecte leur découpage exact
- Si pas de découpage explicite, crée des étapes logiques de cuisine (ex: "Préparer les légumes", "Faire revenir la viande", "Assembler et servir")
- Chaque étape doit être une phrase complète et actionnable
- Minimum 2 étapes, maximum 15`,

  recipeStepsText: `Tu es un assistant culinaire. À partir du texte brut d'une page de recette, extrais uniquement les étapes de préparation.
Retourne un JSON valide avec ce format exact:
{
  "steps": ["string", "string", "string"]
}
Règles:
- Si le texte contient des étapes numérotées ou titrées, respecte leur découpage exact
- Si pas de découpage explicite, crée des étapes logiques de cuisine (préparation, cuisson, dressage)
- Chaque étape doit être une phrase complète et actionnable en français
- Minimum 2 étapes, maximum 15
- Ignorer les publicités, commentaires, navigation et tout contenu non lié à la recette`
};

function extractTextFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 12000);
}

// Config IA partagée par tous les appareils (Réglages > IA). La clé ne quitte jamais le serveur.
let aiSettings = getSetting('ai') ?? { provider: 'mistral', model: '', apiKey: '' };

function publicAiSettings() {
  return { provider: aiSettings.provider, model: aiSettings.model, hasKey: !!aiSettings.apiKey };
}

// Choisit l'IA : OpenRouter si configuré (clé + modèle), sinon Mistral
function aiTarget() {
  const ai = aiSettings;
  if (ai.provider === 'openrouter' && ai.apiKey && ai.model) {
    return { name: 'OpenRouter', url: OPENROUTER_URL, key: ai.apiKey, model: ai.model };
  }
  return { name: 'Mistral', url: MISTRAL_URL, key: MISTRAL_API_KEY, model: 'mistral-small-latest' };
}

// Certains modèles entourent le JSON de ```json … ``` ou de texte
function parseJsonReply(text) {
  try { return JSON.parse(text); } catch { /* on tente d'extraire l'objet */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("Réponse de l'IA illisible");
  return JSON.parse(text.slice(start, end + 1));
}

async function callAI(messages) {
  const t = aiTarget();
  const res = await fetch(t.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json', 'X-Title': 'StoreFlow' },
    body: JSON.stringify({
      model: t.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error(`${t.name} : quota dépassé (429). Essaie OpenRouter dans Réglages > IA.`);
    throw new Error(`${t.name} error: ${res.status} ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return parseJsonReply(data.choices[0].message.content);
}

function callLLM(systemPrompt, rawText) {
  return callAI([{ role: 'system', content: systemPrompt }, { role: 'user', content: rawText }]);
}

function callLLMVision(systemPrompt, imageBase64, mimeType) {
  return callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: 'text', text: 'Analyse cette image de recette.' }
    ]}
  ]);
}

app.get('/ai/settings', (_req, res) => res.json(publicAiSettings()));

app.put('/ai/settings', async (req, res) => {
  const { provider, model, apiKey } = req.body ?? {};
  if (provider !== undefined && provider !== 'mistral' && provider !== 'openrouter') {
    return res.status(400).json({ error: 'Fournisseur inconnu' });
  }
  if (apiKey) {
    const check = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => null);
    if (!check?.ok) return res.status(400).json({ error: 'Clé API refusée par OpenRouter' });
  }
  aiSettings = {
    provider: provider ?? aiSettings.provider,
    model: model ?? aiSettings.model,
    apiKey: apiKey ?? aiSettings.apiKey,
  };
  setSetting('ai', aiSettings);
  res.json(publicAiSettings());
});

// Solde OpenRouter (la clé reste côté serveur)
app.get('/ai/credits', async (_req, res) => {
  if (!aiSettings.apiKey) return res.status(404).json({ error: 'Pas de clé OpenRouter' });
  try {
    const r = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${aiSettings.apiKey}` },
    });
    if (!r.ok) return res.status(502).json({ error: `OpenRouter ${r.status}` });
    const { data } = await r.json();
    res.json({ remaining: data.total_credits - data.total_usage });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/parse-products', async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: 'rawText is required' });
    res.json(await callLLM(PROMPTS.products, rawText));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/parse-recipe', async (req, res) => {
  try {
    let { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: 'rawText is required' });
    if (/^https?:\/\//i.test(rawText.trim())) {
      try {
        const pageRes = await fetch(rawText.trim(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StoreFlow/1.0)' }
        });
        if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
        rawText = extractTextFromHtml(await pageRes.text());
        if (!rawText) throw new Error('Page vide ou non lisible');
      } catch (fetchErr) {
        return res.status(422).json({ error: `Impossible de lire la page : ${fetchErr.message}` });
      }
    }
    res.json(await callLLM(PROMPTS.recipe, rawText));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/parse-recipe-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
    if (Buffer.byteLength(imageBase64, 'base64') > 4 * 1024 * 1024)
      return res.status(413).json({ error: 'Image trop grande (max 4 Mo)' });
    res.json(await callLLMVision(PROMPTS.recipeImage, imageBase64, mimeType || 'image/jpeg'));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/parse-recipe-steps', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
    if (Buffer.byteLength(imageBase64, 'base64') > 4 * 1024 * 1024)
      return res.status(413).json({ error: 'Image trop grande (max 4 Mo)' });
    res.json(await callLLMVision(PROMPTS.recipeSteps, imageBase64, mimeType || 'image/jpeg'));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/parse-recipe-steps-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\//i.test(url))
      return res.status(400).json({ error: 'url invalide' });
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StoreFlow/1.0)' }
    });
    if (!pageRes.ok) return res.status(422).json({ error: `HTTP ${pageRes.status}` });
    const pageText = extractTextFromHtml(await pageRes.text());
    if (!pageText) return res.status(422).json({ error: 'Page vide ou non lisible' });
    res.json(await callLLM(PROMPTS.recipeStepsText, pageText));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Fichiers statiques ───────────────────────────────────────────────────────

// Fichiers JS/CSS versionnés (nom avec hash) : compressés en gzip une fois, puis
// mis en cache 1 an par le navigateur (un nouveau build change le nom du fichier)
const gzipCache = new Map();
app.get('/assets/{*file}', (req, res, next) => {
  const file = path.join(STATIC_DIR, req.path);
  if (!file.startsWith(path.join(STATIC_DIR, 'assets')) || !fs.existsSync(file)) return next();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) return next();
  let gz = gzipCache.get(file);
  if (!gz) {
    try { gz = zlib.gzipSync(fs.readFileSync(file)); } catch { return next(); }
    gzipCache.set(file, gz);
  }
  res.set({ 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
  res.type(path.extname(file)).send(gz);
});

app.use(express.static(STATIC_DIR));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

// ── Cron sync GitHub (toutes les heures) ─────────────────────────────────────

cron.schedule('0 * * * *', () => syncToGitHub().catch(console.error));

// ── Démarrage ────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[StoreFlow] Démarré sur le port ${PORT}`);
  console.log(`[StoreFlow] DB : ${DB_PATH}`);
  console.log(`[StoreFlow] Static : ${STATIC_DIR}`);
  // Config GitHub mémorisée : on rattrape tout de suite les changements faits en mode secours
  if (githubConfig) {
    const job = getTable('lists') ? syncToGitHub() : importFromGitHub();
    job.then(() => broadcast('all')).catch(console.error);
  }
});
