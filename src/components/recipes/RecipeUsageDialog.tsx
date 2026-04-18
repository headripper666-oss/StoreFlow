import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Box,
  Button,
  Card,
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

type Step = "count" | "ingredients";

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
  const [step, setStep] = useState<Step>("count");
  const [guestCount, setGuestCount] = useState<number>(recipe?.servings ?? 4);
  const [editedIngredients, setEditedIngredients] = useState<
    RecipeIngredient[]
  >([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens with a new recipe
  const handleEnter = () => {
    if (!recipe) return;
    setStep("count");
    setGuestCount(recipe.servings);
    setEditingIdx(null);
    setError(null);
  };

  const handleGoToIngredients = () => {
    if (!recipe) return;
    const scale = guestCount / recipe.servings;
    const scaled = recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: roundQuantity(ing.quantity * scale, ing.unit),
    }));
    setEditedIngredients(scaled);
    setEditingIdx(null);
    setStep("ingredients");
  };

  const updateField = (
    idx: number,
    field: keyof RecipeIngredient,
    value: string | number,
  ) => {
    setEditedIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
    );
  };

  const handleAddOnly = async () => {
    setError(null);
    try {
      await onAddToList(editedIngredients);
      onClose();
    } catch {
      setError("Erreur lors de l'ajout à la liste.");
    }
  };

  const handleAddAndSave = async () => {
    if (!recipe) return;
    setError(null);
    const scale = guestCount / recipe.servings;
    const unscaled = editedIngredients.map((ing) => ({
      ...ing,
      quantity: roundQuantity(ing.quantity / scale, ing.unit),
    }));
    try {
      await onUpdateRecipe({ ...recipe, ingredients: unscaled });
      await onAddToList(editedIngredients);
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde de la recette.");
    }
  };

  if (!recipe) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ transition: { onEnter: handleEnter } }}
    >
      {step === "count" ? (
        <>
          <DialogTitle>Utiliser — {recipe.name}</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                pt: 0.5,
              }}
            >
              <Typography>Pour combien de personnes ?</Typography>
              <TextField
                type="number"
                label="Nombre de personnes"
                value={guestCount}
                onChange={(e) =>
                  setGuestCount(Math.max(1, parseInt(e.target.value) || 1))
                }
                slotProps={{ htmlInput: { min: 1, max: 50 } }}
                size="small"
                sx={{ width: 200 }}
              />
              <Typography variant="body2" color="text.secondary">
                La recette de base est prévue pour {recipe.servings} personne
                {recipe.servings > 1 ? "s" : ""}. Les quantités seront ajustées
                automatiquement.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} variant="outlined">
              Annuler
            </Button>
            <Button onClick={handleGoToIngredients} variant="contained">
              Voir les ingrédients
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>
            {recipe.name} — {guestCount} personne{guestCount > 1 ? "s" : ""}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}
            >
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                {editedIngredients.map((ing, idx) => (
                  <Box key={idx}>
                    <Box sx={{ px: 2, py: 1.5 }}>
                      {editingIdx === idx ? (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                          }}
                        >
                          <TextField
                            size="small"
                            label="Ingrédient"
                            value={ing.name}
                            onChange={(e) =>
                              updateField(idx, "name", e.target.value)
                            }
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
                            onClick={() => setEditingIdx(null)}
                            variant="outlined"
                          >
                            OK
                          </Button>
                        </Box>
                      ) : (
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: 500,
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
                                mt: 0.25,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
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
                      )}
                    </Box>
                    {idx < editedIngredients.length - 1 && <Divider />}
                  </Box>
                ))}
              </Card>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, flexDirection: "column", gap: 1 }}>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                width: "100%",
                justifyContent: "flex-end",
              }}
            >
              <Button
                onClick={onClose}
                variant="outlined"
                size="small"
                disabled={isSaving}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddOnly}
                variant="outlined"
                color="primary"
                size="small"
                disabled={isSaving}
              >
                Ce voyage seulement
              </Button>
              <Button
                onClick={handleAddAndSave}
                variant="contained"
                size="small"
                disabled={isSaving}
              >
                {isSaving ? "Sauvegarde..." : "Ajouter + Sauvegarder"}
              </Button>
            </Box>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
