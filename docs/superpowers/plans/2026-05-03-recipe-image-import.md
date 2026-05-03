# Recipe Image Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre l'import de recettes par photo/screenshot via Mistral vision, et afficher les étapes de recette dans l'interface.

**Architecture:** Deux nouvelles routes Express dans le proxy C300 (`/api/parse-recipe-image` et `/api/parse-recipe-steps`) utilisant l'API vision de Mistral. Le frontend convertit l'image en base64 côté client, envoie au proxy, et réutilise le flow `RecipeImportPreview` existant. Les steps sont affichées en lecture seule dans `RecipeUsageDialog` et `RecipeDetailPanel`.

**Tech Stack:** Node.js/Express (proxy C300), React + MUI (frontend), Mistral Small (vision multimodal), TypeScript

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `/home/renaud/storeflow-proxy/server.js` | Modifier | Ajouter `callMistralVision`, `/api/parse-recipe-image`, `/api/parse-recipe-steps` |
| `src/services/mistral.ts` | Modifier | Ajouter `parseRecipeFromImage`, `parseRecipeStepsFromImage` |
| `src/pages/RecipesPage.tsx` | Modifier | ToggleButtonGroup Texte/Image + flow image import |
| `src/components/recipes/RecipeImportPreview.tsx` | Modifier | Bouton "Analyser une image" pour les steps |
| `src/components/recipes/RecipeUsageDialog.tsx` | Modifier | Section "Étapes" en lecture seule |
| `src/components/desktop/RecipeDetailPanel.tsx` | Modifier | Section "Étapes" en lecture seule |

---

## Task 1 : Proxy — `callMistralVision` + route `/api/parse-recipe-image`

**Files:**
- Modify: `/home/renaud/storeflow-proxy/server.js`

- [ ] **Step 1 : Tester manuellement que le proxy tourne**

```bash
ssh renaud@192.168.1.137 "curl -s http://localhost:3001/api/parse-recipe -X POST -H 'Content-Type: application/json' -d '{\"rawText\":\"test\"}' | head -c 200"
```

Résultat attendu : une réponse JSON (même si la recette est vide/fictive).

- [ ] **Step 2 : Ajouter `callMistralVision` et la route `/api/parse-recipe-image` dans server.js**

Ouvrir `/home/renaud/storeflow-proxy/server.js` via SSH et ajouter après la fonction `callMistral` existante :

```js
async function callMistralVision(systemPrompt, imageBase64, mimeType) {
  const dataUri = `data:${mimeType};base64,${imageBase64}`;
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: 'Analyse cette image de recette.' }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Mistral vision error:', res.status, errText);
    throw new Error(`Mistral error: ${res.status}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
