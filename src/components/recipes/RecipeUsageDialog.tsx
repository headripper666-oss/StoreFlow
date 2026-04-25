import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { Rayon, Recipe, RecipeIngredient } from "../../types";
import { roundQuantity } from "../../utils/recipeUtils";

type IngredientRow = RecipeIngredient & { included: boolean };

interface RecipeUsageDialogProps {
  open: boolean;
  recipe: Recipe | null;
  rayons: Rayon[];
  isSaving: boolean;
  onAddToList: (ingredients: RecipeIngredient[]) => Promise<void>;
  onUpdateRecipe: (recipe: Recipe) => Promise<void>;
  onClose: () => void;
}

export function RecipeUsageDialog({
  open,
  recipe,
  rayons,
  isSaving,
  onAddToList,
  onUpdateRecipe,
  onClose,
}: RecipeUsageDialogProps) {
  const [guestCount, setGuestCount] = useState(4);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultRayonId = rayons[0]?.id ?? "autre";

  const handleEnter = () => {
    if (!recipe) return;
    setGuestCount(recipe.servings);
    setIngredients(
      recipe.ingredients.map((ing) => ({
        ...ing,
        rayonId: ing.rayonId ?? defaultRayonId,
        included: true,
      })),
    );
    setEditingIdx(null);
    setError(null);
  };

  const handleGuestCountChange = (newCount: number) => {
    if (!recipe) return;
    const count = Math.max(1, Math.min(50, newCount));
    setGuestCount(count);
    const scale = count / recipe.servings;
    setIngredients((prev) =>
      prev.map((ing, i) => ({
        ...ing,
        quantity: roundQuantity(
          recipe.ingredients[i].quantity * scale,
          ing.unit,
        ),
      })),
    );
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

  const handleAddOnly = async () => {
    setError(null);
    try {
      await onAddToList(
        selectedIngredients.map(({ included: _included, ...ing }) => ing),
      );
      onClose();
    } catch {
      setError("Erreur lors de l'ajout à la liste.");
    }
  };

  const handleAddAndSave = async () => {
    if (!recipe) return;
    setError(null);
    const scale = guestCount / recipe.servings;
    const unscaled = ingredients.map(({ included: _included, ...ing }) => ({
      ...ing,
      quantity: roundQuantity(ing.quantity / scale, ing.unit),
    }));
    try {
      await onUpdateRecipe({ ...recipe, ingredients: unscaled });
      await onAddToList(
        selectedIngredients.map(({ included: _included, ...ing }) => ing),
      );
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde de la recette.");
    }
  };

  if (!recipe) return null;

  const scale = guestCount / recipe.servings;
  const scaleLabel =
    scale === 1
      ? `Base : ${recipe.servings} pers.`
      : `Base : ${recipe.servings} pers. — ×${Number.isInteger(scale) ? scale : scale.toFixed(2)}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ transition: { onEnter: handleEnter } }}
    >
      <DialogTitle sx={{ pb: 1 }}>{recipe.name}</DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Guest count */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "action.hover",
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

          {/* Selection count */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: "right", pr: 0.5 }}
          >
            {selectedIngredients.length} / {ingredients.length} ingrédients
            sélectionnés
          </Typography>

          {/* Ingredient list */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
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
                        onChange={(e) =>
                          updateField(idx, "unit", e.target.value)
                        }
                        sx={{ width: 90 }}
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
                    {/* Checkbox */}
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: "4px",
                        border: "2px solid",
                        borderColor: ing.included ? "primary.main" : "divider",
                        bgcolor: ing.included
                          ? "primary.main"
                          : "background.paper",
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
                          textDecoration: ing.included
                            ? "none"
                            : "line-through",
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

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, flexDirection: "column", gap: 1 }}>
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
          <span>Ajouter + sauvegarder la recette</span>
          <span style={{ opacity: 0.7, fontSize: "0.75rem", fontWeight: 400 }}>
            enregistre les quantités
          </span>
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={onClose}
          disabled={isSaving}
          sx={{ color: "text.secondary" }}
        >
          Annuler
        </Button>
      </DialogActions>
    </Dialog>
  );
}
