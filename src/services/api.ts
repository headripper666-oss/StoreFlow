/**
 * Couche de service principale — tape sur storeflow-api (SQLite/WS) en priorité,
 * bascule sur GitHub en fallback si le serveur est injoignable.
 */

import type {
  AuthConfig,
  CatalogProduct,
  Rayon,
  Recipe,
  RecipeHistoryEntry,
  ShoppingData,
} from "../types";
import * as github from "./github";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3020";
// Version de secours (GitHub Pages) : pas de serveur N150, lecture/écriture directe sur GitHub
const GITHUB_ONLY = import.meta.env.VITE_GITHUB_ONLY === "true";

// ── Détection disponibilité serveur ─────────────────────────────────────────

let _serverAvailable: boolean | null = null;
let _lastCheck = 0;
const CHECK_INTERVAL_MS = 30_000;

export async function isServerAvailable(): Promise<boolean> {
  if (GITHUB_ONLY) return false;
  const now = Date.now();
  if (_serverAvailable !== null && now - _lastCheck < CHECK_INTERVAL_MS) {
    return _serverAvailable;
  }
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    _serverAvailable = res.ok;
  } catch {
    _serverAvailable = false;
  }
  _lastCheck = Date.now();
  return _serverAvailable;
}

export function markServerUnavailable() {
  _serverAvailable = false;
  _lastCheck = Date.now();
}

export function resetServerCheck() {
  _serverAvailable = null;
  _lastCheck = 0;
}

// ── Init : envoie la config GitHub au serveur ─────────────────────────────