```

Puis ajouter dans `PROMPTS` :

```js
recipeImage: `Tu es un assistant culinaire qui structure des recettes françaises à partir d'images.
Analyse l'image (photo de livre de cuisine, screenshot de site) et extrais la recette. Retourne un JSON valide avec ce format exact:
{
  "name": "string (nom de la recette en français)",
  "servings": number (4 si non précisé),
  "ingredients": [
    {
      "name": "string (ingrédient en français)",
      "quantity": number,
      "unit": "string (g, kg, mL, cL, L, pcs, sachet, c. à soupe, c. à café — pcs si non précisé)",
      "rayonId": "string"
    }
  ],
  "steps": ["string", "string"]
}
IDs de rayons disponibles:
- fruits-legumes, boulangerie, boucherie, cremerie, epicerie-seche, surgeles, boissons, hygiene, entretien, autre
Règles:
- steps: liste les étapes dans l'ordre de préparation, telles qu'elles apparaissent dans l'image
- Si les étapes ne sont pas découpées explicitement, crée des étapes logiques (préparation, cuisson, dressage)
- Ne jamais inventer d'ingrédients absents de l'image
- Le nom doit être court et naturel`,
```

Puis ajouter la route :

```js
app.post('/api/parse-recipe-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
    if (Buffer.byteLength(imageBase64, 'base64') > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image trop grande (max 4 Mo)' });
    }
    const result = await callMistralVision(PROMPTS.recipeImage, imageBase64, mimeType || 'image/jpeg');
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
```

- [ ] **Step 3 : Redémarrer le proxy sur le C300**

```bash
ssh renaud@192.168.1.137 "tmux send-keys -t c300 C-c '' && tmux send-keys -t c300 'node /home/renaud/storeflow-proxy/server.js &' Enter"
```

Si la session tmux n'existe pas :

```bash
ssh renaud@192.168.1.137 "pkill -f 'node.*server.js'; cd /home/renaud/storeflow-proxy && node server.js &"
```

- [ ] **Step 4 : Tester la route avec une image de test**

Depuis Windows, créer une image test minimale et la tester :

```bash
ssh renaud@192.168.1.137 "curl -s -X POST http://localhost:3001/api/parse-recipe-image -H 'Content-Type: application/json' -d '{\"imageBase64\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\",\"mimeType\":\"image/png\"}' | head -c 300"
```

Résultat attendu : un JSON (même vide `{"name":"","servings":4,"ingredients":[],"steps":[]}`) — pas d'erreur 502.

- [ ] **Step 5 : Commit du proxy**

```bash
ssh renaud@192.168.1.137 "cd /home/renaud/storeflow-proxy && git add server.js && git commit -m 'feat: add parse-recipe-image route with Mistral vision'"
```

(Si pas de git dans storeflow-proxy, skipper le commit et noter que les changements sont en place.)

---

## Task 2 : Proxy — route `/api/parse-recipe-steps`

**Files:**
- Modify: `/home/renaud/storeflow-proxy/server.js`

- [ ] **Step 1 : Ajouter le prompt `recipeSteps` dans `PROMPTS`**

Dans `/home/renaud/storeflow-proxy/server.js`, ajouter dans l'objet `PROMPTS` :

```js
recipeSteps: `Tu es un assistant culinaire. À partir de cette image de recette, extrais uniquement les étapes de préparation.
Retourne un JSON valide avec ce format exact:
{
  "steps": ["string", "string", "string"]
}
Règles:
- Si l'image montre des étapes numérotées ou titrées, respecte leur découpage exact
- Si pas de découpage explicite, crée des étapes logiques de cuisine (ex: "Préparer les légumes", "Faire revenir la viande", "Assembler et servir")
- Chaque étape doit être une phrase complète et actionnable
- Minimum 2 étapes, maximum 15`,
```

- [ ] **Step 2 : Ajouter la route `/api/parse-recipe-steps`**

Ajouter après la route `/api/parse-recipe-image` :

```js
app.post('/api/parse-recipe-steps', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
    if (Buffer.byteLength(imageBase64, 'base64') > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image trop grande (max 4 Mo)' });
    }
    const result = await callMistralVision(PROMPTS.recipeSteps, imageBase64, mimeType || 'image/jpeg');
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
```

- [ ] **Step 3 : Redémarrer le proxy**

```bash
ssh renaud@192.168.1.137 "pkill -f 'node.*server.js'; sleep 1; cd /home/renaud/storeflow-proxy && node server.js > /tmp/proxy.log 2>&1 &"
```

- [ ] **Step 4 : Tester la route**

```bash
ssh renaud@192.168.1.137 "curl -s -X POST http://localhost:3001/api/parse-recipe-steps -H 'Content-Type: application/json' -d '{\"imageBase64\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\",\"mimeType\":\"image/png\"}'"
```

Résultat attendu : `{"steps":[...]}` — pas d'erreur 502.

- [ ] **Step 5 : Commit**

```bash
ssh renaud@192.168.1.137 "cd /home/renaud/storeflow-proxy && git add server.js && git commit -m 'feat: add parse-recipe-steps route'"
```

---

## Task 3 : Frontend — `mistral.ts` — deux nouvelles fonctions

**Files:**
- Modify: `src/services/mistral.ts`

- [ ] **Step 1 : Ajouter `parseRecipeFromImage` et `parseRecipeStepsFromImage` dans `mistral.ts`**

Ouvrir `src/services/mistral.ts` et ajouter à la fin du fichier :

```ts
export async function parseRecipeFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ParsedRecipe> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
  const url = baseUrl.replace(/\/[^/]+$/, "/parse-recipe-image");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur lors de l'analyse de l'image : ${res.status}`);
  }

  return (await res.json()) as ParsedRecipe;
}

export async function parseRecipeStepsFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<{ steps: string[] }> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
  const url = baseUrl.replace(/\/[^/]+$/, "/parse-recipe-steps");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur lors de l'analyse des étapes : ${res.status}`);
  }

  return (await res.json()) as { steps: string[] };
}
```

- [ ] **Step 2 : Vérifier que le build TypeScript passe**

Depuis Windows, dans `d:\Claude\StoreFlow` :

```powershell
npm run build
```

Résultat attendu : build sans erreur TypeScript.

- [ ] **Step 3 : Commit**

```bash
git add src/services/mistral.ts
git commit -m "feat: add parseRecipeFromImage and parseRecipeStepsFromImage"
```

---

## Task 4 : Frontend — Import image dans `RecipesPage`

**Files:**
- Modify: `src/pages/RecipesPage.tsx`

- [ ] **Step 1 : Ajouter les imports nécessaires en haut de `RecipesPage.tsx`**

Ajouter `PhotoCameraIcon` et `TextFieldsIcon` aux imports MUI Icons existants :

```ts
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import TextFieldsIcon from "@mui/icons-material/TextFields";
```

Ajouter `ToggleButton` et `ToggleButtonGroup` aux imports MUI :

```ts
import {
  // ...existants...
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
```

Ajouter `parseRecipeFromImage` à l'import depuis mistral :

```ts
import { parseRecipeFromText, parseRecipeFromImage } from "../services/mistral";
```

- [ ] **Step 2 : Ajouter les états `importMode` et `imageError` dans le composant**

Dans la section état du composant (après les états `importText`, `isParsing`, etc.) :

```ts
const [importMode, setImportMode] = useState<"text" | "image">("text");
const [imageError, setImageError] = useState<string | null>(null);
```

- [ ] **Step 3 : Ajouter le handler `handleAnalyzeImage`**

Après la fonction `handleAnalyzeRecipe` existante, ajouter :

```ts
const handleAnalyzeImage = async (file: File) => {
  setImageError(null);
  setIsParsing(true);
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await parseRecipeFromImage(base64, file.type || "image/jpeg");
    const resolved: ParsedRecipe = {
      ...result,
      ingredients: result.ingredients.map((ing) => ({
        ...ing,
        rayonId: resolveRayonId(ing.name, ing.rayonId),
      })),
    };
    setParsedRecipe(resolved);
  } catch (err) {
    setImageError(err instanceof Error ? err.message : "Erreur lors de l'analyse de l'image");
  } finally {
    setIsParsing(false);
  }
};
```

- [ ] **Step 4 : Remplacer le contenu du Tab 1 (Importer) par le ToggleButtonGroup + logique image**

Dans la JSX, trouver le bloc `{/* Tab 1 — Importer */}` et remplacer le bloc `<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>` (quand `!parsedRecipe`) par :

```tsx
<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
  <ToggleButtonGroup
    value={importMode}
    exclusive
    onChange={(_, v) => { if (v) { setImportMode(v); setParseError(null); setImageError(null); } }}
    size="small"
    sx={{ alignSelf: "flex-start" }}
  >
    <ToggleButton value="text">
      <TextFieldsIcon fontSize="small" sx={{ mr: 0.5 }} />
      Texte
    </ToggleButton>
    <ToggleButton value="image">
      <PhotoCameraIcon fontSize="small" sx={{ mr: 0.5 }} />
      Image
    </ToggleButton>
  </ToggleButtonGroup>

  {importMode === "text" ? (
    <>
      <Typography variant="body2" color="text.secondary">
        Collez le texte d'une recette (depuis un blog, un livre, une
        application…). L'IA va en extraire les ingrédients et les
        quantités par personne.
      </Typography>
      <TextField
        multiline={!isUrl}
        rows={isUrl ? 1 : 10}
        fullWidth
        placeholder={
          "URL d'une recette (https://…) ou texte à coller :\n• Bœuf bourguignon pour 6 personnes\n  - 1 kg de bœuf\n  - 3 carottes\n  ..."
        }
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        disabled={isParsing}
        sx={{
          "& .MuiOutlinedInput-root": {
            fontFamily: "monospace",
            fontSize: "0.9rem",
          },
        }}
      />
      {isUrl && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          La page sera téléchargée par le serveur. Fonctionne sur la plupart des sites, sauf ceux qui chargent le contenu en JavaScript.
        </Alert>
      )}
      {parseError && (
        <Alert severity="error" onClose={() => setParseError(null)}>
          {parseError}
        </Alert>
      )}
      <Button
        variant="contained"
        onClick={handleAnalyzeRecipe}
        disabled={!importText.trim() || isParsing}
        startIcon={isParsing ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
      >
        {isParsing ? "Analyse en cours…" : "Analyser avec l'IA"}
      </Button>
    </>
  ) : (
    <>
      <Typography variant="body2" color="text.secondary">
        Prenez en photo une page de livre de cuisine ou un screenshot de recette. L'IA va extraire les ingrédients et les étapes.
      </Typography>
      <Button
        variant="outlined"
        component="label"
        startIcon={<PhotoCameraIcon />}
        disabled={isParsing}
        sx={{ alignSelf: "flex-start" }}
      >
        Choisir une image
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAnalyzeImage(file);
            e.target.value = "";
          }}
        />
      </Button>
      {isParsing && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Analyse en cours…</Typography>
        </Box>
      )}
      {imageError && (
        <Alert severity="error" onClose={() => setImageError(null)}>
          {imageError}
        </Alert>
      )}
    </>
  )}
