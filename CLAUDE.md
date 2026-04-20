# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Type-check + production build → dist/
npm run lint      # ESLint
npm run preview   # Serve the production build locally
```

No test suite is configured. TypeScript compilation (`tsc -b`) acts as the primary correctness check — always run `npm run build` before declaring work done.

## Architecture

StoreFlow is a mobile-first React PWA for collaborative shopping lists and meal planning. All persistent data lives in a **GitHub repository** owned by the user. There is no backend beyond Netlify serverless functions.

### Data flow

```
GitHub repo (lists.json, rayons.json, products.json, recipes.json)
        ↕  GitHub Contents API (PAT auth)
  useShoppingList / useRecipes (hooks)  ←→  localStorage (cache + SHA + ETag)
        ↕
   React pages / components
```

- **Auth**: GitHub Personal Access Token stored in `sessionStorage` (cleared on tab close). Config: `{ pat, dataOwner, dataRepo }`.
- **Sync**: ETag-based conditional GET (`If-None-Match`) on polling (30 s, with exponential backoff up to 5 min). SHA tracked for optimistic PUT conflict detection.
- **Optimistic updates**: every mutation applies locally first, then saves to GitHub. Network failures keep the optimistic state and queue it for retry on `window.online`. Non-network failures (conflict, 409) rollback.
- **Offline**: `localStorage` cache (24 h TTL). Dirty changes survive until connectivity is restored.

### Key files

| File                                   | Role                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `src/hooks/useShoppingList.ts`         | Central state: data, rayons, catalog, all mutations, sync logic                  |
| `src/hooks/useRecipes.ts`              | Recipes state: CRUD mutations, SHA tracking, GitHub sync                         |
| `src/hooks/useAuth.ts`                 | Login (validates PAT, calls `initDataRepo`), session restore                     |
| `src/hooks/usePolling.ts`              | Generic interval poller with in-flight guard + exponential backoff               |
| `src/services/github.ts`               | GitHub Contents API: fetch/save all JSON files + `initDataRepo`                  |
| `src/services/storage.ts`              | localStorage/sessionStorage helpers (cache, SHA, ETag, auth config)              |
| `src/services/mistral.ts`              | Calls Netlify functions to parse free-text into products or recipes              |
| `netlify/functions/parse-products.mts` | Serverless: proxies text to Mistral AI, returns `ParsedProduct[]`                |
| `netlify/functions/parse-recipe.mts`   | Serverless: proxies recipe text to Mistral AI, returns `ParsedRecipe`            |
| `src/utils/recipeUtils.ts`             | `roundQuantity()` — scales ingredient quantities, rounding discrete units to 0.5 |
| `src/theme.ts`                         | MUI theme (green primary `#2E7D32`, rounded 12 px)                               |

### Data structures (`src/types/index.ts`)

- `ShoppingData` — root of `lists.json`: `{ essentials: EssentialItem[], personalList: ListItem[] }`
- `EssentialItem` — recurring item (per-trip, resettable): `{ id, name, rayonId, checked }`
- `ListItem` — one-off item: `{ id, name, quantity, unit, rayonId, checked, addedAt, checkedAt? }`
- `Rayon` — store aisle: `{ id, label, order, icon }` — loaded from `rayons.json`, falls back to `DEFAULT_RAYONS`
- `CatalogProduct` — autocomplete source: `{ id, name, defaultUnit, rayonId, aliases? }` — loaded from `products.json`
- `Recipe` — `{ id, name, servings, ingredients: RecipeIngredient[], createdAt }`
- `RecipeIngredient` — `{ name, quantity, unit, rayonId }` — quantities are per `servings` base
- `ParsedRecipe` — raw AI output before user confirms: `{ name, servings, ingredients }`

### GitHub repo structure (data repo, not this code repo)

```
lists.json     ← ShoppingData (read/written on every mutation)
rayons.json    ← Rayon[] (read-only at startup, overrides DEFAULT_RAYONS)
products.json  ← CatalogProduct[] (read-only at startup, powers autocomplete)
recipes.json   ← Recipe[] (read/written by useRecipes)
```

`initDataRepo` creates all four files with defaults if they don't exist (called once on first login).

### Netlify deployment

`netlify.toml` publishes `dist/` and maps `/api/*` → `/.netlify/functions/:splat`. Both serverless functions require `MISTRAL_API_KEY` as an environment variable. No Vite base path — app is served at the root.

### Recipes feature — ingredient scaling

When a user picks a recipe for N guests and the recipe base is M servings, each ingredient quantity is multiplied by `N/M` then passed through `roundQuantity(raw, unit)`: discrete units (pcs, œuf, tranche, gousse…) round to the nearest 0.5; all others round to 2 decimal places. The `RecipeUsageDialog` offers two confirmation paths:

- **"Ce voyage seulement"** — adds scaled ingredients to `personalList` via `addItems()`, `recipes.json` untouched.
- **"Ajouter + Sauvegarder"** — un-scales the edited quantities back to per-serving, saves to `recipes.json`, then adds to list. The two writes are sequential (recipe first) so a recipe save failure aborts the list add.
