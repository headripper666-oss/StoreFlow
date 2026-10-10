import type { AiSettings, AuthConfig, PendingChange, ShoppingData } from "../types";

const CACHE_KEY = "storeflow_data";
const AUTH_KEY = "storeflow_auth";
const PENDING_KEY = "storeflow_pending";
const ETAG_KEY = "storeflow_etag";
const SHA_KEY = "storeflow_sha";
const ITEM_ORDER_KEY = "storeflow_item_order";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: ShoppingData;
  cachedAt: number;
}

// --- Data cache (localStorage) ---

export function cacheData(data: ShoppingData): void {
  const entry: CacheEntry = { data, cachedAt: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full — skip caching
  }
}

export function getCachedData(): ShoppingData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(ETAG_KEY);
  localStorage.removeItem(SHA_KEY);
}

// --- ETag + SHA (for GitHub API conditional requests) ---

export function saveETag(etag: string): void {
  localStorage.setItem(ETAG_KEY, etag);
}

export function loadETag(): string | null {
  return localStorage.getItem(ETAG_KEY);
}

export function saveSHA(sha: string): void {
  localStorage.setItem(SHA_KEY, sha);
}

export function loadSHA(): string | null {
  return localStorage.getItem(SHA_KEY);
}

// --- Auth config (localStorage — persists across sessions) ---

export function saveAuthConfig(config: AuthConfig): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(config));
}

export function loadAuthConfig(): AuthConfig | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthConfig;
  } catch {
    return null;
  }
}

export function clearAuthConfig(): void {
  localStorage.removeItem(AUTH_KEY);
}

// --- Réglages IA (localStorage) ---

const AI_KEY = "storeflow_ai";

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_KEY);
    if (raw) return JSON.parse(raw) as AiSettings;
  } catch {
    // ignore
  }
  return { provider: "mistral", openrouterKey: "", openrouterModel: "" };
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(AI_KEY, JSON.stringify(settings));
}

// --- Pending changes queue (offline support) ---

export function queuePendingChange(change: PendingChange): void {
  const changes = getPendingChanges();
  changes.push(change);
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(changes));
  } catch {
    // Storage full
  }
}

export function getPendingChanges(): PendingChange[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingChange[];
  } catch {
    return [];
  }
}

export function clearPendingChanges(): void {
  localStorage.removeItem(PENDING_KEY);
}

// --- Item order map (localStorage — persists across sessions) ---
// Maps rayonId -> ordered array of normalized item names

type ItemOrderMap = Record<string, string[]>;

export function getItemOrderMap(): ItemOrderMap {
  try {
    const raw = localStorage.getItem(ITEM_ORDER_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ItemOrderMap;
  } catch {
    return {};
  }
}

export function setItemOrderMap(map: ItemOrderMap): void {
  try {
    localStorage.setItem(ITEM_ORDER_KEY, JSON.stringify(map));
  } catch {
    // Storage full — skip
  }
}