</Box>
```

Note : le bloc existant contient déjà le bouton "Analyser" et l'Alert d'erreur — remplacer **tout** le contenu du `<Box>` jusqu'au bouton "Analyser avec l'IA" inclus (garder uniquement ce qui est dans `parsedRecipe ? ... : <Box>` ci-dessus).

- [ ] **Step 5 : Réinitialiser `importMode` quand on change d'onglet**

Dans le handler `onChange` des `Tabs` :

```ts
onChange={(_, v) => {
  setTab(v);
  setParsedRecipe(null);
  setParseError(null);
  setEditingRecipe(null);
  setImportMode("text");  // ← ajouter cette ligne
}}
```

- [ ] **Step 6 : Vérifier le build**

```powershell
npm run build
```

Résultat attendu : 0 erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
git add src/pages/RecipesPage.tsx
git commit -m "feat: add image import mode in recipe import tab"
```

---

## Task 5 : Frontend — Bouton "Analyser image" pour les steps dans `RecipeImportPreview`

**Files:**
- Modify: `src/components/recipes/RecipeImportPreview.tsx`

- [ ] **Step 1 : Ajouter les imports**

En haut de `RecipeImportPreview.tsx`, ajouter :

```ts
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
```

Certains de ces composants MUI sont peut-être déjà importés — vérifier et n'ajouter que les manquants.

