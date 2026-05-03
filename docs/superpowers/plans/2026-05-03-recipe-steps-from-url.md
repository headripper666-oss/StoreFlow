# Recipe Steps from URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'extraire uniquement les étapes d'une recette depuis une URL, dans la fiche de modification d'une recette existante.

**Architecture:** Nouvelle route Express `/api/parse-recipe-steps-url` sur le proxy C300 qui télécharge la page, extrait le texte HTML avec la fonction existante, et appelle Mistral. Côté frontend, un champ URL + bouton dans `RecipeImportPreview` réutilise le flow `replaceStepsConfirmOpen`/`pendingSteps` déjà en place pour la gestion du remplacement.

**Tech Stack:** Node.js/Express (proxy C300), React + MUI (frontend), Mistral Small (texte), TypeScript

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `/home/renaud/storeflow-proxy/server.js` | Modifier | Ajouter prompt `recipeStepsText` + route `/api/parse-recipe-steps-url` |
| `src/services/mistral.ts` | Modifier | Ajouter `parseRecipeStepsFromUrl` |
| `src/components/recipes/RecipeImportPreview.tsx` | Modifier | Champ URL + bouton + états + handler |

---

## Task 1 : Proxy — route `/api/parse-recipe-steps-url`

**Files:**
- Modify: `/home/renaud/storeflow-proxy/server.js`

- [ ] **Step 1 : Vérifier que le proxy tourne**

```bash
ssh renaud@192.168.1.137 "curl -s http://localhost:3001/api/parse-recipe -X POST -H 'Content-Type: application/json' -d '{\"rawText\":\"test\"}' | head -c 100"
```

Résultat attendu : JSON avec `name`, `servings`, `ingredients`.

- [ ] **Step 2 : Trouver le PID du proxy et l'arrêter**

```bash
ssh renaud@192.168.1.137 "ps aux | grep 'node.*server.js' | grep -v grep | awk '{print \$2}'"
```

Noter le PID, puis :

```bash
ssh renaud@192.168.1.137 "kill <PID>"
```

- [ ] **Step 3 : Ajouter le prompt `recipeStepsText` dans `server.js`**

Dans `/home/renaud/storeflow-proxy/server.js`, dans l'objet `PROMPTS`, après la clé `recipeSteps`, ajouter :

```js
recipeStepsText: `Tu es un assistant culinaire. À partir du texte brut d'une page de recette, extrais uniquement les étapes de préparation.
Retourne un JSON valide avec ce format exact:
{
  "steps": ["string", "string", "string"]
}
Règles:
- Si le texte contient des étapes numérotées ou titrées, respecte leur découpage exact
- Si pas de découpage explicite, crée des étapes logiques de cuisine (préparation, cuisson, dressage)
- Chaque étape doit être une phrase complète et actionnable en français
- Minimum 2 étapes, maximum 15
- Ignorer les publicités, commentaires, navigation et tout contenu non lié à la recette`,
```

- [ ] **Step 4 : Ajouter la route `/api/parse-recipe-steps-url`**

Dans `/home/renaud/storeflow-proxy/server.js`, après la route `/api/parse-recipe-steps`, ajouter :

```js
app.post('/api/parse-recipe-steps-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'url is required and must start with http:// or https://' });
    }
    let pageText;
    try {
      console.log('Fetching URL for steps:', url);
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StoreFlow/1.0; +https://github.com)' }
      });
      if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
      const html = await pageRes.text();
      pageText = extractTextFromHtml(html);
      if (!pageText) throw new Error('Page vide ou non lisible');
      console.log(`Extracted ${pageText.length} chars for steps`);
    } catch (fetchErr) {
      return res.status(422).json({ error: `Impossible de lire la page : ${fetchErr.message}` });
    }
    const result = await callMistral(PROMPTS.recipeStepsText, pageText);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
```

- [ ] **Step 5 : Transférer le fichier modifié sur le C300**

Depuis Windows, lire le `server.js` modifié localement (si édité en local) ou éditer directement via SSH. Si édité en local, transférer via :

```powershell
scp "chemin\local\server.js" renaud@192.168.1.137:/home/renaud/storeflow-proxy/server.js
```

- [ ] **Step 6 : Redémarrer le proxy**

```bash
ssh renaud@192.168.1.137 "export PATH=\"/home/renaud/.nvm/versions/node/v24.14.1/bin:\$PATH\"; cd /home/renaud/storeflow-proxy && nohup node server.js > /tmp/proxy.log 2>&1 & disown; echo started"
```

