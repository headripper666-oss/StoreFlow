import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  CatalogProduct,
  ParsedRecipe,
  Rayon,
  Recipe,
  RecipeIngredient,
} from "../../types";
import { detectTags, findInCatalog, normalize } from "../../utils/recipeUtils";
import { parseRecipeStepsFromImage } from "../../services/mistral";

type CatalogStatus =
  | { kind: "matched"; product: CatalogProduct }
  | { kind: "suggested"; product: CatalogProduct }
  | { kind: "unmatched" }
  | { kind: "ignored" };

type IngWithStatus = RecipeIngredient & { catalogStatus: CatalogStatus };

interface RecipeImportPreviewProps {
  parsed: ParsedRecipe;
  rayons: Rayon[];
  catalog: CatalogProduct[];
  isSaving: boolean;
  allTags: string[];
  initialTags?: string[];
  title?: string;
  confirmLabel?: string;
  showCatalogStatus?: boolean;
  onConfirm: (recipe: Recipe) => Promise<void>;
  onCancel: () => void;
  onTagsChange?: (tags: string[]) => void;
}

function resolveStatus(name: string, catalog: CatalogProduct[]): CatalogStatus {
  const normName = normalize(name);
  for (const p of catalog) {
    if (normalize(p.name) === normName) return { kind: "matched", product: p };
  }
  for (const p of catalog) {
    if ((p.aliases ?? []).some((a) => normalize(a) === normName)) {
      return { kind: "suggested", product: p };
    }
  }
  return { kind: "unmatched" };
}

