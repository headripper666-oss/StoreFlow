import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import EditNoteIcon from "@mui/icons-material/EditNote";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { CatalogProduct, Rayon, Recipe, RecipeHistoryEntry, RecipeIngredient } from "../../types";
import { computeRecipeCalories, findInCatalog, normalize, roundQuantity } from "../../utils/recipeUtils";
import { RecipeImportPreview } from "../recipes/RecipeImportPreview";

const EDIT_COLOR = "#E65100";

type IngredientRow = RecipeIngredient & { included: boolean; baseQty: number };

interface RecipeDetailPanelProps {
  recipe: Recipe | null;
  editingRecipe?: Recipe | null;
  rayons: Rayon[];
  catalog: CatalogProduct[];
  allTags: string[];
  isSaving: boolean;
  onAddToList: (ingredients: RecipeIngredient[]) => Promise<void>;
  onUpdateRecipe: (recipe: Recipe) => Promise<void>;
  onRecordHistory?: (entry: RecipeHistoryEntry) => Promise<void>;
  onConfirmEdit?: (recipe: Recipe) => Promise<void>;
  onCancelEdit?: () => void;
  onUpdateEditingRecipe?: (recipe: Recipe) => void;
}

export function RecipeDetailPanel({
  recipe,
  editingRecipe,
  rayons,
  catalog,
  allTags,
  isSaving,
  onAddToList,
  onUpdateRecipe,
  onRecordHistory,
  onConfirmEdit,
  onCancelEdit,
  onUpdateEditingRecipe,
}: RecipeDetailPanelProps) {
  const [guestCount, setGuestCount] = useState(4);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newUnit, setNewUnit] = useState("pcs");
  const [newRayonId, setNewRayonId] = useState("");
  const [newPrice, setNewPrice] = useState<number | undefined>(undefined);

  const defaultRayonId = rayons[0]?.id ?? "autre";

  useEffect(() => {
    if (!recipe) return;
    setGuestCount(recipe.servings);
    setIngredients(
      recipe.ingredients.map((ing) => {
        const catalogMatch = catalog.find(c => normalize(c.name) === normalize(ing.name));
        return {
          ...ing,
          rayonId: ing.rayonId ?? defaultRayonId,
          pricePerUnit: ing.pricePerUnit ?? catalogMatch?.pricePerUnit,
          included: true,
          baseQty: ing.quantity,
        };
      }),
    );
    setEditingIdx(null);
    setError(null);
    setSuccess(false);
    setAddOpen(false);
    setNewName("");
    setNewQty(1);
    setNewUnit("pcs");
    setNewRayonId(defaultRayonId);
  }, [recipe?.id]);

  // Mettre à jour caloriesPerUnit en temps réel quand les ingrédients changent (ex: édition via Réglages)
  useEffect(() => {
    if (!recipe) return;
    setIngredients((prev) =>
      prev.map((row) => {
        const updated = recipe.ingredients.find((ing) => normalize(ing.name) === normalize(row.name));
        if (!updated) return row;
        return { ...row, caloriesPerUnit: updated.caloriesPerUnit };
      }),
    );
  }, [recipe?.ingredients]);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editingRecipe && onConfirmEdit && onCancelEdit) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Amber edit-mode header */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderBottom: `2px solid ${EDIT_COLOR}`,
            background: `linear-gradient(135deg, rgba(230,81,0,0.08) 0%, rgba(230,81,0,0.03) 100%)`,
            flexShrink: 0,
          }}
        >
          <EditNoteIcon sx={{ color: EDIT_COLOR, fontSize: 22 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ color: EDIT_COLOR, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", fontSize: "0.65rem" }}
            >
              Modification en cours
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {editingRecipe.name}
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={onCancelEdit}
            sx={{ color: EDIT_COLOR, borderColor: EDIT_COLOR, flexShrink: 0 }}
            variant="outlined"
          >
            Annuler
          </Button>
        </Box>

        {/* Scrollable form */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
          <RecipeImportPreview
            key={editingRecipe.id}
            parsed={{ name: editingRecipe.name, servings: editingRecipe.servings, ingredients: editingRecipe.ingredients, steps: editingRecipe.steps }}
            rayons={rayons}
            catalog={catalog}
            isSaving={isSaving}
            allTags={allTags}
            initialTags={editingRecipe.tags}
            title=""
            confirmLabel="Enregistrer les modifications"
            showCatalogStatus={false}
            onConfirm={onConfirmEdit}
            onCancel={onCancelEdit}
            onTagsChange={async (tags) => {
              const updated = { ...editingRecipe, tags };
              onUpdateEditingRecipe?.(updated);
              await onUpdateRecipe({ ...updated });
            }}
          />
        </Box>
      </Box>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!recipe) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          gap: 2,
          px: 3,
        }}
      >
        <MenuBookIcon sx={{ fontSize: 48, opacity: 0.2 }} />
        <Typography variant="body1" align="center" sx={{ fontWeight: 500 }}>
          Sélectionnez une recette
        </Typography>
        <Typography variant="body2" align="center" sx={{ opacity: 0.6 }}>
          Les ingrédients et les options s'afficheront ici
        </Typography>
      </Box>
    );
  }

  const handleTagsChange = async (_: unknown, newValue: string[]) => {
    setIsSavingTags(true);
    try {
      await onUpdateRecipe({ ...recipe, tags: newValue });
    } finally {
      setIsSavingTags(false);
    }
  };

  const handleGuestCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(50, newCount));
    setGuestCount(count);
    const scale = count / recipe.servings;
    setIngredients((prev) =>
      prev.map((ing) => ({
        ...ing,
        quantity: roundQuantity(ing.baseQty * scale, ing.unit),
      })),
    );
  };

  const handleCatalogSelect = (_: unknown, value: string | null) => {
    const found = findInCatalog(value ?? "", catalog);
    setNewName(value ?? "");
    if (found) {
      setNewUnit(found.defaultUnit);
      setNewRayonId(found.rayonId);
      setNewPrice(found.pricePerUnit);
    }
  };

  const handleAddIngredient = () => {
    if (!newName.trim() || newQty <= 0) return;
    const scale = guestCount / recipe.servings;
    const baseQty = roundQuantity(newQty / scale, newUnit);
    setIngredients((prev) => [
      ...prev,
      {
        name: newName.trim(),
        quantity: newQty,
        unit: newUnit,
        rayonId: newRayonId || defaultRayonId,
        pricePerUnit: newPrice,
        included: true,
        baseQty,
      },
    ]);
    setAddOpen(false);
    setNewName("");
    setNewQty(1);
    setNewUnit("pcs");
    setNewRayonId(defaultRayonId);
    setNewPrice(undefined);
  };

  const toggleIngredient = (idx: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === idx ? { ...ing, included: !ing.included } : ing,
      ),
    );
  };

  const updateField = (
    idx: number,
    field: keyof RecipeIngredient,
    value: string | number,
  ) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
    );
  };

  const selectedIngredients = ingredients.filter((ing) => ing.included);

  const buildHistoryEntry = (): RecipeHistoryEntry => ({
    recipeId: recipe!.id,
    recipeName: recipe!.name,
    lastUsedAt: new Date().toISOString(),
    lastGuests: guestCount,
    baseServings: recipe!.servings,
    ingredients: selectedIngredients.map(({ included: _i, baseQty: _b, ...ing }) => ing),
    steps: recipe!.steps,
  });

  const recipeTotal = selectedIngredients.reduce((sum, ing) => {
    if (ing.pricePerUnit && ing.quantity) {
      return sum + ing.pricePerUnit * ing.quantity;
    }
    return sum;
  }, 0);

  // Calculer les calories depuis recipe.ingredients (source de vérité fraîche),
  // en filtrant les ingrédients décochés et en appliquant le scale
  const selectedNames = new Set(selectedIngredients.map((i) => normalize(i.name)));
  const freshSelectedIngredients = recipe.ingredients.filter((ing) => selectedNames.has(normalize(ing.name)));
  const totalKcal = computeRecipeCalories(freshSelectedIngredients, guestCount, recipe.servings);
  const kcalPerPerson = totalKcal !== null && guestCount > 0 ? Math.round(totalKcal / guestCount) : null;

  const scale = guestCount / recipe.servings;
  const scaleLabel =
    scale === 1
      ? `Base : ${recipe.servings} pers.`
      : `×${Number.isInteger(scale) ? scale : scale.toFixed(2)} (base ${recipe.servings} pers.)`;

  const handleAddOnly = async () => {
    setError(null);
    try {
      await onAddToList(
        selectedIngredients.map(({ included: _included, baseQty: _baseQty, ...ing }) => ing),
      );
      onRecordHistory?.(buildHistoryEntry());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Erreur lors de l'ajout à la liste.");
    }
  };

  const handleAddAndSave = async () => {
    setError(null);
    const unscaled = ingredients.map(({ included: _included, baseQty, ...ing }) => ({
      ...ing,
      quantity: roundQuantity(baseQty, ing.unit),
    }));
    try {
      await onUpdateRecipe({ ...recipe, ingredients: unscaled });
      await onAddToList(
        selectedIngredients.map(({ included: _included, baseQty: _b, ...ing }) => ing),
      );
      onRecordHistory?.(buildHistoryEntry());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Erreur lors de la sauvegarde.");
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          {recipe.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {recipe.ingredients.length} ingrédients
        </Typography>
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={allTags}
          value={recipe.tags ?? []}
          onChange={handleTagsChange}
          disabled={isSavingTags || isSaving}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={(recipe.tags ?? []).length === 0 ? "Ajouter un tag..." : ""}
              label="Tags"
            />
          )}
        />
      </Box>

      {/* Guest counter */}
      <Box
        sx={{
          mx: 2.5,
          mt: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "rgba(28, 61, 48, 0.05)",
          borderRadius: 2,
          px: 2,
          py: 1.25,
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Personnes
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {scaleLabel}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {recipeTotal > 0 && (
            <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700, mr: 1 }}>
              {recipeTotal.toFixed(2)} €
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={() => handleGuestCountChange(guestCount - 1)}
            disabled={guestCount <= 1}
            sx={{
              border: "1.5px solid",
              borderColor: "primary.main",
              width: 28,
              height: 28,
              "&.Mui-disabled": { borderColor: "action.disabled" },
            }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="h6"
            sx={{ width: 28, textAlign: "center", color: "primary.main" }}
          >
            {guestCount}
          </Typography>
          <IconButton
            size="small"
            onClick={() => handleGuestCountChange(guestCount + 1)}
            sx={{
              border: "1.5px solid",
              borderColor: "primary.main",
              width: 28,
              height: 28,
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Selection count + calories */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pr: 2.5, pl: 2.5, pt: 1 }}>
        {totalKcal !== null ? (
          <Typography variant="caption" color="text.secondary">
            ~{totalKcal} kcal · {kcalPerPerson} kcal/pers
          </Typography>
        ) : <Box />}
        <Typography variant="caption" color="text.secondary">
          {selectedIngredients.length}/{ingredients.length} sélectionnés
        </Typography>
      </Box>

      {/* Ingredient list */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          mx: 2.5,
          mt: 0.5,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        {ingredients.map((ing, idx) => (
          <Box key={idx}>
            {editingIdx === idx ? (
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <TextField
                  size="small"
                  label="Ingrédient"
                  value={ing.name}
                  onChange={(e) => updateField(idx, "name", e.target.value)}
                  fullWidth
                />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    size="small"
                    label="Qté"
                    type="number"
                    value={ing.quantity}
                    onChange={(e) =>
                      updateField(
                        idx,
                        "quantity",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    sx={{ width: 80 }}
                    slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
                  />
                  <TextField
                    size="small"
                    label="Unité"
                    value={ing.unit}
                    onChange={(e) => updateField(idx, "unit", e.target.value)}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    size="small"
                    label="Prix €"
                    type="number"
                    value={ing.pricePerUnit ?? ""}
                    onChange={(e) => updateField(idx, "pricePerUnit", parseFloat(e.target.value) || 0)}
                    sx={{ width: 80 }}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  />
                  <TextField
                    size="small"
                    label="kcal/unité"
                    type="number"
                    value={ing.caloriesPerUnit ?? ""}
                    onChange={(e) => updateField(idx, "caloriesPerUnit", parseFloat(e.target.value) || 0)}
                    sx={{ width: 90 }}
                    slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
                  />
                  <Select
                    size="small"
                    value={ing.rayonId}
                    onChange={(e) =>
                      updateField(idx, "rayonId", e.target.value)
                    }
                    sx={{ flex: 1 }}
                  >
                    {rayons.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.icon} {r.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setEditingIdx(null)}
                >
                  OK
                </Button>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.5,
                  py: 1,
                  cursor: "pointer",
                  opacity: ing.included ? 1 : 0.4,
                  bgcolor: ing.included ? "transparent" : "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
                onClick={() => toggleIngredient(idx)}
              >
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: "4px",
                    border: "2px solid",
                    borderColor: ing.included ? "primary.main" : "divider",
                    bgcolor: ing.included ? "primary.main" : "background.paper",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "white",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {ing.included ? "✓" : ""}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      textDecoration: ing.included ? "none" : "line-through",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ing.name}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.75,
                      alignItems: "center",
                      flexWrap: "wrap",
                      mt: 0.25,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {ing.quantity} {ing.unit}
                      {ing.pricePerUnit && ` · ${(ing.pricePerUnit * ing.quantity).toFixed(2)} €`}
                      {ing.caloriesPerUnit !== undefined && ` · ${Math.round(ing.caloriesPerUnit * ing.quantity)} kcal`}
                    </Typography>
                    <Chip
                      label={`${rayons.find((r) => r.id === ing.rayonId)?.icon ?? ""} ${rayons.find((r) => r.id === ing.rayonId)?.label ?? ing.rayonId}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.65rem" }}
                    />
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingIdx(idx);
                  }}
                  sx={{ flexShrink: 0, color: "text.disabled" }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
            {idx < ingredients.length - 1 && <Divider />}
          </Box>
        ))}
      </Box>

      {/* Steps */}
      {(recipe.steps ?? []).length > 0 && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            mx: 2.5,
            mt: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px !important",
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, px: 2, "&.Mui-expanded": { minHeight: 40 } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Préparation · {recipe.steps!.length} étape{recipe.steps!.length > 1 ? "s" : ""}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
            {recipe.steps!.map((step, idx) => (
              <Box key={idx} sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 20, height: 20, borderRadius: "50%",
                    bgcolor: "primary.main", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.65rem", fontWeight: 700, flexShrink: 0, mt: 0.2,
                  }}
                >
                  {idx + 1}
                </Box>
                <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.6 }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Add ingredient */}
      <Box sx={{ mx: 2.5, mt: 1 }}>
        {!addOpen ? (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => { setAddOpen(true); setNewRayonId(defaultRayonId); }}
            sx={{ color: "text.secondary" }}
          >
            Ajouter un ingrédient
          </Button>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Autocomplete
              freeSolo
              size="small"
              options={catalog.map((c) => c.name)}
              inputValue={newName}
              onInputChange={(_, v) => setNewName(v)}
              onChange={handleCatalogSelect}
              renderInput={(params) => (
                <TextField {...params} label="Ingrédient" autoFocus />
              )}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                label="Qté"
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                sx={{ width: 80 }}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              />
              <TextField
                size="small"
                label="Unité"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                sx={{ width: 90 }}
              />
              <Select
                size="small"
                value={newRayonId || defaultRayonId}
                onChange={(e) => setNewRayonId(e.target.value)}
                sx={{ flex: 1 }}
              >
                {rayons.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.icon} {r.label}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="contained" onClick={handleAddIngredient} disabled={!newName.trim() || newQty <= 0}>
                Valider
              </Button>
              <Button size="small" onClick={() => setAddOpen(false)}>
                Annuler
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 0.5 }}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 0.5 }}>
            Ajouté à la liste !
          </Alert>
        )}
        {(recipe?.steps ?? []).length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Étapes
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, m: 0, mb: 1 }}>
              {(recipe?.steps ?? []).map((step, idx) => (
                <Box component="li" key={idx} sx={{ mb: 1 }}>
                  <Typography variant="body2">{step}</Typography>
                </Box>
              ))}
            </Box>
            <Divider sx={{ mb: 1 }} />
          </>
        )}
        <Button
          variant="contained"
          fullWidth
          onClick={handleAddOnly}
          disabled={isSaving || selectedIngredients.length === 0}
          sx={{ justifyContent: "space-between" }}
        >
          <span>Ajouter à la liste</span>
          <span style={{ opacity: 0.8, fontSize: "0.75rem", fontWeight: 400 }}>
            {selectedIngredients.length} ingrédient
            {selectedIngredients.length > 1 ? "s" : ""}
          </span>
        </Button>
        <Button
          variant="outlined"
          fullWidth
          onClick={handleAddAndSave}
          disabled={isSaving || selectedIngredients.length === 0}
          sx={{ justifyContent: "space-between" }}
        >
          <span>Ajouter + sauvegarder</span>
          <span style={{ opacity: 0.7, fontSize: "0.75rem", fontWeight: 400 }}>
            enregistre les quantités
          </span>
        </Button>
      </Box>
    </Box>
  );
}
