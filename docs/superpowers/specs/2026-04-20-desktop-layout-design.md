# Desktop Layout — Design Spec

**Date:** 2026-04-20  
**Status:** Approved, pending implementation

## Context

StoreFlow is currently mobile-first. Users also access it on desktop (including ultrawide screens). The goal is a proper desktop experience at ≥ 1024px while leaving the mobile interface completely untouched.

## Decisions

- **Layout:** Sidebar fixe (220px, labels toujours visibles) + double panneau redimensionnable
- **Split pages:** Indispensables|Liste, Recettes|Détail, Ajouter|Aperçu liste
- **Colonnes redimensionnables** via drag handle (largeurs mémorisées en localStorage)
- **Mobile:** interface actuelle inchangée (breakpoint `lg` = 1024px)

## Architecture

### Shell selection (`App.tsx`)

```tsx
const isDesktop = useMediaQuery(theme.breakpoints.up('lg')) // ≥ 1024px
return isDesktop
  ? <AppShellDesktop ...><Routes .../></AppShellDesktop>
  : <AppShell ...><Routes .../></AppShell>
```

### New files

| File                                        | Role                                        |
| ------------------------------------------- | ------------------------------------------- |
| `src/components/layout/AppShellDesktop.tsx` | Shell desktop : sidebar + zone contenu      |
| `src/components/layout/SidebarNav.tsx`      | Sidebar fixe 220px avec nav + sync + logout |
| `src/components/layout/SplitPane.tsx`       | Wrapper `react-resizable-panels` générique  |

### Modified files

| File                                 | Change                                              |
| ------------------------------------ | --------------------------------------------------- |
| `src/App.tsx`                        | +`useMediaQuery`, choix du shell                    |
| `src/pages/RecipesPage.tsx`          | +`selectedRecipe` state, panneau droit conditionnel |
| `src/components/layout/AppShell.tsx` | Masquer `BottomNav` sur `lg+`                       |

### New dependency

`react-resizable-panels` (~6kb gzippé) — drag handle natif, largeurs mémorisées.

## Shell layout

```
┌─────────────────────────────────────────────┐
│  SidebarNav (220px fixe)  │  Contenu         │
│                           │                  │
│  🛒 StoreFlow             │  (split ou plein │
│                           │   selon la page) │
│  ✅ Indispensables        │                  │
│  🛍 Ma Liste              │                  │
│  ➕ Ajouter               │                  │
│  📖 Recettes              │                  │
│  ─────────────────        │                  │
│  🔧 Rayons                │                  │
│                           │                  │
│  ● Sync  [Déconnexion]    │  ← en bas        │
└─────────────────────────────────────────────┘
```

- Pas de top AppBar sur desktop — logo, sync status et logout dans la sidebar (en bas)
- Sidebar utilise MUI `Drawer` en mode `permanent`
- `BottomNav` masquée via `display: { xs: 'flex', lg: 'none' }` dans AppShell mobile

## Split pane pages

### `/essentials` → Indispensables | Ma Liste

Panneaux 50/50 par défaut. Les deux listes sont visibles simultanément. Cliquer "Ma Liste" dans la sidebar navigue vers `/list` (panneaux inversés, même split).

### `/recipes` → Liste recettes | Détail

- Panneau gauche : liste des `RecipeCard`
- Panneau droit : détail de la recette sélectionnée (compteur guests, checkboxes ingrédients, boutons d'action)
- `RecipeUsageDialog` **n'est pas utilisé sur desktop** — le panneau droit le remplace
- `RecipeUsageDialog` reste intact pour mobile
- `RecipesPage` reçoit un état local `selectedRecipe: Recipe | null`

### `/add` → Formulaire | Aperçu liste

- Panneau gauche : formulaire actuel (paste texte + ajout manuel)
- Panneau droit : liste `personalList` en lecture seule, mise à jour après confirmation

## SplitPane component

```tsx
<SplitPane
  storageKey="storeflow-split-essentials"
  defaultSizes={[50, 50]}
  minSize={250}
>
  <PanelLeft>...</PanelLeft>
  <PanelRight>...</PanelRight>
</SplitPane>
```

Largeurs mémorisées par clé :

- `storeflow-split-essentials`
- `storeflow-split-recipes`
- `storeflow-split-add`

## Data flow

Aucun hook ne change. `useShoppingList` et `useRecipes` restent dans `App.tsx` et passent leurs données aux pages comme avant.

Seul changement d'état : `RecipesPage` gère un état local `selectedRecipe` pour piloter le panneau droit sans dialog.

## Pages sans split

`/rayons` (RayonSettingsPage) et `LoginPage` : contenu pleine largeur, pas de split.
