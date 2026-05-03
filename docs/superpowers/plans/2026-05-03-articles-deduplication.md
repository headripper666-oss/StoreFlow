# Articles Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner les doublons (même nom + rayonId + unité) dans l'onglet Articles de Réglages, avec cascade des mutations sur toutes les occurrences du groupe.

**Architecture:** Tout dans `ArticlesRayonManager.tsx`. Une fonction `dedupe<T>()` groupe les items par clé composite. Les callbacks `onRayonChange`/`onPriceChange`/`onUnitChange` appellent `Promise.all` sur tous les ids du groupe. Aucune nouvelle prop, aucun nouveau fichier.

**Tech Stack:** React, TypeScript, MUI — même stack que le reste du fichier.

---

### Task 1 : Ajouter la fonction `dedupe` et mettre à jour les trois sections

**Files:**
- Modify: `src/components/settings/ArticlesRayonManager.tsx`

- [ ] **Step 1 : Ajouter la fonction utilitaire `dedupe` juste avant `ArticlesRayonManager`**

Insérer après la fermeture de l'interface `ArticlesRayonManagerProps` (après la ligne `}`), avant `function RayonSelect` :

```ts
function dedupe<T extends { id: string }>(
  items: T[],
  key: (item: T) => string,
): { representative: T; ids: string[] }[] {
  const map = new Map<string, { representative: T; ids: string[] }>();
  for (const item of items) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) {
      existing.ids.push(item.id);
    } else {
      map.set(k, { representative: item, ids: [item.id] });
    }
  }
  return [...map.values()];
}
```

- [ ] **Step 2 : Mettre à jour la section Indispensables dans `ArticlesRayonManager`**

Remplacer dans le corps de `ArticlesRayonManager` :

```ts
const filteredEssentials = essentials.filter((e) => matches(e.name));
```

par :

```ts
const dedupedEssentials = dedupe(
  essentials.filter((e) => matches(e.name)),
  (e) => `${normalize(e.name)}||${e.rayonId}||${normalize(e.unit ?? "pcs")}`,
);
```

Puis remplacer le rendu de la section Indispensables (le `.map` sur `filteredEssentials`) :

```tsx
{/* Essentials */}
<Accordion defaultExpanded={dedupedEssentials.length > 0} disableGutters sx={accordionSx}>
  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
    <Typography variant="subtitle2">🔖 Indispensables ({dedupedEssentials.length})</Typography>
  </AccordionSummary>
  <AccordionDetails sx={{ p: 0 }}>
    {dedupedEssentials.length === 0 ? (
      <Empty />
    ) : (
      dedupedEssentials.map(({ representative: e, ids }, idx) => (
        <Box key={e.id}>
          <Row
            name={e.name}
            rayonId={e.rayonId}
            pricePerUnit={e.pricePerUnit}
            unit={e.unit ?? "pcs"}
            rayons={rayons}
            disabled={isSaving}
            onRayonChange={(r) => Promise.all(ids.map((id) => onUpdateEssentialRayon(id, r)))}
            onPriceChange={(p) => Promise.all(ids.map((id) => onUpdateEssentialPrice(id, p)))}
            onUnitChange={(u) => Promise.all(ids.map((id) => onUpdateEssentialUnit(id, u)))}
          />
          {idx < dedupedEssentials.length - 1 && <Divider sx={{ ml: 2 }} />}
        </Box>
      ))
    )}
  </AccordionDetails>
</Accordion>
```

- [ ] **Step 3 : Mettre à jour la section Liste personnelle**

Remplacer :

```ts
const filteredList = personalList.filter((i) => matches(i.name));
```

par :

```ts
const dedupedList = dedupe(
  personalList.filter((i) => matches(i.name)),
  (i) => `${normalize(i.name)}||${i.rayonId}||${normalize(i.unit)}`,
);
```

Puis remplacer le rendu de la section Liste personnelle :

