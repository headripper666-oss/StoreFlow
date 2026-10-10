import CasinoIcon from "@mui/icons-material/Casino";
import CloseIcon from "@mui/icons-material/Close";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Button from "@mui/material/Button";
import { useState, useMemo } from "react";
import type { Recipe } from "../../types";
import { computeRecipeCalories, tagDisplay } from "../../utils/recipeUtils";

interface RandomMealDialogProps {
  open: boolean;
  recipes: Recipe[];
  availableTags: string[];
  onClose: () => void;
  onUse: (recipe: Recipe) => void;
}

function unbiasedRandom(n: number): number {
  // Rejection sampling : élimine le biais modulo
  const limit = 2 ** 32 - (2 ** 32 % n);
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = unbiasedRandom(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function RandomMealDialog({
  open,
  recipes,
  availableTags,
  onClose,
  onUse,
}: RandomMealDialogProps) {
  const [count, setCount] = useState("5");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [maxKcal, setMaxKcal] = useState<string>("");
  const [result, setResult] = useState<Recipe[] | null>(null);

  const handleReplace = (id: string) => {
    setResult((prev) => {
      if (!prev) return prev;
      const currentIds = new Set(prev.map((r) => r.id));
      const bench = pool.filter((r) => !currentIds.has(r.id));
      if (bench.length === 0) return prev;
      const replacement = bench[unbiasedRandom(bench.length)];
      return prev.map((r) => (r.id === id ? replacement : r));
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const pool = useMemo(() => {
    const kcalLimit = parseFloat(maxKcal);
    return recipes
      .filter(
        (r) =>
          selectedTags.length === 0 ||
          (r.tags ?? []).some((t) => selectedTags.includes(t)),
      )
      .filter((r) => {
        if (!kcalLimit || isNaN(kcalLimit)) return true;
        const total = computeRecipeCalories(r.ingredients, r.servings, r.servings);
        if (total === null) return true;
        return Math.round(total / r.servings) <= kcalLimit;
      });
  }, [recipes, selectedTags, maxKcal]);

  const handleDraw = () => {
    const n = Math.max(1, parseInt(count) || 1);
    const shuffled = shuffleArray(pool);
    setResult(shuffled.slice(0, Math.min(n, shuffled.length)));
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const countNum = parseInt(count) || 1;
  const canDraw = pool.length > 0 && countNum >= 1;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 6 }}>
        <CasinoIcon color="primary" />
        Tirage aléatoire
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Nombre de repas */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <TextField
              label="Nombre de repas"
              type="number"
              size="small"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              sx={{ width: 160 }}
              slotProps={{ htmlInput: { min: 1, max: 50 } }}
            />
            <Typography variant="body2" color="text.secondary">
              {pool.length} recette{pool.length !== 1 ? "s" : ""} disponible{pool.length !== 1 ? "s" : ""}
            </Typography>
          </Box>

          {/* Filtre calories */}
          <Tooltip title="Les recettes sans données calories restent toujours incluses." placement="top">
            <TextField
              size="small"
              type="number"
              label="Max kcal/pers (optionnel)"
              value={maxKcal}
              onChange={(e) => setMaxKcal(e.target.value)}
              sx={{ width: 220 }}
              slotProps={{
                htmlInput: { min: 0, step: 50 },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption" color="text.secondary">kcal</Typography>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Tooltip>

          {/* Filtre tags */}
          {availableTags.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                Filtrer par catégorie (optionnel)
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                {availableTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tagDisplay(tag)}
                    size="small"
                    variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                    color={selectedTags.includes(tag) ? "primary" : "default"}
                    onClick={() => toggleTag(tag)}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Bouton tirage */}
          <Button
            variant="contained"
            startIcon={<CasinoIcon />}
            onClick={handleDraw}
            disabled={!canDraw}
            size="large"
          >
            {result ? "Relancer le tirage" : "Tirer au sort"}
          </Button>

          {pool.length === 0 && (
            <Typography variant="body2" color="text.secondary" align="center">
              Aucune recette ne correspond aux filtres sélectionnés.
            </Typography>
          )}

          {/* Résultat */}
          {result && (
            <>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {result.length} repas tirés au sort
                {countNum > pool.length && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (seulement {pool.length} disponibles)
                  </Typography>
                )}
              </Typography>
              {result.map((recipe) => {
                const kcal = computeRecipeCalories(recipe.ingredients, recipe.servings, recipe.servings);
                const tags = recipe.tags ?? [];
                return (
                  <Box
                    key={recipe.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <RestaurantMenuIcon sx={{ color: "primary.main", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {recipe.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {recipe.servings} pers.
                        {kcal !== null && ` · ~${Math.round(kcal / recipe.servings)} kcal/pers`}
                      </Typography>
                      {tags.length > 0 && (
                        <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                          {tags.map((tag) => (
                            <Chip
                              key={tag}
                              label={tagDisplay(tag)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.65rem" }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flexShrink: 0 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onUse(recipe)}
                      >
                        Utiliser
                      </Button>
                      <Tooltip title={pool.filter((r) => !result.map(x => x.id).includes(r.id)).length === 0 ? "Aucune autre recette disponible" : "Remplacer par un autre repas au hasard"}>
                        <span>
                          <Button
                            size="small"
                            variant="text"
                            color="secondary"
                            startIcon={<ShuffleIcon fontSize="small" />}
                            onClick={() => handleReplace(recipe.id)}
                            disabled={pool.filter((r) => !result.map(x => x.id).includes(r.id)).length === 0}
                            sx={{ fontSize: "0.7rem" }}
                          >
                            Changer
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
