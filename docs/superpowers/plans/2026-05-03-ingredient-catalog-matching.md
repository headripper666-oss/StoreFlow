# Ingredient Catalog Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Matcher les ingrédients contre le catalog pour auto-remplir unité+prix, avec affichage ✓/⚠️/suggestion "Voulez-vous dire X ?" dans RecipeImportPreview.

**Architecture:** (1) `findInCatalog` utilitaire dans recipeUtils, (2) autocomplete manuel dans RecipeImportPreview, (3) résolution IA au montage avec CatalogStatus local, (4) alignement RecipeDetailPanel. Tout est local à RecipeImportPreview — aucun changement de type exporté.

**Tech Stack:** React, TypeScript, MUI (Autocomplete, Chip, Tooltip), recipeUtils.ts existant.

---

### Task 1 : Ajouter `findInCatalog` dans recipeUtils.ts

**Files:**
- Modify: `src/utils/recipeUtils.ts`

- [ ] **Step 1 : Ajouter l'import du type CatalogProduct**

En haut de `src/utils/recipeUtils.ts`, remplacer la ligne 1 :

```ts
import type { CatalogProduct, RecipeIngredient } from "../types";
```

- [ ] **Step 2 : Ajouter la fonction `findInCatalog` après `normalize`**

Insérer après la fonction `normalize` (après la ligne `}`  qui termine `normalize`, avant `detectTags`) :

```ts
export function findInCatalog(
  name: string,
  catalog: CatalogProduct[],
): CatalogProduct | null {
  const normName = normalize(name);
  for (const p of catalog) {
    if (normalize(p.name) === normName) return p;
    if ((p.aliases ?? []).some((a) => normalize(a) === normName)) return p;
  }
  return null;
}
```

- [ ] **Step 3 : Vérifier le build**

```bash
npm run build
```

