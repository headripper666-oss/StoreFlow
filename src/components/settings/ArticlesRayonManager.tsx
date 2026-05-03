import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { CatalogProduct, EssentialItem, ListItem, Rayon, Recipe } from "../../types";
import { normalize } from "../../utils/recipeUtils";

interface ArticlesRayonManagerProps {
  essentials: EssentialItem[];
  personalList: ListItem[];
  catalog: CatalogProduct[];
  recipes: Recipe[];
  rayons: Rayon[];
  isSaving: boolean;
  onUpdateEssentialRayon: (id: string, rayonId: string) => Promise<void>;
  onUpdateRecipeIngredientRayon: (name: string, rayonId: string) => Promise<void>;
  onUpdateListItemRayon: (id: string, rayonId: string) => Promise<void>;
  onUpdateCatalogProductRayon: (id: string, rayonId: string) => Promise<void>;
  onUpdateEssentialPrice: (id: string, price: number | undefined) => Promise<void>;
  onUpdateListItemPrice: (id: string, price: number | undefined) => Promise<void>;
  onUpdateCatalogProductPrice: (id: string, price: number | undefined) => Promise<void>;
  onUpdateRecipeIngredientPrice: (name: string, price: number | undefined) => Promise<void>;
  onUpdateEssentialUnit: (id: string, unit: string) => Promise<void>;
  onUpdateListItemUnit: (id: string, unit: string) => Promise<void>;
  onUpdateCatalogProductUnit: (id: string, unit: string) => Promise<void>;
  onUpdateRecipeIngredientUnit: (name: string, unit: string) => Promise<void>;
}

interface IngredientEntry {
  name: string;
  rayonId: string;
  pricePerUnit?: number;
  unit: string;
  conflicted: boolean;
  recipeCount: number;
}

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

function RayonSelect({
  value,
  rayons,
  disabled,
  onChange,
}: {
  value: string;
  rayons: Rayon[];
  disabled: boolean;
  onChange: (rayonId: string) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      size="small"
      sx={{ minWidth: 140, fontSize: "0.8rem" }}
    >
      {rayons.map((r) => (
        <MenuItem key={r.id} value={r.id} sx={{ fontSize: "0.85rem" }}>
          {r.icon} {r.label}
        </MenuItem>
      ))}
    </Select>
  );
}