export function RecipeImportPreview({
  parsed,
  rayons,
  catalog,
  isSaving,
  allTags,
  initialTags,
  title = "Recette détectée",
  confirmLabel = "Sauvegarder la recette",
  showCatalogStatus = true,
  onConfirm,
  onCancel,
  onTagsChange,
}: RecipeImportPreviewProps) {
  const [name, setName] = useState(parsed.name);
  const [servings, setServings] = useState(parsed.servings);
  const defaultRayonId = rayons[0]?.id ?? "autre";
  const [ingredients, setIngredients] = useState<IngWithStatus[]>(() =>
    parsed.ingredients.map((ing) => {
      if (!showCatalogStatus) {
        return { ...ing, rayonId: ing.rayonId ?? defaultRayonId, catalogStatus: { kind: "ignored" } as CatalogStatus };
      }
      const status = resolveStatus(ing.name, catalog);
      const resolved =
        status.kind === "matched"
          ? {
              unit: status.product.defaultUnit,
              pricePerUnit: status.product.pricePerUnit,
              rayonId: status.product.rayonId,
            }
          : {};
      return {
        ...ing,
        rayonId: ing.rayonId ?? defaultRayonId,
        ...resolved,
        catalogStatus: status,
      };
    }),
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [steps, setSteps] = useState<string[]>(parsed.steps ?? []);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  const [stepsImageOpen, setStepsImageOpen] = useState(false);
  const [stepsImageParsing, setStepsImageParsing] = useState(false);
  const [stepsImageError, setStepsImageError] = useState<string | null>(null);
  const [replaceStepsConfirmOpen, setReplaceStepsConfirmOpen] = useState(false);
  const [pendingSteps, setPendingSteps] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(() => {
    if (initialTags !== undefined) return initialTags;
    return detectTags(
      { name: parsed.name, ingredients: parsed.ingredients },
      allTags,
    );
  });

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
        catalogStatus: { kind: "ignored" },
      },
    ]);
    setEditingIdx(newIdx);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

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
      const { steps: newSteps } = await parseRecipeStepsFromImage(base64, file.type || "image/jpeg");
      if (steps.length > 0) {
        setPendingSteps(newSteps);
        setStepsImageOpen(false);
        setReplaceStepsConfirmOpen(true);
      } else {
        setSteps(newSteps);
        setStepsImageOpen(false);
      }
    } catch (err) {
      setStepsImageError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    } finally {
      setStepsImageParsing(false);
    }
  };

  const addStep = () => {
    setSteps((prev) => [...prev, ""]);
    setEditingStepIdx(steps.length);
  };
  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
    setEditingStepIdx(null);
  };
  const updateStep = (idx: number, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? value : s)));
  };

  const handleConfirm = async () => {
    const recipe: Recipe = {
      id: `recipe-${uuidv4()}`,
      name: name.trim() || "Recette sans nom",
      servings: Math.max(1, servings),
      ingredients: ingredients.map(({ catalogStatus: _cs, ...ing }) => ing),
      createdAt: new Date().toISOString(),
      tags,
      steps: steps.filter((s) => s.trim()),
    };
    await onConfirm(recipe);
  };

  const acceptSuggestion = (idx: number, product: CatalogProduct) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === idx
          ? {
              ...ing,
              name: product.name,
              unit: product.defaultUnit,
              pricePerUnit: product.pricePerUnit,
              rayonId: product.rayonId,
              catalogStatus: { kind: "matched", product },
            }
          : ing,
      ),
    );
  };

  const ignoreSuggestion = (idx: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === idx ? { ...ing, catalogStatus: { kind: "ignored" } } : ing,
      ),
    );
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
        <Typography variant="h6">{title}</Typography>
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
        <Autocomplete
          multiple
          freeSolo
          options={allTags}
          value={tags}
          onChange={(_, newValue) => {
            const newTags = newValue as string[];
            setTags(newTags);
            onTagsChange?.(newTags);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Tags"
              placeholder={tags.length === 0 ? "Ajouter un tag..." : ""}
            />
          )}
        />
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        {ingredients.map((ing, idx) => (
          <Box key={idx}>
            <Box sx={{ px: 2, py: 1.5 }}>
              {editingIdx === idx ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={catalog.map((c) => c.name)}
                    value={ing.name}
                    inputValue={ing.name}
                    onInputChange={(_, value) => updateField(idx, "name", value)}
                    onChange={(_, value) => {
                      if (typeof value === "string" && value) {
                        const match = findInCatalog(value, catalog);
                        setIngredients((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  name: value,
                                  unit: match ? match.defaultUnit : item.unit,
                                  pricePerUnit: match ? match.pricePerUnit : item.pricePerUnit,
                                  rayonId: match ? match.rayonId : item.rayonId,
                                  catalogStatus: match
                                    ? { kind: "matched", product: match }
                                    : { kind: "ignored" },
                                }
                              : item,
                          ),
                        );
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Ingrédient"
                        fullWidth
                        autoFocus
                      />
                    )}
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
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
                        {ing.catalogStatus.kind === "matched" && (
                          <Tooltip title="Reconnu dans le catalogue">
                            <CheckCircleIcon sx={{ fontSize: 14, color: "success.main", flexShrink: 0 }} />
                          </Tooltip>
                        )}
                        {ing.catalogStatus.kind === "unmatched" && (
                          <Tooltip title="Inconnu dans le catalogue">
                            <WarningAmberIcon sx={{ fontSize: 14, color: "warning.main", flexShrink: 0 }} />
                          </Tooltip>
                        )}
                      </Box>
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
                  {ing.catalogStatus.kind === "suggested" && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 1,
                        py: 0.5,
                        bgcolor: "warning.50",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "warning.200",
                      }}
                    >
                      <WarningAmberIcon sx={{ fontSize: 14, color: "warning.main", flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ flex: 1 }}>
                        Voulez-vous dire <strong>{ing.catalogStatus.product.name}</strong> ?
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        sx={{ py: 0, minWidth: 0, px: 1, fontSize: "0.7rem" }}
                        onClick={() => acceptSuggestion(idx, ing.catalogStatus.kind === "suggested" ? ing.catalogStatus.product : (ing.catalogStatus as { kind: "matched"; product: CatalogProduct }).product)}
                      >
                        Oui
                      </Button>
                      <Button
                        size="small"
                        sx={{ py: 0, minWidth: 0, px: 1, fontSize: "0.7rem", color: "text.secondary" }}
                        onClick={() => ignoreSuggestion(idx)}
                      >
                        Ignorer
                      </Button>
                    </Box>
                  )}
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

      {/* Steps */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
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

        {/* Mini-dialog upload image pour steps */}
        <Dialog open={stepsImageOpen} onClose={() => setStepsImageOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Analyser les étapes par image</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Photo d'un livre ou screenshot d'une recette — l'IA extrait les étapes.
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={stepsImageParsing ? <CircularProgress size={16} /> : <PhotoCameraIcon />}
              disabled={stepsImageParsing}
              fullWidth
            >
              {stepsImageParsing ? "Analyse en cours…" : "Choisir une image"}
              <input
                type="file"
                accept="image/*"
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

        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          {steps.map((step, idx) => (
            <Box key={idx}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 2, py: 1.5 }}>
                <Box
                  sx={{
                    width: 22, height: 22, borderRadius: "50%",
                    bgcolor: "primary.main", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, mt: 0.25,
                  }}
                >
                  {idx + 1}
                </Box>
                {editingStepIdx === idx ? (
                  <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField
                      multiline
                      minRows={2}
                      size="small"
                      value={step}
                      onChange={(e) => updateStep(idx, e.target.value)}
                      fullWidth
                      autoFocus
                      placeholder="Décrivez cette étape…"
                    />
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => setEditingStepIdx(null)}>
                        OK
                      </Button>
                      <Button size="small" color="error" variant="text" onClick={() => removeStep(idx)}>
                        Supprimer
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Typography
                      variant="body2"
                      sx={{ flex: 1, lineHeight: 1.6, cursor: "pointer", color: step ? "text.primary" : "text.disabled" }}
                      onClick={() => setEditingStepIdx(idx)}
                    >
                      {step || <em>Cliquer pour saisir l'étape…</em>}
                    </Typography>
                    <IconButton size="small" onClick={() => setEditingStepIdx(idx)} sx={{ color: "text.disabled", flexShrink: 0 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeStep(idx)} sx={{ color: "text.disabled", flexShrink: 0 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
              {idx < steps.length - 1 && <Divider />}
            </Box>
          ))}
          <Divider />
          <Box sx={{ p: 1 }}>
            <Button startIcon={<AddIcon />} size="small" onClick={addStep} sx={{ color: "text.secondary" }}>
              Ajouter une étape
            </Button>
          </Box>
        </Card>
      </Box>

      <Button
        variant="contained"
        size="large"
        onClick={handleConfirm}
        disabled={isSaving || ingredients.length === 0 || !name.trim()}
        fullWidth
      >
        {isSaving ? "Sauvegarde..." : confirmLabel}
      </Button>
    </Box>
  );
}
