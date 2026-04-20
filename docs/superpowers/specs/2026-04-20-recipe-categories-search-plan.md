# Recipe Categories & Search — Implementation Plan

**Spec:** `2026-04-20-recipe-categories-search-design.md`  
**Date:** 2026-04-20

## Steps

### Step 1 — Types (`src/types/index.ts`)

- Add `RecipeCategory` union type (11 values)
- Add optional `category?: RecipeCategory` field to `Recipe`

### Step 2 — Detection utility (`src/utils/recipeUtils.ts`)

- Add `CATEGORY_LABELS` constant: maps `RecipeCategory` → `{ emoji, label }`
- Add `detectCategory(recipe: Pick<Recipe, "name" | "ingredients">): RecipeCategory`
  - Normalize name + ingredient names (lowercase, no accents)
  - Test keywords in priority order (see spec table)
  - Return `"vegetarien"` if no meat/fish found, `"autre"` as final fallback

### Step 3 — RecipeCard (`src/components/recipes/RecipeCard.tsx`)

- Add props: `onUpdateRecipe`, `isSavingCategory`
- Add `categoryMenuAnchor` state for MUI Menu
- Render category `Chip` under recipe name (emoji + label from `CATEGORY_LABELS`)
  - Shows spinner when `isSavingCategory`
  - Opens Menu on click
- Menu lists all 11 categories; selecting one calls `onUpdateRecipe({ ...recipe, category })`

### Step 4 — RecipeImportPreview (`src/components/recipes/RecipeImportPreview.tsx`)

- Call `detectCategory(parsed)` inside `onConfirm` handler before passing recipe to parent
- Inject category into the `Recipe` object passed to `onSaveRecipe`

### Step 5 — RecipesPage (`src/pages/RecipesPage.tsx`)

- Add state: `searchQuery`, `categoryFilter`, `savingCategoryId`
- Add `handleUpdateCategory(recipe, category)` → sets `savingCategoryId`, calls `onUpdateRecipe`, clears id
- Add `normalize` helper (lowercase + NFD accent strip)
- Compute `filteredRecipes` from `recipes` using both filters
- Compute `availableCategories` (deduplicate from recipes, preserve order of `RecipeCategory` union)
- Render above recipe list:
  1. `TextField` with SearchIcon + ClearIcon adornments
  2. Horizontal scrollable `Box` of `Chip`s (Toutes + available categories)
- Pass `onUpdateRecipe` and `isSavingCategory` to each `RecipeCard`
- Show "Aucune recette trouvée" + "Effacer les filtres" button when `filteredRecipes.length === 0` and a filter is active

### Step 6 — Build check

- Run `npm run build` and fix any TypeScript errors
