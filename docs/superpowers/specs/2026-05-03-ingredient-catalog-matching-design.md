# Spec : Matching catalog pour les ingrédients de recettes

**Date** : 2026-05-03  
**Fichiers cibles** :
- `src/utils/recipeUtils.ts`
- `src/components/recipes/RecipeImportPreview.tsx`
- `src/pages/RecipesPage.tsx`
- `src/components/desktop/RecipeDetailPanel.tsx` (alignement mineur)

---

## Objectif

Améliorer l'ajout d'ingrédients dans les recettes en deux volets :
1. **Ajout manuel** : autocomplete sur le catalog avec résolution automatique unité+prix.
2. **Ajout par IA** : matching automatique des ingrédients parsés contre le catalog, avec indication visuelle et proposition de substitution pour les inconnus.

---

## Utilitaire partagé : `findInCatalog`

Nouvelle fonction dans `src/utils/recipeUtils.ts` :

```ts
export function findInCatalog(
  name: string,
  catalog: CatalogProduct[],
): CatalogProduct | null
```

Logique de matching (ordre de priorité) :
1. `normalize(name) === normalize(p.name)` — match exact sur le nom
2. `normalize(name) === normalize(alias)` pour chaque alias de chaque produit

Retourne le premier produit matchant, ou `null`.

Cette fonction remplace le `catalog.find()` inline dans `RecipeDetailPanel.handleCatalogSelect` (alignement, pas un refactor fonctionnel).

---

## Volet 1 — Ajout manuel (RecipeImportPreview)

### Nouvelle prop

```ts
catalog: CatalogProduct[]  // ajoutée à RecipeImportPreviewProps
```

Passée depuis `RecipesPage` (qui reçoit déjà `catalog` depuis `App.tsx`).

### Comportement

Le champ "Ingrédient" du formulaire d'ajout manuel devient un `Autocomplete freeSolo` :
- `options` : `catalog.map(c => c.name)`, triés alphabétiquement
- Quand l'utilisateur sélectionne une entrée catalog (événement `onChange` avec valeur non-null) → `findInCatalog` → auto-remplit `unit` (depuis `defaultUnit`) et `price` (depuis `pricePerUnit`)
- Quand l'utilisateur tape librement (`freeSolo`) → aucun remplissage automatique, comportement actuel

---

## Volet 2 — Ajout par IA (RecipeImportPreview)

### Type interne `CatalogStatus`

```ts
type CatalogStatus =
  | { kind: "matched"; product: CatalogProduct }
  | { kind: "suggested"; product: CatalogProduct }
  | { kind: "unmatched" }
  | { kind: "ignored" }
```

### Initialisation

Au montage du composant (dans `useState` initializer pour `ingredients`), chaque ingrédient parsé passe par la logique suivante :

```
findInCatalog(ing.name, catalog)
  → trouvé  : status = "matched", unit = product.defaultUnit, pricePerUnit = product.pricePerUnit
  → non trouvé : chercher si un alias d'un produit catalog matche ing.name
                 → trouvé  : status = "suggested", product = le produit catalog avec cet alias
                 → non trouvé : status = "unmatched"
```

Le matching inverse pour "suggested" : pour chaque produit du catalog, vérifier si `normalize(ing.name)` apparaît dans ses `aliases`.

### État local étendu

Le tableau `ingredients` local (type `RecipeIngredient[]`) est étendu avec un champ `catalogStatus: CatalogStatus` non exporté — il disparaît au `onConfirm`.

### Affichage dans la liste d'ingrédients

Chaque ligne d'ingrédient affiche un indicateur à droite du nom :

| Status | Indicateur |
|--------|-----------|
| `matched` | Icône ✓ verte (`CheckCircleIcon`, `color="success"`) |
| `suggested` | Bannière jaune sous le nom : *"Voulez-vous dire **[nom produit]** ?"* + bouton **Oui** + bouton **Ignorer** |
| `unmatched` | Icône ⚠️ (`WarningAmberIcon`, `color="warning"`) |
| `ignored` | Aucun indicateur |

### Actions utilisateur sur "suggested"

- **Oui** : remplace `name` par `product.name`, `unit` par `product.defaultUnit`, `pricePerUnit` par `product.pricePerUnit`, `status` → `"matched"`
- **Ignorer** : `status` → `"ignored"`, la bannière disparaît

### Ce qui ne change pas

- La structure finale sauvegardée (`Recipe`) est inchangée — `catalogStatus` est purement local.
- Les ingrédients en mode édition ligne (`editingIdx`) ne sont pas affectés par cette logique.
- Le comportement du bouton "Sauvegarder" est inchangé.

---

## Alignement RecipeDetailPanel

`handleCatalogSelect` utilise actuellement `catalog.find((c) => c.name === value)`. Remplacer par `findInCatalog(value, catalog)` pour bénéficier du matching par aliases. Pas d'autre changement.

---

## Ce qui ne change pas

- Types `Recipe`, `RecipeIngredient`, `ParsedRecipe` dans `index.ts` : inchangés.
- `useRecipes.ts` : inchangé.
- `RecipeUsageDialog` (mobile) : inchangé — ce composant gère l'utilisation d'une recette existante, pas la création.
- `RecipeDetailPanel` en mode normal (hors édition) : inchangé.