export function ArticlesRayonManager({
  essentials,
  personalList,
  catalog,
  recipes,
  rayons,
  isSaving,
  onUpdateEssentialRayon,
  onUpdateRecipeIngredientRayon,
  onUpdateListItemRayon,
  onUpdateCatalogProductRayon,
  onUpdateEssentialPrice,
  onUpdateListItemPrice,
  onUpdateCatalogProductPrice,
  onUpdateRecipeIngredientPrice,
  onUpdateEssentialUnit,
  onUpdateListItemUnit,
  onUpdateCatalogProductUnit,
  onUpdateRecipeIngredientUnit,
}: ArticlesRayonManagerProps) {
  const [search, setSearch] = useState("");

  const q = normalize(search.trim());
  const matches = (name: string) => !q || normalize(name).includes(q);

  // Build unique ingredient list from all recipes
  const ingredientMap = new Map<string, IngredientEntry>();
  const ingredientRayons = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const normName = normalize(ing.name);
      const key = `${normName}||${ing.rayonId}||${normalize(ing.unit)}`;
      const existing = ingredientMap.get(key);
      if (!existing) {
        // Resolve: essential > catalog > ingredient's own data
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
      if (!ingredientRayons.has(normName)) ingredientRayons.set(normName, new Set());
      ingredientRayons.get(normName)!.add(ing.rayonId);
    }
  }
  for (const [key, entry] of ingredientMap) {
    const normName = key.split("||")[0];
    const rayonSet = ingredientRayons.get(normName);
    if (rayonSet && rayonSet.size > 1) entry.conflicted = true;
  }
  const ingredients = [...ingredientMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );

  const dedupedEssentials = dedupe(
    essentials.filter((e) => matches(e.name)),
    (e) => `${normalize(e.name)}||${e.rayonId}||${normalize(e.unit ?? "pcs")}`,
  );
  const filteredIngredients = ingredients.filter((i) => matches(i.name));
  const dedupedList = dedupe(
    personalList.filter((i) => matches(i.name)),
    (i) => `${normalize(i.name)}||${i.rayonId}||${normalize(i.unit)}`,
  );
  const filteredCatalog = catalog.filter((p) => matches(p.name));

  const rayonLabel = (id: string) => rayons.find((r) => r.id === id)?.label ?? id;

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Rechercher un article…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

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

      {/* Recipe ingredients */}
      <Accordion defaultExpanded={false} disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
          <Typography variant="subtitle2">📖 Ingrédients de recettes ({filteredIngredients.length})</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {filteredIngredients.length === 0 ? (
            <Empty />
          ) : (
            filteredIngredients.map((ing, idx) => (
              <Box key={ing.name}>
                <Row
                  name={ing.name}
                  rayonId={ing.rayonId}
                  pricePerUnit={ing.pricePerUnit}
                  unit={ing.unit}
                  rayons={rayons}
                  disabled={isSaving}
                  onRayonChange={(r) => onUpdateRecipeIngredientRayon(ing.name, r)}
                  onPriceChange={(p) => onUpdateRecipeIngredientPrice(ing.name, p)}
                  onUnitChange={(u) => onUpdateRecipeIngredientUnit(ing.name, u)}
                  badge={
                    ing.conflicted ? (
                      <Tooltip title={`Rayon différent dans certaines recettes (${ing.recipeCount} recettes)`}>
                        <WarningAmberIcon sx={{ fontSize: 16, color: "warning.main", flexShrink: 0 }} />
                      </Tooltip>
                    ) : undefined
                  }
                  sublabel={`${ing.recipeCount} recette${ing.recipeCount > 1 ? "s" : ""}`}
                />
                {idx < filteredIngredients.length - 1 && <Divider sx={{ ml: 2 }} />}
              </Box>
            ))
          )}
        </AccordionDetails>
      </Accordion>

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

      {/* Catalog */}
      <Accordion defaultExpanded={false} disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summarySx}>
          <Typography variant="subtitle2">📦 Catalogue ({filteredCatalog.length})</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {filteredCatalog.length === 0 ? (
            <Empty label="Catalogue vide" />
          ) : (
            filteredCatalog.map((p, idx) => (
              <Box key={p.id}>
                <Row
                  name={p.name}
                  rayonId={p.rayonId}
                  pricePerUnit={p.pricePerUnit}
                  unit={p.defaultUnit}
                  rayons={rayons}
                  disabled={isSaving}
                  onRayonChange={(r) => onUpdateCatalogProductRayon(p.id, r)}
                  onPriceChange={(price) => onUpdateCatalogProductPrice(p.id, price)}
                  onUnitChange={(unit) => onUpdateCatalogProductUnit(p.id, unit)}
                />
                {idx < filteredCatalog.length - 1 && <Divider sx={{ ml: 2 }} />}
              </Box>
            ))
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

function Row({
  name,
  rayonId,
  pricePerUnit,
  unit,
  rayons,
  disabled,
  onRayonChange,
  onPriceChange,
  onUnitChange,
  badge,
  sublabel,
}: {
  name: string;
  rayonId: string;
  pricePerUnit?: number;
  unit: string;
  rayons: Rayon[];
  disabled: boolean;
  onRayonChange: (r: string) => void;
  onPriceChange: (p: number | undefined) => void;
  onUnitChange: (u: string) => void;
  badge?: React.ReactNode;
  sublabel?: string;
}) {
  const [localPrice, setLocalPrice] = useState(pricePerUnit?.toString() ?? "");
  const [localUnit, setLocalUnit] = useState(unit);

  useEffect(() => {
    setLocalPrice(pricePerUnit?.toString() ?? "");
  }, [pricePerUnit]);

  useEffect(() => {
    setLocalUnit(unit);
  }, [unit]);

  const handlePriceBlur = () => {
    const v = parseFloat(localPrice);
    const newVal = isNaN(v) ? undefined : v;
    if (newVal !== pricePerUnit) {
      onPriceChange(newVal);
    }
  };

  const handleUnitBlur = () => {
    if (localUnit !== unit) {
      onUnitChange(localUnit);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1, gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </Typography>
        {sublabel && (
          <Typography variant="caption" color="text.secondary">
            {sublabel}
          </Typography>
        )}
      </Box>
      {badge}
      <TextField
        size="small"
        placeholder="Unité"
        value={localUnit}
        onChange={(e) => setLocalUnit(e.target.value)}
        onBlur={handleUnitBlur}
        disabled={disabled}
        sx={{ width: 70, "& .MuiInputBase-input": { fontSize: "0.8rem", p: "6px 8px" } }}
      />
      <TextField
        type="number"
        size="small"
        placeholder="Prix €"
        value={localPrice}
        onChange={(e) => setLocalPrice(e.target.value)}
        onBlur={handlePriceBlur}
        disabled={disabled}
        sx={{ width: 100, "& .MuiInputBase-input": { fontSize: "0.8rem", p: "6px 8px" } }}
        slotProps={{
          input: {
            endAdornment: <InputAdornment position="end" sx={{ "& .MuiTypography-root": { fontSize: "0.75rem" } }}>€</InputAdornment>,
          },
        }}
      />
      <RayonSelect value={rayonId} rayons={rayons} disabled={disabled} onChange={onRayonChange} />
    </Box>
  );
}

function Empty({ label = "Aucun résultat" }: { label?: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
      {label}
    </Typography>
  );
}

const accordionSx = {
  mb: 0.5,
  borderRadius: "12px !important",
  overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "none",
  "&:before": { display: "none" },
};

const summarySx = { minHeight: 48, px: 2, "&.Mui-expanded": { minHeight: 48 } };
