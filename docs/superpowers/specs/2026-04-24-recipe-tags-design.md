# Recipe Tags — Design Spec
_2026-04-24_

## Objectif

Remplacer le système de catégorie unique par un système de tags multiples sur les recettes. Chaque recette peut avoir plusieurs tags libres (ex : "pâtes" et "porc" sur la même recette).

---

## 1. Modèle de données

### Avant
```typescript
export type RecipeCategory =
  | "poulet" | "boeuf" | "porc" | "agneau" | "poisson"
  | "vegetarien" | "pates" | "soupe" | "oeufs" | "dessert" | "autre";

export interface Recipe {
  // ...
  category?: RecipeCategory;
}
```

### Après
```typescript
export interface Recipe {
  // ...
  tags?: string[];   // remplace category
}
// RecipeCategory supprimé
```

Les tags sont des strings libres, sans enum. Les tags initiaux (issus de la migration des categories existantes) conservent les mêmes valeurs : `"poulet"`, `"pates"`, `"porc"`, etc.

---

## 2. Migration des données existantes

### 2a. Migration silencieuse au chargement
Dans `useRecipes.ts`, après le fetch GitHub, pour chaque recette :

```typescript
if (!recipe.tags && recipe.category) {
  recipe.tags = [recipe.category];
  delete (recipe as any).category;
}
```

La prochaine sauvegarde de cette recette écrit `tags` sans `category`.

### 2b. Migration rétroactive (premier lancement post-déploiement)
Un flag `storeflow_tags_migrated_v1` en `localStorage` contrôle une passe unique :

1. Au chargement, si le flag est absent : re-calculer les tags de TOUTES les recettes via `detectTags` et les **fusionner** (union) avec les tags déjà présents — jamais écraser
2. Sauvegarder l'ensemble des recettes sur GitHub
3. Écrire le flag en localStorage

L'utilisateur voit un indicateur de chargement standard pendant la sauvegarde.

---

## 3. Auto-détection des tags (`detectTags`)

Fichier : `src/utils/recipeUtils.ts`

### Signature
```typescript
function detectTags(recipe: Recipe, knownTags: string[]): string[]
```

### Deux niveaux combinés (union, sans doublon)

**Niveau 1 — Synonymes** (liste codée en dur, conservée de `detectCategory`) :
Mots-clés dans le nom ou les ingrédients → tag.
Exemples :
- `"lardons"`, `"jambon"`, `"bacon"`, `"saucisse"` → `"porc"`
- `"spaghetti"`, `"tagliatelles"`, `"rigatoni"`, `"lasagne"` → `"pates"`
- `"dinde"`, `"pintade"` → `"poulet"`
- etc.

**Niveau 2 — Correspondance directe** :
Pour chaque tag dans `knownTags`, vérifier si le tag apparaît (insensible à la casse, accents normalisés) dans :
- Le nom de la recette
- Le nom de chaque ingrédient

Exemple : tag `"riz"` ∈ knownTags + ingrédient `"riz basmati"` → tag `"riz"` ajouté.

### `knownTags` au moment de l'appel
Lors de la migration rétroactive : union de tous les tags présents dans les recettes après migration 2a + liste des categories prédéfinies comme seed.

Lors de l'import d'une nouvelle recette : même union, calculée depuis les recettes existantes.

---

## 4. Interface utilisateur

Les composants existants utilisent MUI — les modifications respectent le style MUI actuel du projet (palette, typography, spacing).

### 4a. Champ d'édition des tags (style Gmail)

Utilisé dans : `RecipeImportPreview`, `RecipeUsageDialog`, `RecipeDetailPanel`.

Composant MUI : `Autocomplete` avec `multiple`, `freeSolo`, `renderTags` (chips MUI).

Comportement :
- Les tags existants de la recette s'affichent comme chips MUI avec bouton ×
- La saisie filtre les tags connus de toutes les recettes (autocomplétion)
- Entrée ou virgule valide un nouveau tag
- Créer un tag inexistant est autorisé (freeSolo)

### 4b. Barre de filtres (multi-sélection)

Fichier : `RecipesPage.tsx`

- La barre affiche uniquement les tags présents sur au moins une recette (calculé dynamiquement)
- Un chip "Tous" en premier position — actif par défaut, efface tous les filtres
- Plusieurs chips peuvent être actifs simultanément
- Logique de filtre : **OU** — une recette est affichée si elle possède au moins un des tags actifs

```typescript
const filteredRecipes = useMemo(() => {
  return recipes
    .filter(r =>
      activeTags.length === 0 ||
      (r.tags ?? []).some(t => activeTags.includes(t))
    )
    .filter(/* recherche texte existante */);
}, [recipes, activeTags, searchQuery]);
```

State : `activeTags: string[]` (remplace `categoryFilter: RecipeCategory | "all"`).

---

## 5. Persistance

Aucun changement dans `github.ts` ni dans la structure du fichier `recipes.json`. Les tags sont un champ JSON standard dans chaque objet recette. Le SHA et la logique de sauvegarde atomique restent inchangés.

---

## 6. Fichiers modifiés

| Fichier | Nature du changement |
|---|---|
| `src/types/index.ts` | Supprimer `RecipeCategory`, modifier `Recipe.category` → `Recipe.tags` |
| `src/utils/recipeUtils.ts` | Remplacer `detectCategory` par `detectTags(recipe, knownTags)` |
| `src/hooks/useRecipes.ts` | Migration silencieuse au chargement + migration rétroactive one-shot |
| `src/pages/RecipesPage.tsx` | `categoryFilter` → `activeTags[]`, logique filtre OU, barre multi-select |
| `src/components/recipes/RecipeImportPreview.tsx` | Champ tags MUI Autocomplete |
| `src/components/recipes/RecipeUsageDialog.tsx` | Champ tags MUI Autocomplete |
| `src/components/desktop/RecipeDetailPanel.tsx` | Champ tags MUI Autocomplete |
| `src/components/recipes/RecipeCard.tsx` | Affichage chips tags (lecture seule) |
