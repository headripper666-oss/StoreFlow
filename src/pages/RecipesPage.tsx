import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { RecipeCard } from "../components/recipes/RecipeCard";
import { RecipeImportPreview } from "../components/recipes/RecipeImportPreview";
import { RecipeUsageDialog } from "../components/recipes/RecipeUsageDialog";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import { parseRecipeFromText } from "../services/mistral";
import type { ParsedRecipe, Rayon, Recipe, RecipeIngredient } from "../types";

interface RecipesPageProps {
  recipes: Recipe[];
  rayons: Rayon[];
  isSavingList: boolean;
  isSavingRecipes: boolean;
  onAddToList: (ingredients: RecipeIngredient[]) => Promise<void>;
  onSaveRecipe: (recipe: Recipe) => Promise<void>;
  onUpdateRecipe: (recipe: Recipe) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
}

const EMPTY_RECIPE: ParsedRecipe = {
  name: "",
  servings: 4,
  ingredients: [],
};

export function RecipesPage({
  recipes,
  rayons,
  isSavingList,
  isSavingRecipes,
  onAddToList,
  onSaveRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
}: RecipesPageProps) {
  const [tab, setTab] = useState(0);

  // Recipe list state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  // Import tab state
  const [importText, setImportText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null);

  const handleUseRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setUsageDialogOpen(true);
  };

  const handleDeleteRequest = (id: string) => {
    const recipe = recipes.find((r) => r.id === id) ?? null;
    setDeleteTarget(recipe);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await onDeleteRecipe(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleAnalyzeRecipe = async () => {
    if (!importText.trim()) return;
    setParseError(null);
    setIsParsing(true);
    try {
      const result = await parseRecipeFromText(importText.trim());
      setParsedRecipe(result);
      setImportText("");
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Erreur lors de l'analyse",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async (recipe: Recipe) => {
    await onSaveRecipe(recipe);
    setParsedRecipe(null);
    setTab(0);
  };

  const handleOpenManualCreate = () => {
    setParsedRecipe(EMPTY_RECIPE);
    setTab(1);
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
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => setTab(1)}
              >
                Importer avec l'IA
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenManualCreate}
              >
                Créer manuellement
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onUse={handleUseRecipe}
                onDelete={handleDeleteRequest}
                disabled={isSavingRecipes || isSavingList}
              />
            ))}
            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
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
          </Box>
        )}
      </Box>

      {/* Tab 1 — Importer */}
      <Box hidden={tab !== 1}>
        {parsedRecipe ? (
          <RecipeImportPreview
            parsed={parsedRecipe}
            rayons={rayons}
            isSaving={isSavingRecipes}
            onConfirm={handleConfirmImport}
            onCancel={() => setParsedRecipe(null)}
          />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Collez le texte d'une recette (depuis un blog, un livre, une
              application…). L'IA va en extraire les ingrédients et les
              quantités par personne.
            </Typography>
            <TextField
              multiline
              rows={10}
              fullWidth
              placeholder={
                "Exemples :\n• Bœuf bourguignon pour 6 personnes\n  - 1 kg de bœuf\n  - 3 carottes\n  - 1 bouteille de vin rouge\n  ...\n\nOu simplement coller une page de blog avec la recette."
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
              {isParsing ? "Analyse en cours..." : "Analyser avec l'IA"}
            </Button>
          </Box>
        )}
      </Box>

      {/* Usage dialog */}
      <RecipeUsageDialog
        open={usageDialogOpen}
        recipe={selectedRecipe}
        rayons={rayons}
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
