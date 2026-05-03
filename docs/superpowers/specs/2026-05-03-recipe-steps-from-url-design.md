# Spec — Extraction des étapes de recette depuis une URL

**Date :** 2026-05-03  
**Statut :** Approuvé

---

## Contexte

StoreFlow permet déjà d'ajouter des étapes à une recette existante via analyse d'image (bouton "Analyser une image" dans `RecipeImportPreview`). Cette feature ajoute une deuxième source : une URL de page de recette. Le proxy C300 télécharge déjà des pages HTML pour `/api/parse-recipe` — on réutilise le même mécanisme.

---

## Fonctionnalité

Dans `RecipeImportPreview`, dans la zone "Étapes de préparation", à côté du bouton "Analyser une image" existant : un champ texte URL + bouton "Extraire depuis URL".

**Flux :**
1. L'utilisateur colle une URL dans le champ
2. Clique "Extraire depuis URL"
3. Le frontend envoie `{ url }` à `/api/parse-recipe-steps-url`
4. Le proxy télécharge la page, extrait le texte, appelle Mistral, retourne `{ steps: string[] }`
5. Si des steps existent déjà → `ConfirmDialog` "Remplacer les X étapes existantes ?"
6. Après confirmation (ou si pas de steps) → steps remplacées

---

## Backend — proxy C300

### Nouveau prompt `recipeStepsText`

Distinct de `recipeSteps` (qui est pour la vision). Adapté au texte brut extrait du HTML :

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
- Ignorer les publicités, commentaires, navigation et tout contenu non lié à la recette`
```

### `POST /api/parse-recipe-steps-url`

- **Body :** `{ url: string }`
- **Validation :** url requise, doit commencer par `http://` ou `https://`
- **Traitement :**
  1. `fetch(url)` avec User-Agent identique à `/api/parse-recipe`
  2. `extractTextFromHtml(html)` — fonction existante, limite 12 000 caractères
  3. `callMistral(PROMPTS.recipeStepsText, texte)`
- **Retourne :** `{ steps: string[] }`
- **Erreurs :** 400 si url manquante, 422 si page inaccessible (même pattern que `/api/parse-recipe`), 502 si Mistral échoue

---

## Frontend

### `src/services/mistral.ts`

Nouvelle fonction :

```ts
parseRecipeStepsFromUrl(url: string): Promise<{ steps: string[] }>
```

Appelle `/api/parse-recipe-steps-url` avec `{ url }`.

### `src/components/recipes/RecipeImportPreview.tsx`

Dans la zone "Étapes de préparation", après le bouton "Analyser une image" :

- Champ `TextField` avec placeholder "URL d'une recette (https://…)"
- Bouton "Extraire depuis URL" (icône `LinkIcon`)
- État de chargement inline (spinner)
- Alert d'erreur si échec
- Si steps retournées et steps existantes → réutilise le `ConfirmDialog` de remplacement déjà en place (`replaceStepsConfirmOpen` / `pendingSteps`)
- Si steps retournées et pas de steps existantes → remplacement direct

**États à ajouter :**
- `stepsUrl: string` — valeur du champ URL
- `stepsUrlParsing: boolean` — loading
- `stepsUrlError: string | null` — message d'erreur

---

## Flux de données

```
[URL saisie]
     ↓
  /api/parse-recipe-steps-url
     ↓  fetch page HTML
     ↓  extractTextFromHtml
     ↓  callMistral(recipeStepsText)
     ↓
  { steps: string[] }
     ↓
  RecipeImportPreview → ConfirmDialog → setSteps
```

---

## Hors périmètre

- Extraction des ingrédients depuis l'URL (uniquement les étapes)
- Support des pages JS-rendues (même limitation que `/api/parse-recipe`)
- Mise en cache des pages téléchargées
