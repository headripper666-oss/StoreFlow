// Authentication
export interface AuthConfig {
  pat: string;
  dataOwner: string;
  dataRepo: string;
}

// Rayons (store sections)
export interface Rayon {
  id: string;
  label: string;
  order: number;
  icon?: string;
}

// Product catalog entry
export interface CatalogProduct {
  id: string;
  name: string;
  defaultUnit: string;
  rayonId: string;
  aliases?: string[];
}

// A personal list item
export interface ListItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unit: string;
  rayonId: string;
  checked: boolean;
  addedAt: string;
  checkedAt?: string;
}

// An essential item (always present, resets each trip)
export interface EssentialItem {
  id: string;
  name: string;
  rayonId: string;
  checked: boolean;
}

// Root data structure stored in lists.json
export interface ShoppingData {
  version: number;
  updatedAt: string;
  updatedBy: string;
  essentials: EssentialItem[];
  personalList: ListItem[];
}

// GitHub API file state (for ETag + SHA tracking)
export interface GitHubFileState {
  sha: string;
  etag: string;
  content: ShoppingData;
}

// Mistral parse request/response
export interface ParseRequest {
  rawText: string;
}

export interface ParsedProduct {
  name: string;
  quantity: number;
  unit: string;
  rayonId: string;
  confidence: "high" | "medium" | "low";
}

export interface ParseResponse {
  products: ParsedProduct[];
}

// Unified display item for the shopping list view (merges essentials + personalList)
export interface DisplayItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  rayonId: string;
  checked: boolean;
  isEssential: boolean;
}

// Sync status
export type SyncStatus = "synced" | "saving" | "offline" | "error";

// Pending change for offline queue
export interface PendingChange {
  id: string;
  type:
    | "toggle_essential"
    | "reset_essentials"
    | "toggle_item"
    | "add_items"
    | "remove_item"
    | "clear_checked";
  payload: unknown;
  timestamp: string;
}

// Recipes
export interface RecipeIngredient {
  name: string;
  quantity: number; // quantité pour le nombre de personnes de base (servings)
  unit: string;
  rayonId: string;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number; // nombre de personnes de référence
  ingredients: RecipeIngredient[];
  createdAt: string;
}

export interface ParsedRecipe {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
}