Ajouter l'import du service :

```ts
import { parseRecipeStepsFromImage } from "../../services/mistral";
```

- [ ] **Step 2 : Ajouter les états locaux**

Dans le composant `RecipeImportPreview`, ajouter après les états existants :

```ts
const [stepsImageOpen, setStepsImageOpen] = useState(false);
const [stepsImageParsing, setStepsImageParsing] = useState(false);
const [stepsImageError, setStepsImageError] = useState<string | null>(null);
const [replaceStepsConfirmOpen, setReplaceStepsConfirmOpen] = useState(false);
const [pendingSteps, setPendingSteps] = useState<string[]>([]);
```

- [ ] **Step 3 : Ajouter le handler d'analyse d'image de steps**

Après les handlers existants dans le composant :

```ts
const handleStepsImageFile = async (file: File) => {
  setStepsImageError(null);
  setStepsImageParsing(true);
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const { steps } = await parseRecipeStepsFromImage(base64, file.type || "image/jpeg");
    if (steps.length > 0) {
      setPendingSteps(result.steps);
      setStepsImageOpen(false);
      setReplaceStepsConfirmOpen(true);
    } else {
      setSteps(result.steps);
      setStepsImageOpen(false);
    }
  } catch (err) {
    setStepsImageError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
  } finally {
    setStepsImageParsing(false);
  }
};
```

