# Recipe Categories & Search — Design Spec

**Date:** 2026-04-20  
**Status:** Approved

## Contexte

Les recettes sont actuellement affichées en liste plate dans `RecipesPage`. Avec un grand nombre de recettes, il devient difficile de s'y retrouver. L'objectif est d'ajouter des catégories et une recherche pour filtrer rapidement.

---

## 1. Modèle de données

### Nouveau type `RecipeCategory`

```typescript
// src/types/index.ts
export type RecipeCategory =
  | "poulet"
  | "boeuf"
  | "porc"
  | "agneau"
  | "poisson"
  | "vegetarien"
  | "pates"
  | "soupe"
  | "oeufs"
  | "dessert"
  | "autre";
```

### Modification de `Recipe`

```typescript
export interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  createdAt: string;
  category?: RecipeCategory; // optionnel pour rétrocompatibilité
}
```

Le champ est optionnel : les recettes sans catégorie affichent "Autre" sans casser les données existantes dans `recipes.json`.

---

## 2. Auto-détection par mots-clés

### Fonction `detectCategory(recipe: Recipe | ParsedRecipe): RecipeCategory`

Fichier : `src/utils/recipeUtils.ts`

Analyse le nom de la recette + les noms des ingrédients (tout en minuscules, accents normalisés). Teste les catégories dans cet ordre de priorité :

| Catégorie    | Mots-clés déclencheurs |
|-------------|------------------------|
| `poulet`    | poulet, dinde, canard, volaille |
| `boeuf`     | bœuf, boeuf, steak, veau, bifteck, entrecôte |
| `porc`      | porc, jambon, lardons, lardon, saucisse, chorizo, bacon |
| `agneau`    | agneau, mouton |
| `poisson`   | saumon, thon, cabillaud, crevette, moule, poisson, merlu, sardine |
| `oeufs`     | œuf, oeuf, quiche, omelette |
| `soupe`     | soupe, potage, velouté, veloute, bouillon |
| `dessert`   | gâteau, gateau, tarte, crêpe, crepe, chocolat, brownie, cookie |
| `pates`     | pâtes, pates, spaghetti, riz, risotto, nouilles, tagliatelle, fettuccine |
| `vegetarien`| aucun ingrédient viande/poisson détecté (fallback si rien d'autre ne matche) |
| `autre`     | fallback final |

**Appelée :**
- À l'import IA (`parse-recipe.mts` ou après confirmation dans `RecipeImportPreview`)
- À la création manuelle (dans `RecipeImportPreview` au moment du `onConfirm`)

**Jamais ré-appliquée** automatiquement après la première assignation.

---

## 3. UI — RecipesPage (onglet "Mes recettes")

### Ordre des éléments

```
[ 🔍 Rechercher une recette...    ✕ ]
[ Toutes ][ 🐔 Poulet ][ 🥩 Bœuf ] →  (chips défilants)

[ RecipeCard ]
[ RecipeCard ]
...
```

### Barre de recherche

- `TextField` MUI compact, fullWidth
- Icône `SearchIcon` en `startAdornment`
- Icône `ClearIcon` en `endAdornment`, visible seulement si texte non vide
- Filtre en temps réel sur `recipe.name` + `recipe.ingredients[].name` (insensible à la casse et aux accents)

### Chips de catégories

- `Box` avec `display: flex`, `overflowX: auto`, `gap: 1`, `pb: 0.5`
- Premier chip : "Toutes" (sélectionné par défaut)
- Un chip par catégorie ayant **au moins une recette** dans la liste complète (les catégories vides n'apparaissent pas)
- Chip actif : `variant="filled"`, couleur `primary`
- Chip inactif : `variant="outlined"`
- Labels avec emoji : `🐔 Poulet`, `🥩 Bœuf`, `🐷 Porc`, `🐑 Agneau`, `🐟 Poisson`, `🥦 Végétarien`, `🍝 Pâtes & riz`, `🥣 Soupes`, `🥚 Œufs`, `🍰 Desserts`, `🌍 Autre`

### Logique de filtrage

Les deux filtres se cumulent :

```typescript
const filtered = recipes
  .filter(r => categoryFilter === "all" || (r.category ?? "autre") === categoryFilter)
  .filter(r => {
    if (!searchQuery) return true;
    const q = normalize(searchQuery);
    return normalize(r.name).includes(q)
      || r.ingredients.some(i => normalize(i.name).includes(q));
  });
```

### État vide

Si `filtered.length === 0` et qu'un filtre est actif :  
Message "Aucune recette trouvée" + bouton "Effacer les filtres" (reset recherche + catégorie).

---

## 4. RecipeCard — Badge catégorie modifiable

### Affichage

- Petit `Chip` MUI sous le titre, avec emoji + label de la catégorie
- `size="small"`, `variant="outlined"`
- Cliquable (curseur pointer)

### Interaction

- Tap → ouvre un `Menu` MUI avec les 11 catégories listées (emoji + label)
- Sélection → appelle `onUpdateRecipe({ ...recipe, category: newCategory })`
- Pendant la sauvegarde : chip désactivé + `CircularProgress` size 12 à la place de l'emoji

### Props ajoutées à `RecipeCard`

```typescript
interface RecipeCardProps {
  recipe: Recipe;
  onUse: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onUpdateCategory: (recipe: Recipe, category: RecipeCategory) => void;
  disabled?: boolean;
  isSavingCategory?: boolean;
}
```

---

## 5. Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/types/index.ts` | Ajout de `RecipeCategory`, champ `category?` sur `Recipe` |
| `src/utils/recipeUtils.ts` | Ajout de `detectCategory()` |
| `src/components/recipes/RecipeCard.tsx` | Badge catégorie + menu de modification |
| `src/components/recipes/RecipeImportPreview.tsx` | Appel `detectCategory()` avant `onConfirm` |
| `src/pages/RecipesPage.tsx` | Barre de recherche + chips filtre + logique de filtrage |

---

## 6. Hors scope

- Migration automatique des recettes existantes sans catégorie (elles restent `undefined` → affichées comme "Autre", modifiables manuellement)
- Catégories multiples par recette
- Ordre personnalisé des catégories