export async function initApiServer(config: AuthConfig): Promise<boolean> {
  if (GITHUB_ONLY) return false;
  try {
    const res = await fetch(`${API_BASE}/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pat: config.pat,
        dataOwner: config.dataOwner,
        dataRepo: config.dataRepo,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    _serverAvailable = res.ok;
    _lastCheck = Date.now();
    return res.ok;
  } catch {
    _serverAvailable = false;
    _lastCheck = Date.now();
    return false;
  }
}

// ── Helpers HTTP ─────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null; // DB vide — pas une erreur serveur
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPut<T>(path: string, body: T): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
}

async function apiPatch(path: string, body: Record<string, string>): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
}

// En mode secours, le SHA "local" (mode serveur) n'est pas un SHA GitHub valide
async function githubSha(config: AuthConfig, file: string, sha: string): Promise<string> {
  return sha && sha !== "local" ? sha : github.fetchFileSha(config, file);
}

// ── ShoppingData (lists.json) ────────────────────────────────────────────────

export async function fetchShoppingData(
  config: AuthConfig,
): Promise<{ content: ShoppingData; sha: string; etag: string }> {
  if (await isServerAvailable()) {
    try {
      const data = await apiGet<ShoppingData>("/lists");
      if (data !== null) return { content: data, sha: "local", etag: "local" };
    } catch {
      markServerUnavailable();
    }
  }
  const ghState = await github.fetchShoppingData(config);
  return { content: ghState.content, sha: ghState.sha, etag: ghState.etag };
}

export async function saveShoppingData(
  config: AuthConfig,
  data: ShoppingData,
  _currentSha: string,
  updatedBy?: string,
): Promise<string> {
  const payload = { ...data, updatedAt: new Date().toISOString(), updatedBy: updatedBy ?? "user" };
  if (await isServerAvailable()) {
    try {
      await apiPut("/lists", payload);
      return "local";
    } catch {
      markServerUnavailable();
    }
  }
  return github.saveShoppingData(config, payload, await githubSha(config, "lists.json", _currentSha), updatedBy);
}

// ── Toggle atomique (PATCH) ──────────────────────────────────────────────────

export async function toggleShoppingItem(id: string): Promise<boolean> {
  if (!(await isServerAvailable())) return false;
  try {
    await apiPatch(`/lists/toggle/${id}`, { type: "item" });
    return true;
  } catch {
    markServerUnavailable();
    return false;
  }
}

export async function toggleEssentialItem(id: string): Promise<boolean> {
  if (!(await isServerAvailable())) return false;
  try {
    await apiPatch(`/lists/toggle/${id}`, { type: "essential" });
    return true;
  } catch {
    markServerUnavailable();
    return false;
  }
}

// ── Rayons ────────────────────────────────────────────────────────────────────

export async function fetchRayons(config: AuthConfig): Promise<Rayon[]> {
  if (await isServerAvailable()) {
    try {
      const data = await apiGet<Rayon[]>("/rayons");
      if (data !== null && Array.isArray(data)) return data;
    } catch {
      markServerUnavailable();
    }
  }
  return github.fetchRayons(config);
}

export async function saveRayons(config: AuthConfig, rayons: Rayon[]): Promise<void> {
  if (await isServerAvailable()) {
    try {
      await apiPut("/rayons", rayons);
      return;
    } catch {
      markServerUnavailable();
    }
  }
  return github.saveRayons(config, rayons);
}

// ── Catalogue (products.json) ─────────────────────────────────────────────────

export async function fetchCatalog(
  config: AuthConfig,
): Promise<{ products: CatalogProduct[]; sha: string }> {
  if (await isServerAvailable()) {
    try {
      const data = await apiGet<CatalogProduct[]>("/catalog");
      if (data !== null && Array.isArray(data)) return { products: data, sha: "local" };
    } catch {
      markServerUnavailable();
    }
  }
  return github.fetchCatalog(config);
}

export async function saveCatalog(
  config: AuthConfig,
  products: CatalogProduct[],
  _currentSha: string,
): Promise<string> {
  if (await isServerAvailable()) {
    try {
      await apiPut("/catalog", products);
      return "local";
    } catch {
      markServerUnavailable();
    }
  }
  return github.saveCatalog(config, products, await githubSha(config, "products.json", _currentSha));
}

// ── Recettes ──────────────────────────────────────────────────────────────────

export async function fetchRecipes(
  config: AuthConfig,
): Promise<{ recipes: Recipe[]; sha: string }> {
  if (await isServerAvailable()) {
    try {
      const data = await apiGet<Recipe[]>("/recipes");
      if (data !== null && Array.isArray(data)) return { recipes: data, sha: "local" };
    } catch {
      markServerUnavailable();
    }
  }
  return github.fetchRecipes(config);
}

export async function saveRecipes(
  config: AuthConfig,
  recipes: Recipe[],
  _currentSha: string,
): Promise<string> {
  if (await isServerAvailable()) {
    try {
      await apiPut("/recipes", recipes);
      return "local";
    } catch {
      markServerUnavailable();
    }
  }
  return github.saveRecipes(config, recipes, await githubSha(config, "recipes.json", _currentSha));
}

// ── Historique ────────────────────────────────────────────────────────────────

export async function fetchHistory(
  config: AuthConfig,
): Promise<{ history: RecipeHistoryEntry[]; sha: string }> {
  if (await isServerAvailable()) {
    try {
      const data = await apiGet<RecipeHistoryEntry[]>("/history");
      if (data !== null && Array.isArray(data)) return { history: data, sha: "local" };
    } catch {
      markServerUnavailable();
    }
  }
  return github.fetchHistory(config);
}

export async function saveHistory(
  config: AuthConfig,
  history: RecipeHistoryEntry[],
  _currentSha: string,
): Promise<string> {
  if (await isServerAvailable()) {
    try {
      await apiPut("/history", history);
      return "local";
    } catch {
      markServerUnavailable();
    }
  }
  return github.saveHistory(config, history, await githubSha(config, "history.json", _currentSha));
}

// ── Init repo (délégué à GitHub — une seule fois au 1er login) ───────────────

export { initDataRepo } from "./github";

// ── WebSocket — écoute les mises à jour des autres devices ───────────────────

type UpdateHandler = (table: string) => void;
let _ws: WebSocket | null = null;
let _wsHandler: UpdateHandler | null = null;
let _wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

// Quand le WebSocket est connecté, il prévient de chaque changement : inutile de poller
export function isWebSocketConnected(): boolean {
  return _ws?.readyState === WebSocket.OPEN;
}

export function connectWebSocket(onUpdate: UpdateHandler): () => void {
  _wsHandler = onUpdate;
  _connect();
  return () => {
    _wsHandler = null;
    if (_wsReconnectTimer) clearTimeout(_wsReconnectTimer);
    _ws?.close();
    _ws = null;
  };
}

function _connect() {
  if (!_wsHandler || GITHUB_ONLY) return;

  const wsUrl = API_BASE.replace(/^http/, "ws") + "/";
  try {
    _ws = new WebSocket(wsUrl);

    _ws.onopen = () => {
      console.log("[ws] Connecté à storeflow-api");
      if (_wsReconnectTimer) {
        clearTimeout(_wsReconnectTimer);
        _wsReconnectTimer = null;
      }
    };

    _ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as { type: string; table: string };
        if (msg.type === "update" && _wsHandler) {
          _wsHandler(msg.table);
        }
      } catch {
        // ignore malformed messages
      }
    };

    _ws.onclose = () => {
      _ws = null;
      if (_wsHandler != null) {
        _wsReconnectTimer = setTimeout(_connect, 5000);
      }
    };

    _ws.onerror = () => {
      _ws?.close();
    };
  } catch {
    if (_wsHandler != null) {
      _wsReconnectTimer = setTimeout(_connect, 5000);
    }
  }
}
