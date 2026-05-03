import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import SearchIcon from "@mui/icons-material/Search";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState, useMemo } from "react";
import { RecipeCard } from "../components/recipes/RecipeCard";
import { RecipeImportPreview } from "../components/recipes/RecipeImportPreview";
import { RecipeUsageDialog } from "../components/recipes/RecipeUsageDialog";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import { parseRecipeFromText, parseRecipeFromImage } from "../services/mistral";
import type {
  EssentialItem,
  ParsedRecipe,
  Rayon,
  Recipe,
  RecipeIngredient,
} from "../types";
import { DEFAULT_TAGS, tagDisplay } from "../utils/recipeUtils";

interface RecipesPageProps {
  recipes: Recipe[];
  rayons: Rayon[];
  essentials: EssentialItem[];
  catalog: import("../types").CatalogProduct[];
  isSavingList: boolean;
  isSavingRecipes: boolean;
  onAddToList: (ingredients: RecipeIngredient[]) => Promise<void>;
  onSaveRecipe: (recipe: Recipe) => Promise<void>;
  onUpdateRecipe: (recipe: Recipe) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
  onDesktopSelect?: (recipe: Recipe) => void;
  onDesktopEdit?: (recipe: Recipe) => void;
}

const EMPTY_RECIPE: ParsedRecipe = {
  name: "",
  servings: 4,
  ingredients: [],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function RecipesPage({
  recipes,
  rayons,
  essentials,
  catalog,
  isSavingList,
  isSavingRecipes,
  onAddToList,
  onSaveRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
  onDesktopSelect,
  onDesktopEdit,
}: RecipesPageProps) {
  const [tab, setTab] = useState(0);

  // Recipe list state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Import tab state
  const [importText, setImportText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const isUrl = /^https?:\/\//i.test(importText.trim());
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [importMode, setImportMode] = useState<"text" | "image">("text");
  const [imageError, setImageError] = useState<string | null>(null);

  const allTags = useMemo((): string[] => {
    const tags = new Set<string>(DEFAULT_TAGS);
    recipes.forEach((r) => (r.tags ?? []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [recipes]);

  const availableTags = useMemo((): string[] => {
    const used = new Set<string>();
    recipes.forEach((r) => (r.tags ?? []).forEach((t) => used.add(t)));
    return allTags.filter((t) => used.has(t));
  }, [recipes, allTags]);

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter(
        (r) =>
          activeTags.length === 0 ||
          (r.tags ?? []).some((t) => activeTags.includes(t)),
      )
      .filter((r) => {
        if (!searchQuery) return true;
        const q = normalize(searchQuery);
        return (
          normalize(r.name).includes(q) ||
          r.ingredients.some((i) => normalize(i.name).includes(q))
        );
      });
  }, [recipes, activeTags, searchQuery]);

  const hasActiveFilter = searchQuery !== "" || activeTags.length > 0;

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleUseRecipe = (recipe: Recipe) => {
    if (onDesktopSelect) {
      onDesktopSelect(recipe);
    } else {
      setSelectedRecipe(recipe);
      setUsageDialogOpen(true);
    }
  };

  const handleDeleteRequest = (id: string) => {
    const recipe = recipes.find((r) => r.id === id) ?? null;
    setDeleteTarget(recipe);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteRecipe(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error handled by hook
    }
  };

  const resolveRayonId = (name: string, aiRayonId: string): string => {
    const n = normalize(name);
    const essential = essentials.find((e) => normalize(e.name) === n);
    if (essential) return essential.rayonId;
    const product = catalog.find(
      (p) => normalize(p.name) === n || (p.aliases ?? []).some((a) => normalize(a) === n),
    );
    if (product) return product.rayonId;
    return aiRayonId;
  };

  const handleAnalyzeRecipe = async () => {
    if (!importText.trim()) return;
    setParseError(null);
    setIsParsing(true);
    try {
      const result = await parseRecipeFromText(importText.trim());
      const resolved: ParsedRecipe = {
        ...result,
        ingredients: result.ingredients.map((ing) => ({
          ...ing,
          rayonId: resolveRayonId(ing.name, ing.rayonId),
        })),
      };
      setParsedRecipe(resolved);
      setImportText("");
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Erreur lors de l'analyse",
      );
    } finally {
      setIsParsing(false);
    }
  };

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

  const handleConfirmImport = async (recipe: Recipe) => {
    try {
      await onSaveRecipe(recipe);
      setParsedRecipe(null);
      setTab(0);
    } catch {
      // Error is handled by hook and shown in AppShell
    }
  };

  const handleEditRecipe = (recipe: Recipe) => {
    if (onDesktopEdit) {
      onDesktopEdit(recipe);
      return;
    }
    setEditingRecipe(recipe);
    setParsedRecipe({
      name: recipe.name,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    });
    setTab(1);
  };

  const handleConfirmEdit = async (recipe: Recipe) => {
    if (!editingRecipe) return;
    try {
      await onUpdateRecipe({
        ...recipe,
        id: editingRecipe.id,
        createdAt: editingRecipe.createdAt,
      });
      setEditingRecipe(null);
      setParsedRecipe(null);
      setTab(0);
    } catch {
      // Error is handled by hook
    }
  };

  const handleOpenManualCreate = () => {
    setEditingRecipe(null);
    setParsedRecipe(EMPTY_RECIPE);
    setTab(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setActiveTags([]);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Recettes
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          setParsedRecipe(null);
          setParseError(null);
          setEditingRecipe(null);
          setImportMode("text");
        }}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Mes recettes"
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        <Tab label="Importer" sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>

      {/* Tab 0 — Mes recettes */}
      <Box hidden={tab !== 0}>
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setTab(1)}
            size="small"
          >
            Importer avec l'IA
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenManualCreate}
            size="small"
          >
            Créer manuellement
          </Button>
        </Box>
        {recipes.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 6,
              color: "text.secondary",
            }}
          >
            <RestaurantMenuIcon sx={{ fontSize: 56, opacity: 0.3 }} />
            <Typography variant="body1" align="center">
              Aucune recette pour l'instant.
            </Typography>
            <Typography variant="body2" align="center" sx={{ opacity: 0.7 }}>
              Importez une recette avec l'IA ou créez-en une manuellement.
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Search bar */}
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher une recette…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 1.5 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <ClearIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: "pointer" }}
                        onClick={() => setSearchQuery("")}
                      />
                    </InputAdornment>
                  ) : null,
                },
              }}
            />

            {/* Tag filter chips */}
            {availableTags.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  overflowX: "auto",
                  pb: 1,
                  mb: 1.5,
                }}
              >
                <Chip
                  label="Toutes"
                  size="small"
                  variant={activeTags.length === 0 ? "filled" : "outlined"}
                  color={activeTags.length === 0 ? "primary" : "default"}
                  onClick={() => setActiveTags([])}
                  sx={{ flexShrink: 0 }}
                />
                {availableTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tagDisplay(tag)}
                    size="small"
                    variant={activeTags.includes(tag) ? "filled" : "outlined"}
                    color={activeTags.includes(tag) ? "primary" : "default"}
                    onClick={() => toggleTag(tag)}
                    sx={{ flexShrink: 0 }}
                  />
                ))}
              </Box>
            )}

            {/* Recipe list or empty state */}
            {filteredRecipes.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  color: "text.secondary",
                }}
              >
                <Typography variant="body1">Aucune recette trouvée.</Typography>
                {hasActiveFilter && (
                  <Button size="small" onClick={handleClearFilters}>
                    Effacer les filtres
                  </Button>
                )}
              </Box>
            ) : (
              filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onUse={handleUseRecipe}
                  onEdit={handleEditRecipe}
                  onDelete={handleDeleteRequest}
                  disabled={isSavingRecipes || isSavingList}
                />
              ))
            )}
          </Box>
        )}
      </Box>

      {/* Tab 1 — Importer */}
      <Box hidden={tab !== 1}>
        {parsedRecipe ? (
          <RecipeImportPreview
            parsed={parsedRecipe}
            rayons={rayons}
            catalog={catalog}
            isSaving={isSavingRecipes}
            allTags={allTags}
            initialTags={editingRecipe?.tags}
            title={editingRecipe ? "Modifier la recette" : undefined}
            confirmLabel={
              editingRecipe ? "Enregistrer les modifications" : undefined
            }
            showCatalogStatus={!editingRecipe}
            onConfirm={editingRecipe ? handleConfirmEdit : handleConfirmImport}
            onCancel={() => {
              setParsedRecipe(null);
              setEditingRecipe(null);
            }}
          />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ToggleButtonGroup
              value={importMode}
              exclusive
              onChange={(_, v) => {
                if (v) {
                  setImportMode(v);
                  setParseError(null);
                  setImageError(null);
                }
              }}
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
                  size="large"
                  onClick={handleAnalyzeRecipe}
                  disabled={!importText.trim() || isParsing}
                  startIcon={
                    isParsing ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <AutoAwesomeIcon />
                    )
                  }
                  fullWidth
                >
                  {isParsing
                    ? isUrl ? "Téléchargement en cours..." : "Analyse en cours..."
                    : isUrl ? "Analyser l'URL" : "Analyser avec l'IA"}
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
        )}
      </Box>

      {/* Usage dialog */}
      <RecipeUsageDialog
        open={usageDialogOpen}
        recipe={selectedRecipe}
        rayons={rayons}
        catalog={catalog}
        isSaving={isSavingList || isSavingRecipes}
        onAddToList={onAddToList}
        onUpdateRecipe={onUpdateRecipe}
        onClose={() => {
          setUsageDialogOpen(false);
          setSelectedRecipe(null);
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer la recette ?"
        message={`La recette "${deleteTarget?.name ?? ""}" sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Container>
  );
}
