# Spec — Écran Réglages / Gestion des données

**Date :** 2026-04-26  
**Statut :** Approuvé

---

## Objectif

Remplacer l'entrée "Rayons" de la navigation par "Réglages", un écran à 3 onglets permettant :
1. Gérer l'ordre/nom/icône des rayons (contenu actuel de RayonSettingsPage)
2. Renommer ou supprimer des tags de recettes globalement
3. Modifier le rayon de n'importe quel article, toutes sources confondues

---

## Navigation

- L'entrée "Rayons" dans `BottomNav` et `SidebarNav` devient **"Réglages"** (label + icône `SettingsIcon` ou conserver `TuneIcon`)
- Route : `/rayons` conservée (pas de migration de route nécessaire)
- `RayonSettingsPage` devient le contenu de l'onglet "Rayons" dans le nouvel écran

---

## Structure de la page

```
SettingsPage  (route /rayons)
├── Tab 0 — Rayons        (contenu actuel de RayonSettingsPage, inchangé)
├── Tab 1 — Tags          (gestion globale des tags de recettes)
└── Tab 2 — Articles      (gestion des rayons de tous les articles)
```

Props reçues par `SettingsPage` :
```ts
{
  // Rayons tab (existant)
  rayons: Rayon[]
  isSaving: boolean
  onSave: (rayons: Rayon[]) => Promise<void>

  // Tags tab
  recipes: Recipe[]
  isSavingRecipes: boolean
  onRenameTag: (oldTag: string, newTag: string) => Promise<void>
  onDeleteTag: (tag: string) => Promise<void>

  // Articles tab
  essentials: EssentialItem[]
  personalList: ListItem[]
  catalog: CatalogProduct[]
  onUpdateEssentialRayon: (id: string, rayonId: string) => Promise<void>       // useShoppingList
  onUpdateRecipeIngredientRayon: (name: string, rayonId: string) => Promise<void> // useRecipes (modifie recipes.json)
  onUpdateListItemRayon: (id: string, rayonId: string) => Promise<void>        // useShoppingList + cascade catalog
  onUpdateCatalogProductRayon: (id: string, rayonId: string) => Promise<void>  // useShoppingList
}
```

---

## Onglet 0 — Rayons

Contenu identique à l'actuelle `RayonSettingsPage`, monté tel quel comme composant enfant. Aucun changement fonctionnel.

---

## Onglet 1 — Tags

### Affichage
- Liste de tous les tags : union de `DEFAULT_TAGS` + tags présents dans au moins une recette
- Chaque ligne : nom du tag | badge "N recette(s)" | bouton renommer | bouton supprimer
- Tags de `DEFAULT_TAGS` sans aucune recette associée : affichés en grisé, bouton supprimer désactivé (ce sont des suggestions, pas des données)

### Renommer
- Tap sur le nom ou sur l'icône crayon → champ texte inline avec valeur pré-sélectionnée
- Validation par Entrée ou perte de focus
- Action : remplace `oldTag` par `newTag` dans le tableau `tags` de chaque recette qui le contient → sauvegarde `recipes.json`
- Si `newTag` existe déjà : fusion (les recettes qui avaient l'ancien tag se retrouvent avec le nouveau, sans doublon)

### Supprimer
- Icône poubelle → dialog de confirmation : "Supprimer le tag X de N recette(s) ?"
- Action : retire le tag du tableau `tags` de chaque recette → sauvegarde `recipes.json`

### Nouvelles mutations requises dans `useRecipes`
```ts
renameTag(oldTag: string, newTag: string): Promise<void>
deleteTag(tag: string): Promise<void>
```

---

## Onglet 2 — Articles

### Affichage
- Barre de recherche filtrante (nom d'article, insensible à la casse et aux accents)
- 4 sections accordéon repliables, chacune avec compteur :
  - 🔖 **Indispensables** — `essentials[]`
  - 📖 **Ingrédients de recettes** — noms d'ingrédients uniques, toutes recettes confondues
  - 🛍 **Liste personnelle** — `personalList[]` (articles actuellement dans la liste)
  - 📦 **Catalogue** — `catalog[]`

- Chaque ligne : nom de l'article | `Select` MUI pour choisir le rayon
- Sauvegarde immédiate à chaque changement de rayon (pas de bouton global)

### Ingrédients de recettes — déduplication et conflits

Un même nom d'ingrédient peut apparaître dans plusieurs recettes avec des rayons différents.

**Rayon affiché (priorité décroissante) :**
1. Rayon de l'essentiel portant le même nom normalisé (déclaration manuelle)
2. Rayon du produit catalogue portant le même nom ou alias (déclaration manuelle)
3. Rayon majoritaire parmi toutes les occurrences dans les recettes

**Indicateur de conflit :** si les recettes ne sont pas uniformes sur ce rayon, afficher "⚠ X recettes" en badge orange. Changer le rayon dans cet écran propage la valeur à toutes les recettes contenant cet ingrédient (normalisation par nom).

**Normalisation :** `name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")` — même fonction `normalize()` que dans `RecipesPage` et `useShoppingList`.

**Action :** `onUpdateRecipeIngredientRayon(name, newRayonId)` (dans `useRecipes`) → normalise le nom, parcourt toutes les recettes, met à jour chaque ingrédient dont le nom normalisé correspond, sauvegarde `recipes.json`.

### Liste personnelle — cascade catalogue

Changer le rayon d'un article de la liste personnelle :
1. Met à jour `rayonId` de l'item dans `personalList`
2. Si un produit catalogue a le même nom normalisé → met aussi à jour son `rayonId` dans `products.json`

### Catalogue — sauvegarde

`products.json` est actuellement chargé en lecture seule. Ajouts nécessaires :
- `saveCatalog(config, products, sha)` dans `github.ts` (même pattern que `saveShoppingData` : PUT avec SHA pour détecter les conflits)
- `catalogShaRef` dans `useShoppingList` pour tracker le SHA de `products.json`
- `updateCatalogProductRayon` exposé par `useShoppingList`

---

## Nouvelles fonctions GitHub requises

```ts
// github.ts
saveCatalog(config: AuthConfig, products: CatalogProduct[], sha: string): Promise<string>
```

---

## Nouvelles mutations requises dans `useRecipes`

```ts
renameTag(oldTag: string, newTag: string): Promise<void>
deleteTag(tag: string): Promise<void>
updateRecipeIngredientRayon(name: string, rayonId: string): Promise<void>
```

## Nouvelles mutations requises dans `useShoppingList`

```ts
updateCatalogProductRayon(id: string, rayonId: string): Promise<void>
updateListItemRayon(id: string, rayonId: string): Promise<void>
// cascade : si nom normalisé de l'item correspond à un produit catalogue → appelle aussi updateCatalogProductRayon
```

---

## Composants à créer

| Composant | Rôle |
|---|---|
| `src/pages/SettingsPage.tsx` | Page principale avec les 3 onglets |
| `src/components/settings/TagsManager.tsx` | Contenu de l'onglet Tags |
| `src/components/settings/ArticlesRayonManager.tsx` | Contenu de l'onglet Articles |

`RayonSettingsPage` est réutilisé tel quel dans l'onglet 0, sans modification.

---

## Ce qui ne change pas

- `RayonSettingsPage` : aucune modification fonctionnelle
- Route `/rayons` : conservée
- Le résolveur `resolveRayonId` dans `RecipesPage` : inchangé (priorité essentiels > catalogue > IA)
- Toute la logique de sync GitHub (ETag, SHA, optimistic update) : héritée des hooks existants