Note : dans `RecipeImportPreview`, l'état s'appelle `steps`/`setSteps` (ligne 102 du fichier). Utiliser ces noms dans le handler.

- [ ] **Step 5 : Ajouter le bouton et les dialogs dans la JSX**

Dans la JSX de `RecipeImportPreview`, trouver la section steps (le champ texte ou la zone où les steps sont affichées/éditées). Ajouter juste avant cette section :

```tsx
{/* Bouton analyse image pour les steps */}
<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2, mb: 1 }}>
  <Typography variant="subtitle2">Étapes</Typography>
  <Button
    size="small"
    variant="outlined"
    startIcon={<PhotoCameraIcon fontSize="small" />}
    onClick={() => { setStepsImageOpen(true); setStepsImageError(null); }}
  >
    Analyser une image
  </Button>
</Box>

{/* Mini-dialog upload image */}
<Dialog open={stepsImageOpen} onClose={() => setStepsImageOpen(false)} maxWidth="xs" fullWidth>
  <DialogTitle>Analyser les étapes par image</DialogTitle>
  <DialogContent>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Photo d'un livre ou screenshot d'une recette — l'IA extrait les étapes.
    </Typography>
    <Button
      variant="outlined"
      component="label"
      startIcon={<PhotoCameraIcon />}
      disabled={stepsImageParsing}
      fullWidth
    >
      {stepsImageParsing ? (
        <><CircularProgress size={16} sx={{ mr: 1 }} />Analyse en cours…</>
      ) : "Choisir une image"}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleStepsImageFile(file);
          e.target.value = "";
        }}
      />
    </Button>
    {stepsImageError && (
      <Alert severity="error" sx={{ mt: 1 }}>{stepsImageError}</Alert>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setStepsImageOpen(false)}>Annuler</Button>
  </DialogActions>
</Dialog>

{/* Confirmation remplacement steps */}
<Dialog open={replaceStepsConfirmOpen} onClose={() => setReplaceStepsConfirmOpen(false)} maxWidth="xs">
  <DialogTitle>Remplacer les étapes ?</DialogTitle>
  <DialogContent>
    <Typography variant="body2">
      {steps.length} étape{steps.length > 1 ? "s" : ""} existante{steps.length > 1 ? "s" : ""} seront remplacées par les {pendingSteps.length} étapes extraites de l'image.
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setReplaceStepsConfirmOpen(false)}>Annuler</Button>
    <Button
      variant="contained"
      color="warning"
      onClick={() => {
        setSteps(pendingSteps);
        setPendingSteps([]);
        setReplaceStepsConfirmOpen(false);
      }}
    >
      Remplacer
    </Button>
  </DialogActions>
</Dialog>
```

- [ ] **Step 6 : Vérifier le build**

```powershell
npm run build
```

