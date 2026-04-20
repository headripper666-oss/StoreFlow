import DeleteIcon from "@mui/icons-material/Delete";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import Button from "@mui/material/Button";
import { useState } from "react";
import type { Recipe, RecipeCategory } from "../../types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../../utils/recipeUtils";

interface RecipeCardProps {
  recipe: Recipe;
  onUse: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onUpdateRecipe: (recipe: Recipe) => Promise<void>;
  disabled?: boolean;
  isSavingCategory?: boolean;
}

export function RecipeCard({
  recipe,
  onUse,
  onDelete,
  onUpdateRecipe,
  disabled = false,
  isSavingCategory = false,
}: RecipeCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const category = recipe.category ?? "autre";
  const { emoji, label } = CATEGORY_LABELS[category];

  const handleCategorySelect = async (cat: RecipeCategory) => {
    setMenuAnchor(null);
    if (cat !== category) {
      await onUpdateRecipe({ ...recipe, category: cat });
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, mb: 1.5 }}>
      <CardContent sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <RestaurantMenuIcon
            sx={{ mt: 0.25, color: "primary.main", flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
              {recipe.name}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.25 }}
            >
              {recipe.servings} personne{recipe.servings > 1 ? "s" : ""} ·{" "}
              {recipe.ingredients.length} ingrédient
              {recipe.ingredients.length > 1 ? "s" : ""}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={
                isSavingCategory ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CircularProgress size={12} />
                    {label}
                  </Box>
                ) : (
                  `${emoji} ${label}`
                )
              }
              onClick={(e) => {
                if (!disabled && !isSavingCategory)
                  setMenuAnchor(e.currentTarget);
              }}
              disabled={isSavingCategory}
              sx={{ mt: 0.75, cursor: "pointer" }}
            />
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              {CATEGORY_ORDER.map((cat) => (
                <MenuItem
                  key={cat}
                  selected={cat === category}
                  onClick={() => handleCategorySelect(cat)}
                >
                  {CATEGORY_LABELS[cat].emoji} {CATEGORY_LABELS[cat].label}
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Box>
      </CardContent>
      <CardActions
        sx={{ px: 2, pb: 1.5, pt: 0.5, justifyContent: "space-between" }}
      >
        <Button
          variant="contained"
          size="small"
          onClick={() => onUse(recipe)}
          disabled={disabled}
        >
          Utiliser
        </Button>
        <Tooltip title="Supprimer la recette">
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(recipe.id)}
            disabled={disabled}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
