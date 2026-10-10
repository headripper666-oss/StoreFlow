import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import Button from "@mui/material/Button";
import { useState } from "react";
import type { Recipe } from "../../types";
import { computeRecipeCalories, tagDisplay } from "../../utils/recipeUtils";

interface RecipeCardProps {
  recipe: Recipe;
  onUse: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function RecipeCard({
  recipe,
  onUse,
  onEdit,
  onDelete,
  disabled = false,
}: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tags = recipe.tags ?? [];
  const kcalPerPerson = computeRecipeCalories(recipe.ingredients, recipe.servings, recipe.servings);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, mb: 1.5 }}>
      <CardContent
        sx={{ pb: 0, cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
      >
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
              {recipe.ingredients.length} ingrédient{recipe.ingredients.length > 1 ? "s" : ""}
              {(recipe.steps ?? []).length > 0 && ` · ${recipe.steps!.length} étape${recipe.steps!.length > 1 ? "s" : ""}`}
              {kcalPerPerson !== null && ` · ~${kcalPerPerson} kcal/pers`}
            </Typography>
            {tags.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    size="small"
                    variant="outlined"
                    label={tagDisplay(tag)}
                    sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                ))}
              </Box>
            )}
          </Box>
          <IconButton
            size="small"
            sx={{
              flexShrink: 0,
              color: "text.secondary",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              mt: -0.5,
              mr: -0.5,
            }}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            aria-label={expanded ? "Réduire" : "Voir les ingrédients"}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Box>
      </CardContent>

      {/* Vue lecture — ingrédients + étapes */}
      <Collapse in={expanded} unmountOnExit>
        <Divider sx={{ mx: 2, mt: 1 }} />
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Ingrédients · {recipe.servings} pers.
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {recipe.ingredients.map((ing, i) => (
              <Typography component="li" variant="body2" key={i} sx={{ mb: 0.25 }}>
                {ing.quantity > 0 && `${ing.quantity} `}{ing.unit && `${ing.unit} `}{ing.name}
              </Typography>
            ))}
          </Box>
          {(recipe.steps ?? []).length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Étapes
              </Typography>
              <Box component="ol" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                {recipe.steps!.map((step, i) => (
                  <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>
                    {step}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>

      <CardActions sx={{ px: 2, pb: 1.5, pt: 0.5, justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => onUse(recipe)}
            disabled={disabled}
          >
            Utiliser
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onEdit(recipe)}
            disabled={disabled}
          >
            Modifier
          </Button>
        </Box>
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
