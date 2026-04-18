import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import {
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
  ParsedRecipe,
  Rayon,
  Recipe,
  RecipeIngredient,
} from "../../types";

interface RecipeImportPreviewProps {
  parsed: ParsedRecipe;
  rayons: Rayon[];
  isSaving: boolean;
  onConfirm: (recipe: Recipe) => Promise<void>;
  onCancel: () => void;
}

export function RecipeImportPreview({
  parsed,
  rayons,
  isSaving,
  onConfirm,
  onCancel,
}: RecipeImportPreviewProps) {
  const [name, setName] = useState(parsed.name);
  const [servings, setServings] = useState(parsed.servings);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    parsed.ingredients,
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const updateField = (
    idx: number,
    field: keyof RecipeIngredient,
    value: string | number,
  ) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
    );
  };

  const addIngredient = () => {
    const newIdx = ingredients.length;
    setIngredients((prev) => [
      ...prev,
      {
        name: "",
        quantity: 1,
        unit: "pcs",
        rayonId: rayons[0]?.id ?? "autre",
      },
    ]);
    setEditingIdx(newIdx);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const handleConfirm = async () => {
    const recipe: Recipe = {
      id: `recipe-${uuidv4()}`,
      name: name.trim() || "Recette sans nom",
      servings: Math.max(1, servings),
      ingredients,
      createdAt: new Date().toISOString(),
    };
    await onConfirm(recipe);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6">Recette détectée</Typography>
        <Button
          variant="text"
          size="small"
          onClick={onCancel}
          sx={{ color: "text.secondary" }}
        >
          Recommencer
        </Button>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          label="Nom de la recette"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Nombre de personnes"
          type="number"
          value={servings}
          onChange={(e) =>
            setServings(Math.max(1, parseInt(e.target.value) || 1))
          }
          size="small"
          sx={{ width: 200 }}
          slotProps={{ htmlInput: { min: 1, max: 100 } }}
        />
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        {ingredients.map((ing, idx) => (
          <Box key={idx}>
            <Box sx={{ px: 2, py: 1.5 }}>
              {editingIdx === idx ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <TextField
                    size="small"
                    label="Ingrédient"
                    value={ing.name}
                    onChange={(e) => updateField(idx, "name", e.target.value)}
                    fullWidth
                    autoFocus
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
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => setEditingIdx(null)}
                      variant="outlined"
                    >
                      OK
                    </Button>
                    <Button
                      size="small"
                      onClick={() => removeIngredient(idx)}
                      color="error"
                      variant="text"
                    >
                      Supprimer
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                      {ing.name || <em style={{ opacity: 0.5 }}>Sans nom</em>}
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
              )}
            </Box>
            {idx < ingredients.length - 1 && <Divider />}
          </Box>
        ))}
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={addIngredient}
            sx={{ color: "text.secondary" }}
          >
            Ajouter un ingrédient
          </Button>
        </Box>
      </Card>

      <Button
        variant="contained"
        size="large"
        onClick={handleConfirm}
        disabled={isSaving || ingredients.length === 0 || !name.trim()}
        fullWidth
      >
        {isSaving ? "Sauvegarde..." : "Sauvegarder la recette"}
      </Button>
    </Box>
  );
}
