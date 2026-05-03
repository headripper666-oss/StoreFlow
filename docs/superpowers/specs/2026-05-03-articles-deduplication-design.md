# Spec : Déduplication des articles dans Réglages > Articles

**Date** : 2026-05-03  
**Fichier cible** : `src/components/settings/ArticlesRayonManager.tsx`

## Problème

L'onglet Articles de la page Réglages affiche les sections "Indispensables" et "Liste personnelle" en itérant directement sur les tableaux bruts (`EssentialItem[]`, `ListItem[]`). Un même article (même nom, même rayon, même unité) peut donc apparaître plusieurs fois si plusieurs occurrences coexistent dans les données.

La section "Ingrédients de recettes" déduplique déjà par `normalize(name)` uniquement — ce critère est étendu pour être cohérent.

## Clé de déduplication

```
normalize(name) + "||" + rayonId + "||" + normalize(unit)
```

Les trois critères correspondent exactement à ce que l'utilisateur perçoit comme "le même article".

## Comportement par section

### Indispensables

Avant affichage, grouper les `EssentialItem[]` par clé de déduplication. Pour chaque groupe :
- Afficher une seule ligne (nom, unité, prix, rayon du premier élément).
- `onRayonChange(r)` → `Promise.all` sur tous les ids du groupe → `onUpdateEssentialRayon(id, r)`.
- `onPriceChange(p)` → `Promise.all` → `onUpdateEssentialPrice(id, p)`.
- `onUnitChange(u)` → `Promise.all` → `onUpdateEssentialUnit(id, u)`.
- Le compteur de l'accordéon reflète le nombre de groupes (pas d'occurrences brutes).

### Liste personnelle

Même logique avec `ListItem[]` et les callbacks `onUpdateListItem*`.  
Le `sublabel` "→ met aussi à jour catalogue" reste affiché si au moins un item du groupe a un match catalogue.

### Ingrédients de recettes

La clé passe de `normalize(name)` à `normalize(name) + "||" + rayonId + "||" + normalize(unit)`.  
Le `recipeCount` est la somme des occurrences dans tous les groupes ayant le même nom normalisé (comportement actuel inchangé visuellement).

### Catalogue

Pas de changement — les entrées catalogue ont un id unique, pas de doublons structurels.

## Implémentation

Tout dans `ArticlesRayonManager.tsx`, pas de nouveau fichier ni nouvelle prop.

Fonction utilitaire locale :

```ts
function dedupe<T>(
  items: T[],
  key: (item: T) => string
): { representative: T; ids: string[] }[]
```

Utilisée pour les deux sections (essentials et personalList). Les `ids` servent au `Promise.all` dans les callbacks.

## Ce qui ne change pas

- Les données stockées (GitHub) ne sont pas modifiées par cette feature.
- Le comportement des mutations reste identique — seul l'affichage est fusionné.
- L'UI de la ligne (`Row`) est inchangée.
