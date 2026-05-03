# Spec — Import recette par image & affichage des étapes

**Date :** 2026-05-03  
**Statut :** Approuvé

---

## Contexte

StoreFlow permet d'importer des recettes depuis du texte brut ou une URL. Le proxy Mistral tourne sur le C300 (`/home/renaud/storeflow-proxy/server.js`). L'objectif est d'ajouter l'analyse d'images de recettes (photo de livre, screenshot de site) et d'afficher les étapes dans l'interface.

Les types `Recipe.steps?: string[]` et `ParsedRecipe.steps?: string[]` existent déjà dans `src/types/index.ts`.

---

## Fonctionnalités

### 1. Import de recette par image (nouvel onglet)

Dans `RecipesPage`, l'onglet "Importer" propose un `ToggleButtonGroup` **Texte / Image**.

- En mode **Image** : zone d'upload avec `<input type="file" accept="image/*" capture="environment">` (sur mobile, ouvre directement la caméra)
- Après sélection : aperçu miniature de l'image choisie
- Bouton "Analyser" : convertit l'image en base64 (`FileReader`), envoie à `/api/parse-recipe-image`
- Le résultat (`ParsedRecipe`) alimente `RecipeImportPreview` — même flow que l'import texte

### 2. Ajout/remplacement d'étapes par image dans la fiche de modification

Dans `RecipeImportPreview`, après la liste des ingrédients et avant les steps manuelles, un bouton **"Analyser une image"** (icône `PhotoCameraIcon`).

- Ouvre un mini-dialog d'upload (même input file)
- Envoie l'image à `/api/parse-recipe-steps`
- Si des steps existent déjà : dialog de confirmation "Remplacer les X étapes existantes ?"
- Si confirmé (ou pas de steps existantes) : les steps retournées remplacent les steps actuelles

### 3. Affichage des étapes dans RecipeUsageDialog et RecipeDetailPanel

En bas de la liste des ingrédients, une section **"Étapes"** s'affiche si `recipe.steps` est non vide et non vide de contenu.

- Liste numérotée (1. 2. 3. …)
- Style `Typography variant="body2"`, lecture seule
- Séparateur `Divider` entre la section ingrédients et la section étapes

---

## Backend — proxy C300

### Nouvelle fonction `callMistralVision`

```js
async function callMistralVision(systemPrompt, imageBase64, mimeType) {
  // Appel Mistral avec message de type image_url (data URI base64)
  // model: 'mistral-small-latest'
  // response_format: { type: 'json_object' }
  // temperature: 0.1
}
```

### `POST /api/parse-recipe-image`

- **Body :** `{ imageBase64: string, mimeType: string }`
- **Validation :** imageBase64 requis, taille max ~4 Mo (≈ 5,5 Mo base64)
- **Prompt système :** extrait nom + servings + ingrédients + steps depuis l'image — même format que `/api/parse-recipe`
- **Retourne :** `ParsedRecipe` (`{ name, servings, ingredients, steps }`)

### `POST /api/parse-recipe-steps`

- **Body :** `{ imageBase64: string, mimeType: string }`
- **Validation :** idem
- **Prompt système :** extrait uniquement les étapes de préparation. Si le texte de l'image est découpé explicitement → respecter le découpage. Sinon → créer des étapes logiques de cuisine (préparation, cuisson, dressage…)
- **Retourne :** `{ steps: string[] }`

---

## Frontend

### `src/services/mistral.ts`

Deux nouvelles fonctions :

```ts
parseRecipeFromImage(imageBase64: string, mimeType: string): Promise<ParsedRecipe>
parseRecipeStepsFromImage(imageBase64: string, mimeType: string): Promise<{ steps: string[] }>
```

Utilisent `VITE_NETLIFY_FUNCTION_URL` avec fallback sur `/api/parse-recipe-image` et `/api/parse-recipe-steps`.

### `src/pages/RecipesPage.tsx`

- Ajout d'un `ToggleButtonGroup` Texte / Image dans l'onglet Import
- État `importMode: "text" | "image"` local
- En mode image : composant `ImagePicker` inline (input file + aperçu + bouton analyser)
- Appel `parseRecipeFromImage` → `setParsedRecipe` → affichage de `RecipeImportPreview`

### `src/components/recipes/RecipeImportPreview.tsx`

- Bouton **"Analyser une image"** (`PhotoCameraIcon`) après la section ingrédients
- État local `stepsImageDialogOpen: boolean`
- Mini-dialog : input file + bouton analyser → appel `parseRecipeStepsFromImage`
- Si steps existantes : `ConfirmDialog` "Remplacer les X étapes existantes ?"
- Remplacement des steps dans l'état local du formulaire

### `src/components/recipes/RecipeUsageDialog.tsx` et `RecipeDetailPanel.tsx`

- Section "Étapes" en bas, conditionnelle sur `recipe.steps?.length > 0`
- `Divider` + titre "Étapes" + liste numérotée

---

## Flux de données

```
[Photo / Screenshot]
      ↓
  FileReader (base64)
      ↓
  /api/parse-recipe-image  →  ParsedRecipe  →  RecipeImportPreview  →  onConfirm  →  recipes.json
  /api/parse-recipe-steps  →  { steps }    →  RecipeImportPreview (champ steps)
```

---

## Hors périmètre

- Affichage des steps en mode "cuisine" dédié (plein écran, navigation pas à pas)
- Modification manuelle des steps dans `RecipeUsageDialog`
- OCR fallback si Mistral échoue
