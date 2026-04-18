import type {
  AuthConfig,
  CatalogProduct,
  GitHubFileState,
  Rayon,
  Recipe,
  ShoppingData,
} from "../types";
import { DEFAULT_RAYONS } from "../constants/defaultRayons";
import { loadETag, saveETag, saveSHA } from "./storage";

const API_BASE = "https://api.github.com";

function githubHeaders(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function contentUrl(owner: string, repo: string, path: string): string {
  return `${API_BASE}/repos/${owner}/${repo}/contents/${path}`;
}

function decodeContent(base64: string): unknown {
  const decoded = atob(base64.replace(/\n/g, ""));
  return JSON.parse(decodeURIComponent(escape(decoded)));
}

function encodeContent(data: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
}

// Fetch lists.json — returns content, SHA and ETag
export async function fetchShoppingData(
  config: AuthConfig,
): Promise<GitHubFileState> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "lists.json");
  const storedEtag = loadETag();

  const headers: HeadersInit = {
    ...githubHeaders(pat),
    ...(storedEtag ? { "If-None-Match": storedEtag } : {}),
  };

  const res = await fetch(url, { headers });

  if (res.status === 304) {
    // Not modified — caller should use cached data
    throw new Error("NOT_MODIFIED");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("AUTH_ERROR");
    }
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json();
  const etag = res.headers.get("etag") ?? "";

  saveETag(etag);
  saveSHA(json.sha);

  const content = decodeContent(json.content) as ShoppingData;

  return { sha: json.sha, etag, content };
}

// Write lists.json with updated content
export async function saveShoppingData(
  config: AuthConfig,
  data: ShoppingData,
  currentSha: string,
  updatedBy: string = "user",
): Promise<string> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "lists.json");

  const payload = {
    ...data,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const body = {
    message: `chore: update shopping list [${new Date().toISOString()}]`,
    content: encodeContent(payload),
    sha: currentSha,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(pat),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error("CONFLICT");
    }
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json();
  const newSha = json.content.sha as string;
  saveSHA(newSha);
  return newSha;
}

// Fetch rayons.json (static, cached)
export async function fetchRayons(config: AuthConfig): Promise<Rayon[]> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "rayons.json");

  try {
    const res = await fetch(url, { headers: githubHeaders(pat) });
    if (!res.ok) return DEFAULT_RAYONS;
    const json = await res.json();
    return decodeContent(json.content) as Rayon[];
  } catch {
    return DEFAULT_RAYONS;
  }
}

// Fetch products.json (catalog)
export async function fetchCatalog(
  config: AuthConfig,
): Promise<CatalogProduct[]> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "products.json");

  try {
    const res = await fetch(url, { headers: githubHeaders(pat) });
    if (!res.ok) return [];
    const json = await res.json();
    return decodeContent(json.content) as CatalogProduct[];
  } catch {
    return [];
  }
}

// Save rayons.json (overwrites current content)
export async function saveRayons(
  config: AuthConfig,
  rayons: Rayon[],
): Promise<void> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "rayons.json");

  const checkRes = await fetch(url, { headers: githubHeaders(pat) });
  if (!checkRes.ok) throw new Error(`GitHub API error: ${checkRes.status}`);
  const current = await checkRes.json();

  const res = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(pat),
    body: JSON.stringify({
      message: "chore: update rayons",
      content: encodeContent(rayons),
      sha: current.sha,
    }),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
}

// Fetch recipes.json
export async function fetchRecipes(
  config: AuthConfig,
): Promise<{ recipes: Recipe[]; sha: string }> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "recipes.json");

  try {
    const res = await fetch(url, { headers: githubHeaders(pat) });
    if (!res.ok) return { recipes: [], sha: "" };
    const json = await res.json();
    return {
      recipes: decodeContent(json.content) as Recipe[],
      sha: json.sha as string,
    };
  } catch {
    return { recipes: [], sha: "" };
  }
}

// Save recipes.json
export async function saveRecipes(
  config: AuthConfig,
  recipes: Recipe[],
  currentSha: string,
): Promise<string> {
  const { pat, dataOwner, dataRepo } = config;
  const url = contentUrl(dataOwner, dataRepo, "recipes.json");

  const body: Record<string, unknown> = {
    message: `chore: update recipes [${new Date().toISOString()}]`,
    content: encodeContent(recipes),
  };
  if (currentSha) {
    body.sha = currentSha;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(pat),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error("CONFLICT");
    }
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json();
  return json.content.sha as string;
}

// Initialize the data repo with default files if they don't exist
export async function initDataRepo(config: AuthConfig): Promise<void> {
  const { pat, dataOwner, dataRepo } = config;

  async function createFileIfMissing(
    path: string,
    content: unknown,
  ): Promise<void> {
    const url = contentUrl(dataOwner, dataRepo, path);
    const checkRes = await fetch(url, { headers: githubHeaders(pat) });
    if (checkRes.ok) return; // Already exists

    await fetch(url, {
      method: "PUT",
      headers: githubHeaders(pat),
      body: JSON.stringify({
        message: `chore: initialize ${path}`,
        content: encodeContent(content),
      }),
    });
  }

  const { DEFAULT_ESSENTIALS } = await import("../constants/defaultRayons");

  const initialData: ShoppingData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
    essentials: DEFAULT_ESSENTIALS,
    personalList: [],
  };

  await createFileIfMissing("lists.json", initialData);
  await createFileIfMissing("rayons.json", DEFAULT_RAYONS);
  await createFileIfMissing("products.json", []);
  await createFileIfMissing("recipes.json", []);
}