Résultat attendu : 0 erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
git add src/components/recipes/RecipeImportPreview.tsx
git commit -m "feat: add image analysis button for steps in RecipeImportPreview"
```

---

## Task 6 : Frontend — Affichage des steps dans `RecipeUsageDialog`

**Files:**
- Modify: `src/components/recipes/RecipeUsageDialog.tsx`

- [ ] **Step 1 : Ajouter la section "Étapes" dans la JSX du dialog**

Dans `RecipeUsageDialog.tsx`, trouver la fin du contenu `DialogContent` (avant `DialogActions`). Ajouter juste avant la fermeture de `DialogContent` :

```tsx
{/* Section étapes */}
{(recipe?.steps ?? []).length > 0 && (
  <>
    <Divider sx={{ my: 2 }} />
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
      Étapes
    </Typography>
    <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
      {(recipe?.steps ?? []).map((step, idx) => (
        <Box component="li" key={idx} sx={{ mb: 1 }}>
          <Typography variant="body2">{step}</Typography>
        </Box>
      ))}
    </Box>
  </>
)}
```

Note : `Divider` est déjà importé dans ce fichier — vérifier avant d'ajouter.

- [ ] **Step 2 : Vérifier le build**

```powershell
npm run build
```

Résultat attendu : 0 erreur TypeScript.

- [ ] **Step 3 : Commit**

```bash
git add src/components/recipes/RecipeUsageDialog.tsx
git commit -m "feat: display recipe steps in RecipeUsageDialog"
```

---

## Task 7 : Frontend — Affichage des steps dans `RecipeDetailPanel`

**Files:**
- Modify: `src/components/desktop/RecipeDetailPanel.tsx`

- [ ] **Step 1 : Ajouter la section "Étapes" dans la JSX du panel**

Dans `RecipeDetailPanel.tsx`, trouver la zone d'affichage des ingrédients (le `Box` ou `Accordion` principal). Ajouter après les ingrédients et avant les boutons d'action :

```tsx
{/* Section étapes */}
{(recipe?.steps ?? []).length > 0 && (
  <>
    <Divider sx={{ my: 2 }} />
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
      Étapes
    </Typography>
    <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
      {(recipe?.steps ?? []).map((step, idx) => (
        <Box component="li" key={idx} sx={{ mb: 1 }}>
          <Typography variant="body2">{step}</Typography>
        </Box>
      ))}
    </Box>
  </>
)}
```

Note : `Divider` est déjà importé dans ce fichier — vérifier.

- [ ] **Step 2 : Vérifier le build**

```powershell
npm run build
```

Résultat attendu : 0 erreur TypeScript.

- [ ] **Step 3 : Commit**

```bash
git add src/components/desktop/RecipeDetailPanel.tsx
git commit -m "feat: display recipe steps in RecipeDetailPanel"
```

---

## Task 8 : Déploiement et test de bout en bout

**Files:**
- Deploy: `dist/` → `Z:\storeflow\`

- [ ] **Step 1 : Build de production**

```powershell
npm run build
```

Résultat attendu : dossier `dist/` mis à jour, 0 erreur.

- [ ] **Step 2 : Déployer sur le C300**

```powershell
Copy-Item dist\* Z:\storeflow\ -Recurse -Force
```

- [ ] **Step 3 : Test import image — nouvelle recette**

Sur mobile ou navigateur, aller sur `http://noforgiv.freeboxos.fr:50010`, onglet Recettes > Importer > basculer sur "Image", sélectionner une photo de recette. Vérifier que :
- La recette apparaît dans `RecipeImportPreview` avec nom, ingrédients et steps pré-remplis
- Le bouton "Confirmer" sauvegarde la recette

- [ ] **Step 4 : Test ajout steps par image sur recette existante**

Sur une recette existante, cliquer "Modifier", puis "Analyser une image" dans la section Étapes. Vérifier que :
- Si des steps existent → dialog de confirmation s'ouvre
- Après confirmation → steps remplacées
- Après "Enregistrer" → steps sauvegardées dans `recipes.json`

- [ ] **Step 5 : Test affichage des steps**

Cliquer "Utiliser" sur une recette avec des steps. Vérifier que la section "Étapes" apparaît en bas du dialog/panel avec la liste numérotée.