```tsx
{/* Personal list */}
<Accordion defaultExpanded={dedupedList.length > 0} disableGutters sx={accordionSx}>
  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
    <Typography variant="subtitle2">🛍 Liste personnelle ({dedupedList.length})</Typography>
  </AccordionSummary>
  <AccordionDetails sx={{ p: 0 }}>
    {dedupedList.length === 0 ? (
      <Empty label="Aucun article dans la liste" />
    ) : (
      dedupedList.map(({ representative: item, ids }, idx) => {
        const catalogMatch = catalog.find(
          (p) => normalize(p.name) === normalize(item.name),
        );
        return (
          <Box key={item.id}>
            <Row
              name={item.name}
              rayonId={item.rayonId}
              pricePerUnit={item.pricePerUnit}
              unit={item.unit}
              rayons={rayons}
              disabled={isSaving}
              onRayonChange={(r) => Promise.all(ids.map((id) => onUpdateListItemRayon(id, r)))}
              onPriceChange={(p) => Promise.all(ids.map((id) => onUpdateListItemPrice(id, p)))}
              onUnitChange={(u) => Promise.all(ids.map((id) => onUpdateListItemUnit(id, u)))}
              sublabel={
                catalogMatch
                  ? `→ met aussi à jour catalogue (${rayonLabel(catalogMatch.rayonId)})`
                  : undefined
              }
            />
            {idx < dedupedList.length - 1 && <Divider sx={{ ml: 2 }} />}
          </Box>
        );
      })
    )}
  </AccordionDetails>
</Accordion>
```

- [ ] **Step 4 : Étendre la clé de déduplication des ingrédients de recettes**

Dans la boucle `ingredientMap`, remplacer :

```ts
const key = normalize(ing.name);
```

par :

```ts
const key = `${normalize(ing.name)}||${ing.rayonId}||${normalize(ing.unit)}`;
```

Et dans la ligne `conflicted`, la comparaison `existing.rayonId !== ing.rayonId` devient inutile (deux ingrédients avec des rayons différents ont des clés différentes et ne seront plus fusionnés). Supprimer cette logique de conflit **uniquement pour les doublons inter-rayons** — le badge `conflicted` existant reste utile pour détecter quand le même ingrédient-nom est dans des rayons différents selon les recettes. Pour cela, garder un second `Map<normName, Set<rayonId>>` pour détecter les conflits de rayon par nom :

```ts
// Build unique ingredient list from all recipes
const ingredientMap = new Map<string, IngredientEntry>();
const ingredientRayons = new Map<string, Set<string>>(); // normName → rayonIds vus
for (const recipe of recipes) {
  for (const ing of recipe.ingredients) {
    const normName = normalize(ing.name);
    const key = `${normName}||${ing.rayonId}||${normalize(ing.unit)}`;
    const existing = ingredientMap.get(key);
    if (!existing) {
      const essentialMatch = essentials.find((e) => normalize(e.name) === normName);
      const catalogMatch = catalog.find(
        (p) => normalize(p.name) === normName || (p.aliases ?? []).some((a) => normalize(a) === normName),
      );
      ingredientMap.set(key, {
        name: ing.name,
        rayonId: essentialMatch?.rayonId ?? catalogMatch?.rayonId ?? ing.rayonId,
        pricePerUnit: essentialMatch?.pricePerUnit ?? catalogMatch?.pricePerUnit ?? ing.pricePerUnit,
        unit: essentialMatch?.unit ?? catalogMatch?.defaultUnit ?? ing.unit,
        conflicted: false,
        recipeCount: 1,
      });
    } else {
      existing.recipeCount++;
    }
    // Track rayons per name for conflict detection
    if (!ingredientRayons.has(normName)) ingredientRayons.set(normName, new Set());
    ingredientRayons.get(normName)!.add(ing.rayonId);
  }
}
// Mark conflicted if same name appears in multiple rayons
for (const [key, entry] of ingredientMap) {
  const normName = key.split("||")[0];
  const rayonSet = ingredientRayons.get(normName);
  if (rayonSet && rayonSet.size > 1) entry.conflicted = true;
}
```

- [ ] **Step 5 : Vérifier le build TypeScript**

```bash
npm run build
```

Attendu : `✓ built` sans erreur TypeScript.

- [ ] **Step 6 : Commit**

```bash
git add src/components/settings/ArticlesRayonManager.tsx
git commit -m "feat: dédupliquer les articles dans Réglages par nom+rayon+unité"
```

- [ ] **Step 7 : Déployer sur le C300**

```powershell
Copy-Item dist\* Z:\storeflow\ -Recurse -Force
```

Vérifier sur `http://noforgiv.freeboxos.fr:50010` → Réglages → Articles → rechercher "ail" → plus de doublons.