Attendre 2 secondes puis vérifier :

```bash
sleep 2 && ssh renaud@192.168.1.137 "curl -s http://localhost:3001/api/parse-recipe -X POST -H 'Content-Type: application/json' -d '{\"rawText\":\"test\"}' | head -c 80"
```

Résultat attendu : JSON valide (proxy opérationnel).

- [ ] **Step 7 : Tester la nouvelle route avec une URL réelle**

```bash
ssh renaud@192.168.1.137 "curl -s -X POST http://localhost:3001/api/parse-recipe-steps-url -H 'Content-Type: application/json' -d '{\"url\":\"https://www.marmiton.org/recettes/recette_quiche-lorraine_11490.aspx\"}' | head -c 300"
```

Résultat attendu : `{"steps":["...", "..."]}` — au moins 2 étapes.

- [ ] **Step 8 : Tester la validation URL manquante**

```bash
ssh renaud@192.168.1.137 "curl -s -X POST http://localhost:3001/api/parse-recipe-steps-url -H 'Content-Type: application/json' -d '{}'"
```

Résultat attendu : `{"error":"url is required and must start with http:// or https://"}` avec status 400.

- [ ] **Step 9 : Commit proxy**

```bash
ssh renaud@192.168.1.137 "cd /home/renaud/storeflow-proxy && git add server.js && git commit -m 'feat: add parse-recipe-steps-url route'" 2>/dev/null || echo "no git in proxy, changes applied"
```

---

## Task 2 : Frontend — `parseRecipeStepsFromUrl` dans `mistral.ts`

**Files:**
- Modify: `src/services/mistral.ts`

- [ ] **Step 1 : Ajouter `parseRecipeStepsFromUrl` à la fin de `src/services/mistral.ts`**

```ts
export async function parseRecipeStepsFromUrl(
  url: string,
): Promise<{ steps: string[] }> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
  const endpoint = baseUrl.replace(/\/[^/]+$/, "/parse-recipe-steps-url");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur lors de l'extraction des étapes : ${res.status}`);
  }

  return (await res.json()) as { steps: string[] };
}
```

- [ ] **Step 2 : Vérifier le build TypeScript**

```powershell
cd "d:\Claude\StoreFlow"
npm run build
```

Résultat attendu : `✓ built` sans erreur TypeScript.

- [ ] **Step 3 : Commit**

```bash
cd "d:\Claude\StoreFlow"
git add src/services/mistral.ts
git commit -m "feat: add parseRecipeStepsFromUrl"
```

---

## Task 3 : Frontend — Champ URL dans `RecipeImportPreview`

**Files:**
- Modify: `src/components/recipes/RecipeImportPreview.tsx`

**Contexte :** Le fichier a déjà `PhotoCameraIcon`, `Alert`, `CircularProgress`, `Dialog*`, `replaceStepsConfirmOpen`, `pendingSteps`, `setSteps` — tout est réutilisable.

- [ ] **Step 1 : Ajouter l'import `LinkIcon` et `parseRecipeStepsFromUrl`**

En haut de `src/components/recipes/RecipeImportPreview.tsx`, ajouter après `PhotoCameraIcon` :

```ts
import LinkIcon from "@mui/icons-material/Link";
```

Et modifier la ligne d'import depuis mistral :

```ts
import { parseRecipeStepsFromImage, parseRecipeStepsFromUrl } from "../../services/mistral";
```

- [ ] **Step 2 : Ajouter les 3 états URL après les états image existants**

Dans le composant, après `const [pendingSteps, setPendingSteps] = useState<string[]>([]);` (ligne ~121) :

```ts
const [stepsUrl, setStepsUrl] = useState("");
const [stepsUrlParsing, setStepsUrlParsing] = useState(false);
const [stepsUrlError, setStepsUrlError] = useState<string | null>(null);
```

- [ ] **Step 3 : Ajouter le handler `handleStepsUrl`**

Dans le composant, après `handleStepsImageFile` :

```ts
const handleStepsUrl = async () => {
  if (!stepsUrl.trim()) return;
  setStepsUrlError(null);
  setStepsUrlParsing(true);
  try {
    const { steps: newSteps } = await parseRecipeStepsFromUrl(stepsUrl.trim());
    if (steps.length > 0) {
      setPendingSteps(newSteps);
      setReplaceStepsConfirmOpen(true);
    } else {
      setSteps(newSteps);
    }
    setStepsUrl("");
  } catch (err) {
    setStepsUrlError(err instanceof Error ? err.message : "Erreur lors de l'extraction des étapes");
  } finally {
    setStepsUrlParsing(false);
  }
};
```

- [ ] **Step 4 : Ajouter le champ URL + bouton dans la JSX**

Dans la JSX de `RecipeImportPreview`, trouver le `<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>` qui contient le titre "Étapes de préparation" et le bouton "Analyser une image". Remplacer ce Box par :

```tsx
<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
  <Typography variant="subtitle2" color="text.secondary">
    Étapes de préparation{steps.length > 0 ? ` (${steps.length})` : ""}
  </Typography>
  <Button
    size="small"
    variant="outlined"
    startIcon={<PhotoCameraIcon fontSize="small" />}
    onClick={() => { setStepsImageOpen(true); setStepsImageError(null); }}
    sx={{ ml: "auto" }}
  >
    Analyser une image
  </Button>
