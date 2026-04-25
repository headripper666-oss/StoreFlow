# Recipe Usage UX Redesign

**Date:** 2026-04-20  
**Status:** Approved

## Problem

Using a recipe to populate the shopping list requires too many steps:

1. Click "Utiliser" on a RecipeCard
2. Dialog step 1 — choose number of guests → click "Voir les ingrédients"
3. Dialog step 2 — review/edit ingredients → confirm

That's 3 screens for an action that should be fast. There is also no way to quickly exclude an ingredient the user already has at home — the current inline editing is too heavy for that use case.

## Design

### Single unified dialog

Replace the two-step dialog (`step: "count" | "ingredients"`) with a single screen containing:

1. **Guest count selector** (top) — `−` / value / `+` buttons, with a hint showing the base serving count and the scale ratio (e.g. "Base : 4 — quantités ×1.5"). Changing the count rescales all ingredient quantities in real time.

2. **Ingredient list** (middle, scrollable) — each row shows:
   - A **checkbox** (checked by default). Tapping a row toggles it. Unchecked rows are grayed out with strikethrough name and are excluded from the add.
   - Name + quantity + unit + rayon chip.
   - A small **✏ edit icon** (secondary action) that opens the existing inline edit form (name / qty / unit / rayon) for fine-grained adjustments.
   - A live count badge above the list: "N / total ingrédients sélectionnés".

3. **Two confirm buttons** (bottom):
   - **"Ajouter à la liste"** (primary, filled) — adds only checked, scaled ingredients to `personalList`. Shows the count of selected ingredients. Does not modify `recipes.json`.
   - **"Ajouter + sauvegarder la recette"** (secondary, outlined) — un-scales edited quantities back to per-serving base, saves to `recipes.json`, then adds checked scaled ingredients to `personalList`. Sequential writes (recipe first; abort list add on failure).

### What changes

| Before                                   | After                                        |
| ---------------------------------------- | -------------------------------------------- |
| Dialog step 1: guest count only          | Single dialog: guest count + ingredient list |
| Click "Voir les ingrédients" to proceed  | No intermediate button                       |
| Dialog step 2: ingredient list + confirm | Merged into same screen                      |
| No way to exclude an ingredient          | Checkbox per ingredient (checked by default) |
| Edit icon opens full inline form         | Same behavior, now secondary/optional        |

The `step` state machine in `RecipeUsageDialog` is removed. The component initializes directly with the scaled ingredient list (same scaling logic as `handleGoToIngredients`), each ingredient tracked with an additional `included: boolean` field (local to the dialog, not persisted).

### Out of scope

- Reordering ingredients
- Saving which ingredients were excluded (exclusions are per-use, not persisted)
- Swipe-to-dismiss on ingredient rows (checkbox tap is sufficient)

## Files to change

| File                                           | Change                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/components/recipes/RecipeUsageDialog.tsx` | Full rewrite: remove step machine, add checkbox state, real-time scaling        |
| `src/pages/RecipesPage.tsx`                    | No interface change needed — `onAddToList` and `onUpdateRecipe` props unchanged |