Attendu : `✓ built` sans erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add src/utils/recipeUtils.ts
git commit -m "feat: ajouter findInCatalog dans recipeUtils"
```

---

### Task 2 : Autocomplete manuel dans RecipeImportPreview

**Files:**
- Modify: `src/components/recipes/RecipeImportPreview.tsx`
- Modify: `src/pages/RecipesPage.tsx`

- [ ] **Step 1 : Ajouter les imports nécessaires dans RecipeImportPreview**

Remplacer les imports actuels du fichier :

```tsx
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  CatalogProduct,
  ParsedRecipe,
  Rayon,
  Recipe,
  RecipeIngredient,
} from "../../types";
import { detectTags, findInCatalog } from "../../utils/recipeUtils";
```

- [ ] **Step 2 : Ajouter la prop `catalog` à l'interface**

Remplacer l'interface `RecipeImportPreviewProps` :

```ts
interface RecipeImportPreviewProps {
  parsed: ParsedRecipe;
  rayons: Rayon[];
  catalog: CatalogProduct[];
  isSaving: boolean;
  allTags: string[];
  initialTags?: string[];
  title?: string;
  confirmLabel?: string;
  onConfirm: (recipe: Recipe) => Promise<void>;
  onCancel: () => void;
  onTagsChange?: (tags: string[]) => void;
}
```

- [ ] **Step 3 : Déstructurer `catalog` dans la fonction**

Remplacer la signature de la fonction :

```tsx
export function RecipeImportPreview({
  parsed,
  rayons,
  catalog,
  isSaving,
  allTags,
  initialTags,
  title = "Recette détectée",
  confirmLabel = "Sauvegarder la recette",
  onConfirm,
  onCancel,
  onTagsChange,
}: RecipeImportPreviewProps) {
```

- [ ] **Step 4 : Remplacer le TextField "Ingrédient" par un Autocomplete dans le formulaire d'édition**

Dans la section `editingIdx === idx` (lignes ~192-198), remplacer le `TextField` nom :

```tsx
<Autocomplete
  freeSolo
  size="small"
  options={catalog.map((c) => c.name)}
  value={ing.name}
  inputValue={ing.name}
  onInputChange={(_, value) => updateField(idx, "name", value)}
  onChange={(_, value) => {
    if (typeof value === "string" && value) {
      const match = findInCatalog(value, catalog);
      setIngredients((prev) =>
        prev.map((item, i) =>
          i === idx
            ? {
                ...item,
                name: value,
                unit: match ? match.defaultUnit : item.unit,
                pricePerUnit: match ? match.pricePerUnit : item.pricePerUnit,
                rayonId: match ? match.rayonId : item.rayonId,
              }
            : item,
        ),
      );
    }
  }}
  renderInput={(params) => (
    <TextField
      {...params}
      size="small"
      label="Ingrédient"
      fullWidth
      autoFocus
    />
  )}
/>
```

- [ ] **Step 5 : Passer `catalog` depuis RecipesPage**

Dans `src/pages/RecipesPage.tsx`, ligne ~407, ajouter la prop `catalog` à `<RecipeImportPreview>` :

```tsx
<RecipeImportPreview
  parsed={parsedRecipe}
  rayons={rayons}
  catalog={catalog}
  isSaving={isSavingRecipes}
  allTags={allTags}
  initialTags={editingRecipe?.tags}
  title={editingRecipe ? "Modifier la recette" : undefined}
  confirmLabel={
    editingRecipe ? "Enregistrer les modifications" : undefined
  }
  onConfirm={editingRecipe ? handleConfirmEdit : handleConfirmImport}
  onCancel={() => {
    setParsedRecipe(null);
    setEditingRecipe(null);
  }}
/>
```

- [ ] **Step 6 : Vérifier le build**

```bash
npm run build
```

Attendu : `✓ built` sans erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
git add src/components/recipes/RecipeImportPreview.tsx src/pages/RecipesPage.tsx
git commit -m "feat: autocomplete catalog sur ajout manuel d'ingrédient"
```

---

### Task 3 : Résolution IA avec CatalogStatus

**Files:**
- Modify: `src/components/recipes/RecipeImportPreview.tsx`

- [ ] **Step 1 : Ajouter le type `CatalogStatus` et le type interne `IngWithStatus`**

Juste après les imports, avant l'interface `RecipeImportPreviewProps`, ajouter :

```ts
type CatalogStatus =
  | { kind: "matched"; product: CatalogProduct }
  | { kind: "suggested"; product: CatalogProduct }
  | { kind: "unmatched" }
  | { kind: "ignored" };

type IngWithStatus = RecipeIngredient & { catalogStatus: CatalogStatus };
```

- [ ] **Step 2 : Ajouter la fonction `resolveStatus` (hors composant)**

Juste avant `export function RecipeImportPreview`, ajouter :

```ts
function resolveStatus(name: string, catalog: CatalogProduct[]): CatalogStatus {
  const direct = findInCatalog(name, catalog);
  if (direct) return { kind: "matched", product: direct };
  const normName = normalize(name);
  for (const p of catalog) {
    if ((p.aliases ?? []).some((a) => normalize(a) === normName)) {
      return { kind: "suggested", product: p };
    }
  }
  return { kind: "unmatched" };
}
```

Note : `findInCatalog` fait déjà le matching nom+aliases → `resolveStatus` l'utilise pour "matched". Le matching inverse (alias du catalog → nom IA) est pour "suggested" : on cherche si le nom IA apparaît dans les aliases d'un produit catalog. C'est différent : findInCatalog cherche le nom IA comme nom OU alias d'un produit ; ici on cherche si le nom IA est un alias d'un produit dont le NOM PRINCIPAL est différent — ce cas n'est pas couvert par findInCatalog car findInCatalog retourne le produit dès qu'il trouve un alias, donc si "bifteck" est un alias de "steak", findInCatalog("bifteck") retourne "steak" avec status "matched". La distinction matched/suggested est donc : matched = normalize(ing.name) === normalize(product.name) ; suggested = trouvé via alias uniquement.

Remplacer `resolveStatus` par cette version plus précise :

```ts
function resolveStatus(name: string, catalog: CatalogProduct[]): CatalogStatus {
  const normName = normalize(name);
  for (const p of catalog) {
    if (normalize(p.name) === normName) return { kind: "matched", product: p };
  }
  for (const p of catalog) {
    if ((p.aliases ?? []).some((a) => normalize(a) === normName)) {
      return { kind: "suggested", product: p };
    }
  }
  return { kind: "unmatched" };
}
```

- [ ] **Step 3 : Changer le type du state `ingredients` et initialiser avec `catalogStatus`**

Remplacer la déclaration du state `ingredients` :

```ts
const [ingredients, setIngredients] = useState<IngWithStatus[]>(() =>
  parsed.ingredients.map((ing) => {
    const status = resolveStatus(ing.name, catalog);
    const resolved =
      status.kind === "matched"
        ? {
            unit: status.product.defaultUnit,
            pricePerUnit: status.product.pricePerUnit,
            rayonId: status.product.rayonId,
          }
        : {};
    return {
      ...ing,
      rayonId: ing.rayonId ?? defaultRayonId,
      ...resolved,
      catalogStatus: status,
    };
  }),
);
```

- [ ] **Step 4 : Adapter `updateField` pour conserver `catalogStatus`**

`updateField` fonctionne déjà avec un type générique, aucune modification nécessaire — `catalogStatus` n'est pas une clé de `RecipeIngredient` donc TypeScript ne la laissera pas être écrasée par `updateField`. Vérifier que le type compile (step build plus bas).

- [ ] **Step 5 : Adapter `handleConfirm` pour ne pas exporter `catalogStatus`**

Remplacer `handleConfirm` :

```ts
const handleConfirm = async () => {
  const recipe: Recipe = {
    id: `recipe-${uuidv4()}`,
    name: name.trim() || "Recette sans nom",
    servings: Math.max(1, servings),
    ingredients: ingredients.map(({ catalogStatus: _cs, ...ing }) => ing),
    createdAt: new Date().toISOString(),
    tags,
    steps: steps.filter((s) => s.trim()),
  };
  await onConfirm(recipe);
};
```

- [ ] **Step 6 : Ajouter les imports MUI pour les icônes de status**

Ajouter en haut du fichier avec les imports MUI existants :

```tsx
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
```

Et dans les imports MUI `{}`, ajouter `Tooltip` :

```tsx
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
```

- [ ] **Step 7 : Ajouter le handler pour accepter une suggestion**

Juste après `removeIngredient`, ajouter :

```ts
const acceptSuggestion = (idx: number, product: CatalogProduct) => {
  setIngredients((prev) =>
    prev.map((ing, i) =>
      i === idx
        ? {
            ...ing,
            name: product.name,
            unit: product.defaultUnit,
            pricePerUnit: product.pricePerUnit,
            rayonId: product.rayonId,
            catalogStatus: { kind: "matched", product },
          }
        : ing,
    ),
  );
};

const ignoreSuggestion = (idx: number) => {
  setIngredients((prev) =>
    prev.map((ing, i) =>
      i === idx ? { ...ing, catalogStatus: { kind: "ignored" } } : ing,
    ),
  );
};
```

- [ ] **Step 8 : Afficher les indicateurs de status dans la vue non-édition**

Dans la vue non-édition (section `else` du `editingIdx === idx`), remplacer le `<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>` complet par :

```tsx
<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {ing.name || <em style={{ opacity: 0.5 }}>Sans nom</em>}
        </Typography>
        {ing.catalogStatus.kind === "matched" && (
          <Tooltip title="Reconnu dans le catalogue">
            <CheckCircleIcon sx={{ fontSize: 14, color: "success.main", flexShrink: 0 }} />
          </Tooltip>
        )}
        {ing.catalogStatus.kind === "unmatched" && (
          <Tooltip title="Inconnu dans le catalogue">
            <WarningAmberIcon sx={{ fontSize: 14, color: "warning.main", flexShrink: 0 }} />
          </Tooltip>
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          gap: 0.75,
          mt: 0.25,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {ing.quantity} {ing.unit}
        </Typography>
        <Chip
          label={`${rayons.find((r) => r.id === ing.rayonId)?.icon ?? ""} ${rayons.find((r) => r.id === ing.rayonId)?.label ?? ing.rayonId}`}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.68rem" }}
        />
      </Box>
    </Box>
    <IconButton
      size="small"
      onClick={() => setEditingIdx(idx)}
      sx={{ flexShrink: 0 }}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  </Box>
  {ing.catalogStatus.kind === "suggested" && (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.5,
        bgcolor: "warning.50",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "warning.200",
      }}
    >
      <WarningAmberIcon sx={{ fontSize: 14, color: "warning.main", flexShrink: 0 }} />
      <Typography variant="caption" sx={{ flex: 1 }}>
        Voulez-vous dire <strong>{ing.catalogStatus.product.name}</strong> ?
      </Typography>
      <Button
        size="small"
        variant="outlined"
        color="warning"
        sx={{ py: 0, minWidth: 0, px: 1, fontSize: "0.7rem" }}
        onClick={() => acceptSuggestion(idx, ing.catalogStatus.kind === "suggested" ? ing.catalogStatus.product : ing.catalogStatus.product)}
      >
        Oui
      </Button>
      <Button
        size="small"
        sx={{ py: 0, minWidth: 0, px: 1, fontSize: "0.7rem", color: "text.secondary" }}
        onClick={() => ignoreSuggestion(idx)}
      >
        Ignorer
      </Button>
    </Box>
  )}
</Box>
```

- [ ] **Step 9 : Vérifier le build**

```bash
npm run build
```

Attendu : `✓ built` sans erreur TypeScript. Si erreur sur `catalogStatus` dans `updateField` (car le type `IngWithStatus` étend `RecipeIngredient`), adapter le type de `updateField` :

```ts
const updateField = (
  idx: number,
  field: keyof RecipeIngredient,
  value: string | number,
) => {
  setIngredients((prev) =>
    prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
  );
};
```

Ce code est déjà correct — `field` est `keyof RecipeIngredient` donc `catalogStatus` ne peut pas y être passé.

- [ ] **Step 10 : Commit**

```bash
git add src/components/recipes/RecipeImportPreview.tsx
git commit -m "feat: résolution catalog sur ingrédients IA avec status matched/suggested/unmatched"
```

---

### Task 4 : Alignement RecipeDetailPanel

**Files:**
- Modify: `src/components/desktop/RecipeDetailPanel.tsx`

- [ ] **Step 1 : Remplacer le catalog.find inline par findInCatalog**

Dans `src/components/desktop/RecipeDetailPanel.tsx`, ajouter `findInCatalog` aux imports de recipeUtils :

```ts
import { normalize, roundQuantity, findInCatalog } from "../../utils/recipeUtils";
```

- [ ] **Step 2 : Remplacer `handleCatalogSelect`**

Remplacer la fonction `handleCatalogSelect` existante (lignes ~206-214) :

```ts
const handleCatalogSelect = (_: unknown, value: string | null) => {
  const found = findInCatalog(value ?? "", catalog);
  setNewName(value ?? "");
  if (found) {
    setNewUnit(found.defaultUnit);
    setNewRayonId(found.rayonId);
    setNewPrice(found.pricePerUnit);
  }
};
```

- [ ] **Step 3 : Vérifier le build**

```bash
npm run build
```

Attendu : `✓ built` sans erreur TypeScript.

- [ ] **Step 4 : Commit et déploiement**

```bash
git add src/components/desktop/RecipeDetailPanel.tsx
git commit -m "feat: aligner RecipeDetailPanel sur findInCatalog avec aliases"
```

```powershell
Copy-Item dist\* Z:\storeflow\ -Recurse -Force
```

---

## Notes de vérification manuelle

Après déploiement, tester :

1. **Ajout manuel** : ouvrir une recette en mode édition → "Ajouter un ingrédient" → taper les premières lettres d'un article catalog → vérifier que l'autocomplete propose des noms → sélectionner → vérifier que l'unité et le prix se remplissent.

2. **Ajout IA** : importer une recette avec l'IA → vérifier que les ingrédients connus affichent ✓ vert, les inconnus ⚠️ orange, et que les suggestions "Voulez-vous dire X ?" apparaissent pour les ingrédients matchés via alias.

3. **Suggestion** : cliquer "Oui" sur une suggestion → vérifier que le nom, l'unité et le prix sont remplacés et que ✓ vert apparaît.