</Box>

{/* Champ URL pour les steps */}
<Box sx={{ display: "flex", gap: 1, mb: 1 }}>
  <TextField
    size="small"
    fullWidth
    placeholder="URL d'une recette (https://…)"
    value={stepsUrl}
    onChange={(e) => setStepsUrl(e.target.value)}
    disabled={stepsUrlParsing}
    onKeyDown={(e) => { if (e.key === "Enter") handleStepsUrl(); }}
  />
  <Button
    variant="outlined"
    size="small"
    startIcon={stepsUrlParsing ? <CircularProgress size={14} /> : <LinkIcon />}
    disabled={!stepsUrl.trim() || stepsUrlParsing}
    onClick={handleStepsUrl}
    sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
  >
    Extraire
  </Button>
</Box>
{stepsUrlError && (
  <Alert severity="error" sx={{ mb: 1 }} onClose={() => setStepsUrlError(null)}>
    {stepsUrlError}
  </Alert>
)}
```

Note : ce bloc JSX s'insère juste **avant** `{/* Mini-dialog upload image pour steps */}` et **après** le Box titre/bouton image.

- [ ] **Step 5 : Mettre à jour le message du ConfirmDialog pour couvrir image et URL**

Trouver dans la JSX le texte du dialog de confirmation :

```tsx
{steps.length} étape{steps.length > 1 ? "s" : ""} existante{steps.length > 1 ? "s" : ""} seront remplacées par les {pendingSteps.length} étapes extraites de l'image.
```

Remplacer par :

```tsx
{steps.length} étape{steps.length > 1 ? "s" : ""} existante{steps.length > 1 ? "s" : ""} seront remplacées par les {pendingSteps.length} nouvelles étapes.
```

- [ ] **Step 6 : Vérifier le build TypeScript**

```powershell
cd "d:\Claude\StoreFlow"
npm run build
```

Résultat attendu : `✓ built` sans erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
cd "d:\Claude\StoreFlow"
git add src/components/recipes/RecipeImportPreview.tsx
git commit -m "feat: add URL input for steps extraction in RecipeImportPreview"
```

---

## Task 4 : Déploiement et test

**Files:**
- Deploy: `dist/` → `Z:\storeflow\`

- [ ] **Step 1 : Build de production**

```powershell
cd "d:\Claude\StoreFlow"
npm run build
```

Résultat attendu : `✓ built` sans erreur.

- [ ] **Step 2 : Déployer sur le C300**

```powershell
Copy-Item "d:\Claude\StoreFlow\dist\*" "Z:\storeflow\" -Recurse -Force
```

- [ ] **Step 3 : Test — extraire étapes depuis URL**

Sur `http://noforgiv.freeboxos.fr:50010`, ouvrir une recette existante → "Modifier" → dans la section "Étapes de préparation", coller `https://www.marmiton.org/recettes/recette_quiche-lorraine_11490.aspx` → cliquer "Extraire". Vérifier que les étapes apparaissent.

- [ ] **Step 4 : Test — remplacement avec confirmation**

Sur la même recette avec des steps déjà présentes, coller une nouvelle URL → vérifier que le dialog "Remplacer les X étapes ?" s'ouvre → confirmer → vérifier que les steps sont remplacées et sauvegardées.

- [ ] **Step 5 : Pousser sur GitHub**

```bash
cd "d:\Claude\StoreFlow"
git push origin main
```
