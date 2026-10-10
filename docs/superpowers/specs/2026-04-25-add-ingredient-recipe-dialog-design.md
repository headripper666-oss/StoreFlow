# Ajout d'ingrédient inline dans le dialogue recette

**Date :** 2026-04-25
**Statut :** Approuvé

## Contexte

`RecipeUsageDialog` (mobile) et `RecipeDetailPanel` (desktop) permettent d'utiliser une recette pour préparer une liste de courses. Actuellement, seuls les ingrédients déjà présents dans la recette sont affichés. L'utilisateur ne peut pas ajouter un ingrédient manquant (ex. : épinards non prévus dans la recette) sans quitter le dialogue.

## Objectif

Ajouter un formulaire inline expansible en bas de la liste d'ingrédients, permettant d'ajouter un ingrédient supplémentaire avec autocomplétion depuis le catalogue. L'ingrédient ajouté se comporte comme les autres : coché par défaut, éditable au crayon, inclus ou exclu de l'ajout à la liste.

## UX

### État replié (par défaut)

Bouton texte `＋ Ajouter un ingrédient` affiché sous la liste d'ingrédients.

### État déplié (après clic)

```
[ Autocomplete nom ────────────────── ]
[ Qté ]  [ Unité ]  [ Rayon ▼        ]
[ Valider ]  [ Annuler ]
```

### Pré-remplissage depuis le catalogue

Quand l'utilisateur sélectionne un article connu dans l'autocomplete :
- **Unité** ← `CatalogProduct.defaultUnit`
- **Rayon** ← `CatalogProduct.rayonId`
- **Qté** ← 1 (toujours, la quantité est personnelle au contexte)

Article libre (non dans le catalogue) → qté=1, unité="pcs", premier rayon de la liste.

### Validation

- Nom non vide
- Quantité > 0
- Pas de blocage si doublon de nom — l'utilisateur peut décocher l'un des deux

### Après validation

L'ingrédient est ajouté en fin de liste `ingredients` (état local), coché par défaut (`included: true`). Le formulaire se referme et ses champs se vident. Le compteur "X/Y sélectionnés" se met à jour.

## Comportement avec les boutons de confirmation

L'ingrédient ajouté inline se comporte exactement comme les ingrédients de base de la recette :

| Bouton | Comportement |
|---|---|
| **Ajouter à la liste** | L'ingrédient est ajouté à `personalList`. La recette n'est pas modifiée. |
| **Ajouter + sauvegarder** | La quantité est désajustée (`qty / scale`) avant sauvegarde dans `recipes.json`, puis l'ingrédient est ajouté à `personalList`. |

## Architecture

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/App.tsx` | Passe `catalog` en prop à `RecipesPage` |
| `src/pages/RecipesPage.tsx` | Accepte et forward `catalog` à `RecipeUsageDialog` |
| `src/components/recipes/RecipeUsageDialog.tsx` | Prop `catalog` + état formulaire + UI expandable |
| `src/components/desktop/RecipeDetailPanel.tsx` | Prop `catalog` + état formulaire + UI expandable |

### Nouveau state local (identique dans les deux composants)

```typescript
const [addOpen, setAddOpen] = useState(false);
const [newName, setNewName] = useState("");
const [newQty, setNewQty] = useState(1);
const [newUnit, setNewUnit] = useState("pcs");
const [newRayonId, setNewRayonId] = useState(defaultRayonId);
```

### Logique de pré-remplissage

```typescript
const handleCatalogSelect = (_: unknown, value: string | null) => {
  const found = catalog.find((c) => c.name === value);
  setNewName(value ?? "");
  if (found) {
    setNewUnit(found.defaultUnit);
    setNewRayonId(found.rayonId);
  }
};
```

### Ajout à la liste d'ingrédients

```typescript
const handleAddIngredient = () => {
  if (!newName.trim() || newQty <= 0) return;
  setIngredients((prev) => [
    ...prev,
    { name: newName.trim(), quantity: newQty, unit: newUnit, rayonId: newRayonId, included: true },
  ]);
  setAddOpen(false);
  setNewName("");
  setNewQty(1);
  setNewUnit("pcs");
  setNewRayonId(defaultRayonId);
};
```

### Reset à l'ouverture du dialogue / changement de recette

Le formulaire est réinitialisé en même temps que les ingrédients (dans `handleEnter` pour le dialog, dans le `useEffect([recipe?.id])` pour le panel).

## Décisions de design

- **Pas d'extraction de composant partagé** : les deux composants sont indépendants et la forme est ~50 lignes. La duplication est préférable à une abstraction prématurée.
- **Autocomplete `freeSolo`** : permet de saisir un nom non présent dans le catalogue.
- **Pas d'alerte doublon** : l'utilisateur peut décocher l'ingrédient en double s'il ne le souhaite pas.
- **`catalog` non passé à `RecipeDetailPanel` via `App.tsx`** : `RecipeDetailPanel` est rendu dans `App.tsx` directement comme `rightPane` — il reçoit `catalog` directement de `App.tsx`.
