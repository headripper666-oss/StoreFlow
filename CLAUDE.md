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

### Commandes autorisées (4) — reprises dans `recette.html`

| Usage | Commande | Machine |
|---|---|---|
| Tests | `npm run build` + `npm run lint` (appli Android : `cd apk && node --test`) | N150 |
| Revue de code | `/code-review` | Claude Code |
| Documentation | mise à jour de ce `CLAUDE.md` | Claude Code |
| Déploiement | `npm run build` (+ `sudo systemctl restart storeflow-proxy` si `storeflow-proxy/` a changé) | N150 |

Recette : ouvrir `recette.html` dans un navigateur.

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

- **Auth**: GitHub Personal Access Token stored in `localStorage` (persists across sessions). Config: `{ pat, dataOwner, dataRepo }`.
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
| `src/services/mistral.ts`              | Calls proxy functions to parse free-text into products or recipes                |
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

### Desktop layout (≥ 1024px)

On desktop, `App.tsx` uses `useMediaQuery(theme.breakpoints.up('lg'))` to render `AppShellDesktop` instead of `AppShell`. Mobile interface is untouched. `App.tsx` also uses `useLocation()` to compute the right-pane content and `splitStorageKey` per route.

**Layout components:**

- `src/components/layout/AppShellDesktop.tsx` — desktop shell: sidebar + content area. Accepts `rightPane: ReactNode | null` and `splitStorageKey` props. No top AppBar.
- `src/components/layout/SidebarNav.tsx` — fixed 220px sidebar: Playfair Display logo, nav items grouped (main + settings), sync dot + logout at bottom.
- `src/components/layout/SplitPane.tsx` — wraps `react-resizable-panels` (`Group`/`Panel`/`Separator` API). Drag handle between panes. Sizes persisted via `useDefaultLayout` hook to `localStorage` keyed by `storageKey`.

**Desktop companion components:**

- `src/components/desktop/ListOverviewPane.tsx` — interactive list view (personalList + checked essentials merged, grouped by rayon). Used as right pane on `/essentials` and `/add`. Reuses `RayonSection`.
- `src/components/desktop/RecipeDetailPanel.tsx` — inline recipe usage panel (no Dialog). Guest counter + ingredient checkboxes + inline editing + action buttons. Resets on `recipe.id` change via `useEffect`. Shows empty state when no recipe selected.

**Split-pane pages on desktop:**

- `/essentials` → Indispensables (left) | `ListOverviewPane` (right)
- `/add` → Add form (left) | `ListOverviewPane` (right)
- `/recipes` → Recipe list (left) | `RecipeDetailPanel` (right) — `RecipeUsageDialog` not used on desktop; intact on mobile
- `/list`, `/rayons` → full width, no split

**Data flow on desktop:** `App.tsx` holds `desktopSelectedRecipe: Recipe | null` state. `RecipesPage` receives optional `onDesktopSelect?: (recipe: Recipe) => void` — when defined, clicking "Utiliser" calls it instead of opening the dialog.

**FABs** in `EssentialsPage` and `ListPage` use `bottom: { xs: 80, lg: 24 }` (no bottom nav on desktop).

**Dependency:** `react-resizable-panels` (uses `Group`/`Panel`/`Separator`/`useDefaultLayout` exports — not `PanelGroup`/`PanelResizeHandle`).

Spec: `docs/superpowers/specs/2026-04-20-desktop-layout-design.md`

### Hébergement (N150)

L'application est hébergée sur le **N150** (SOYO M4 Plus2), accessible via Freebox OS.

- **URL publique** : `http://noforgiv.freeboxos.fr:50010`
- **Service systemd** : `storeflow-proxy` (port 3001, exposé Freebox port 50010)
- **Serveur** : `storeflow-proxy/server.js` — Express + SQLite + WebSocket + Mistral proxy + fichiers statiques
- **Fichiers statiques** : servis depuis `../dist` (= `dist/` à la racine du projet)

**Déployer** :
```bash
npm run build
sudo systemctl restart storeflow-proxy
```

Le dossier `netlify/` et `netlify.toml` sont conservés mais non utilisés en production.

**Synchro GitHub** : le serveur pousse vers `storeflow-data` ~1 min après chaque modification (+ cron horaire). Si un fichier a été modifié directement sur GitHub (mode secours) et est plus récent, il est importé dans SQLite.

**Assets** : `/assets/*` servis compressés en gzip avec `Cache-Control: immutable` (1 an). Le polling client est coupé tant que le WebSocket est connecté.

### Appli Android (`apk/`)

Coquille Capacitor 8 (procédé de la skill globale `webapp-to-apk`, modèle CongeFlow). La page de démarrage locale `apk/www/index.html` :

- essaie `http://192.168.1.200:3001` (Wi-Fi maison) et `http://192.168.27.65:3001` (WireGuard), vérifie via `/health` (`ok` + `githubRepo`) que c'est bien StoreFlow, puis ouvre l'appli depuis le N150 ;
- si le N150 ne répond pas : bascule sur la version de secours GitHub Pages (si internet répond) ;
- propose les mises à jour au lancement : `www/app-version.json` (version installée) comparé à `/apk-version.json` du serveur, téléchargement de `StoreFlow-x.y.apk` confié à Chrome (`MainActivity.java`).

