import DeleteIcon from "@mui/icons-material/Delete";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import {
  Box,
  Card,
  CardActions,
  CardContent,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import Button from "@mui/material/Button";
import type { Recipe } from "../../types";

interface RecipeCardProps {
  recipe: Recipe;
  onUse: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function RecipeCard({
  recipe,
  onUse,
  onDelete,
  disabled = false,
}: RecipeCardProps) {
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
