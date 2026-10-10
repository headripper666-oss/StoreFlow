# Recipe Calories — Design Spec

**Date:** 2026-05-08  
**Status:** approved

---

## Objectif

Associer des calories à chaque ingrédient de recette, calculer les calories totales par personne, et les afficher dans l'app. La migration rétroactive des 146 recettes existantes a déjà été effectuée directement sur GitHub.

---

## 1. Types & données

### Champ ajouté

`RecipeIngredient` reçoit un champ optionnel (déjà présent dans `recipes.json` après migration) :

```ts
caloriesPerUnit?: number  // kcal pour 1 unité de cet ingrédient dans la recette
```

Exemples :
- `{ name: "Farine", quantity: 200, unit: "g", caloriesPerUnit: 3.6 }` → 720 kcal
- `{ name: "Oeuf", quantity: 2, unit: "pcs", caloriesPerUnit: 70 }` → 140 kcal

Aucun nouveau type nécessaire. `ParsedRecipe` hérite de `RecipeIngredient`, donc supporte déjà `caloriesPerUnit`.

### Utilitaire de calcul

Nouveau helper dans `src/utils/recipeUtils.ts` :

```ts
function computeRecipeCalories(
  ingredients: RecipeIngredient[],
  guests: number,
  baseServings: number
): number | null
```

- Retourne `null` si aucun ingrédient n'a de `caloriesPerUnit`
- Formule : `sum(ing.caloriesPerUnit * ing.quantity * guests / baseServings)` pour les ingrédients inclus
- Accepte un sous-ensemble d'ingrédients (pour exclure les décochés dans le dialog)

---

## 2. Hook `useRecipes`

Ajout d'une fonction, calquée sur `updateRecipeIngredientPrice` :

```ts
updateRecipeIngredientCalories: (name: string, caloriesPerUnit: number | undefined) => Promise<void>
```

Parcourt toutes les recettes, met à jour `caloriesPerUnit` sur tous les ingrédients dont le nom normalisé correspond. Sauvegarde dans `recipes.json` via GitHub.

Exposée dans `UseRecipesReturn`.

---

## 3. Affichage

### RecipeCard

Sous la ligne "N personnes · N ingrédients", ajouter (si calories disponibles) :

```
~470 kcal/pers
```

- Calculé avec `computeRecipeCalories(recipe.ingredients, recipe.servings, recipe.servings)`
- Style : `Typography variant="body2" color="text.secondary"` — même style que la ligne existante
- Masqué si `computeRecipeCalories` retourne `null`

### RecipeDetailPanel (desktop) & RecipeUsageDialog (mobile)

Sous le compteur d'invités, ligne recalculée en temps réel :

```
Total estimé : 1 880 kcal  ·  470 kcal/pers
```

- Recalculé à chaque changement de `guestCount`
- N'inclut que les ingrédients cochés (`included: true`)
- Masqué si aucune calorie disponible
- Style : `Typography variant="body2"`, couleur secondaire, aligné avec les autres infos

### Édition inline

Dans le panneau d'édition d'un ingrédient (crayon), ajouter un champ `kcal/unité` :

- Champ numérique optionnel, libellé "kcal/unité"
- Valeur vide = suppression du champ (`undefined`)
- Déclenche `updateRecipeIngredientCalories` à la confirmation
- Placé à côté du champ prix, même pattern UX

---

## 4. Mistral — nouvelles recettes

Dans `storeflow-proxy/server.js`, route `/api/parse-recipe` :

Ajouter dans le prompt système l'instruction :

> Pour chaque ingrédient, estime `caloriesPerUnit` : les kcal pour 1 unité de cet ingrédient tel qu'il est exprimé dans la recette (ex : 1g de farine = 3.6, 1 œuf = 70). Si inconnu, omets le champ.

Ajouter `caloriesPerUnit` dans le schéma JSON demandé à Mistral :

```json
{
  "name": "Farine",
  "quantity": 200,
  "unit": "g",
  "rayonId": "epicerie",
  "caloriesPerUnit": 3.6
}
```

Aucun changement côté app — le champ est déjà optionnel dans `RecipeIngredient`.

**Note :** les Netlify functions (`netlify/`) sont conservées dans le repo mais non utilisées en prod. Toutes les modifications Mistral se font dans `storeflow-proxy/server.js`.

---

## 5. Migration rétroactive

**Déjà effectuée** (2026-05-08) : les 146 recettes et 773 ingrédients ont été enrichis avec `caloriesPerUnit` directement via l'API GitHub. Commit : `feat: add caloriesPerUnit to all recipe ingredients` (SHA `57ce677`).

Aucune migration automatique au démarrage n'est nécessaire.

---

## 6. Fichiers à modifier

| Fichier | Modification |
|---|---|
| `src/types/index.ts` | Ajouter `caloriesPerUnit?: number` sur `RecipeIngredient` |
| `src/utils/recipeUtils.ts` | Ajouter `computeRecipeCalories()` |
| `src/hooks/useRecipes.ts` | Ajouter `updateRecipeIngredientCalories()` |
| `src/components/recipes/RecipeCard.tsx` | Afficher `~N kcal/pers` |
| `src/components/desktop/RecipeDetailPanel.tsx` | Afficher total + édition inline |
| `src/components/recipes/RecipeUsageDialog.tsx` | Afficher total (recalcul temps réel) |
| `storeflow-proxy/server.js` | Ajouter `caloriesPerUnit` dans le prompt Mistral |

---

## 7. Ce qui n'est PAS dans le scope

- Base nutritionnelle centralisée dans `products.json`
- Affichage des calories dans la liste de courses
- Objectifs caloriques ou suivi nutritionnel
- Macronutriments (protéines, lipides, glucides)