Chaque adresse (maison, WireGuard, GitHub Pages) a son propre `localStorage` : une connexion GitHub par adresse dans l'appli. Après un changement de réseau (maison ↔ extérieur), fermer complètement l'appli et la rouvrir.

**Installer** : Chrome sur le téléphone → `http://192.168.1.200:3001/StoreFlow.apk` (ou `http://192.168.27.65:3001/StoreFlow.apk` en WireGuard).

**Publier une nouvelle version de l'APK** (seulement si `apk/` change ; les évolutions de la web app arrivent sans réinstaller) :

```bash
# 1. augmenter versionCode (+ versionName) dans apk/www/app-version.json
cd apk && ./publish.sh      # tests node --test, compilation, copie dans public/
cd .. && npm run build      # met StoreFlow-x.y.apk, StoreFlow.apk et apk-version.json en ligne
```

Tests de la page de démarrage : `cd apk && node --test`. Prérequis N150 : Java 21, SDK Android dans `~/Android/sdk` (chemin dans `apk/android/local.properties`, non versionné). Signature : clé debug `~/.android/debug.keystore` du N150, à conserver (sinon désinstallation nécessaire sur les téléphones). Les `*.apk` sont ignorés par Git ; anciens APK rangés dans `apk/anciennes-versions/`. Icône : `apk/icon.svg` → `make_icons.py` de la skill.

### Version de secours (GitHub Pages)

`https://headripper666-oss.github.io/StoreFlow/` — déployée par `.github/workflows/pages.yml` à chaque push sur `main`. Build avec `VITE_GITHUB_ONLY=true` (lecture/écriture directe sur GitHub, pas de serveur) et `VITE_BASE=/StoreFlow/`. Service worker `public/sw.js` : l'app s'ouvre hors-ligne (HTTPS uniquement, donc inactif sur l'URL N150 en HTTP). L'analyse IA n'y fonctionne pas (elle passe par le N150).

### IA (Mistral / OpenRouter)

Réglages > onglet **IA** (`src/components/settings/AiSettings.tsx`). Config **stockée sur le serveur** (table SQLite `settings`, clé `ai`) et partagée par tous les appareils : `GET/PUT /ai/settings` (la clé OpenRouter n'est jamais renvoyée, seulement `hasKey`), `GET /ai/credits`. `aiTarget()` dans `storeflow-proxy/server.js` choisit OpenRouter si clé + modèle, sinon Mistral (clé dans `storeflow-proxy/.env`, voir `.env.example`).

### Config GitHub du serveur

`POST /init` mémorise `{ pat, dataOwner, dataRepo }` dans la table `settings` (clé `github`). `/health` renvoie `githubRepo` : si c'est le bon dépôt, le client ne renvoie pas le jeton (l'URL est en HTTP). Au démarrage, le serveur reprend la synchro tout seul. Un 401 GitHub efface la config (le prochain appareil la renverra).

### Serveur versionné

`storeflow-proxy/` est dans le dépôt (sauf `.env`, `*.db*`, `*.bak*`, `node_modules`). Après un clone : `cd storeflow-proxy && npm ci && cp .env.example .env`.

### Recipes feature — ingredient scaling & UX

When a user picks a recipe for N guests and the recipe base is M servings, each ingredient quantity is multiplied by `N/M` then passed through `roundQuantity(raw, unit)`: discrete units (pcs, œuf, tranche, gousse…) round to the nearest 0.5; all others round to 2 decimal places.

#### RecipeUsageDialog — dialogue unifié (single screen)

`RecipeUsageDialog` is a single-screen dialog (no step machine). It shows:

- A **+/− guest counter** at the top; changing the count rescales all ingredient quantities in real time from the base recipe.
- A **per-ingredient checkbox list** (all checked by default). Unchecking an ingredient excludes it from the add — useful when the user already has it at home. A pencil icon opens inline editing (qty / unit / rayon) without leaving the dialog.
- Two confirm buttons:
  - **"Ajouter à la liste"** — adds only checked, scaled ingredients to `personalList`. `recipes.json` untouched.
  - **"Ajouter + sauvegarder la recette"** — un-scales edited quantities back to per-serving, saves to `recipes.json`, then adds checked scaled ingredients to list. Sequential writes (recipe first); a recipe save failure aborts the list add.

#### Recipe editing

Each `RecipeCard` has a **"Modifier"** button. Clicking it opens the `RecipeImportPreview` form (tab 1) pre-filled with the recipe's current data. On confirm, `onUpdateRecipe` is called with the original `id` and `createdAt` preserved, overwriting the recipe in `recipes.json`.

`RecipeImportPreview` accepts optional `title` and `confirmLabel` props to adapt its header and button text for both the import and edit flows.
