import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthConfig, Rayon, RecipeHistoryEntry, RecipeIngredient } from "../types";
import { roundQuantity } from "../utils/recipeUtils";
import { useRecipeHistory } from "../hooks/useRecipeHistory";

interface HistoryPageProps {
  config: AuthConfig | null;
  rayons: Rayon[];
  onAddToList: (ingredients: RecipeIngredient[]) => Promise<void>;
}

export function HistoryPage({ config, rayons, onAddToList }: HistoryPageProps) {
  const navigate = useNavigate();
  const { history, isLoading, removeEntry } = useRecipeHistory(config);
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState<string | null>(null);

  const sorted = [...history].sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
  );

  const getGuests = (entry: RecipeHistoryEntry) =>
    guestCounts[entry.recipeId] ?? entry.lastGuests;

  const scaledIngredients = (entry: RecipeHistoryEntry) => {
    const guests = getGuests(entry);
    const scale = guests / entry.lastGuests;
    return entry.ingredients.map((ing) => ({
      ...ing,
      quantity: scale === 1 ? ing.quantity : roundQuantity(ing.quantity * scale, ing.unit),
    }));
  };

  const handleGuestChange = (recipeId: string, delta: number, entry: RecipeHistoryEntry) => {
    const current = getGuests(entry);
    setGuestCounts((prev) => ({
      ...prev,
      [recipeId]: Math.max(1, Math.min(50, current + delta)),
    }));
  };

  const handleAddToList = async (entry: RecipeHistoryEntry) => {
    setAdding(entry.recipeId);
    try {
      await onAddToList(scaledIngredients(entry));
    } finally {
      setAdding(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ pb: 10 }}>
      <Box sx={{ pt: 2, pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Historique des recettes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {history.length === 0
            ? "Aucune recette utilisée pour l'instant."
            : `${history.length} recette${history.length > 1 ? "s" : ""} utilisée${history.length > 1 ? "s" : ""}`}
        </Typography>
      </Box>

      {sorted.length === 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pt: 8,
            gap: 2,
            color: "text.secondary",
          }}
        >
          <HistoryIcon sx={{ fontSize: 56, opacity: 0.2 }} />
          <Typography variant="body1" align="center">
            Les recettes ajoutées à la liste apparaîtront ici
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/recipes")}
            sx={{ mt: 1, borderRadius: 3, textTransform: "none" }}
          >
            Voir mes recettes
          </Button>
        </Box>
      )}

      {sorted.map((entry) => {
        const guests = getGuests(entry);
        const ingredients = scaledIngredients(entry);

        return (
          <Accordion
            key={entry.recipeId}
            disableGutters
            elevation={0}
            sx={{
              mb: 1.5,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "12px !important",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ px: 2, minHeight: 56, "&.Mui-expanded": { minHeight: 56 } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
                  {entry.recipeName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dernière utilisation · {formatDate(entry.lastUsedAt)} · {entry.lastGuests} pers.
                </Typography>
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
              {/* Guest counter */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  px: 2,
                  py: 1.25,
                  mb: 1.5,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Personnes
                  </Typography>
                  {guests !== entry.lastGuests && (
                    <Typography variant="caption" color="text.secondary">
                      Base : {entry.lastGuests} pers.
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleGuestChange(entry.recipeId, -1, entry)}
                    disabled={guests <= 1}
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
                    {guests}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleGuestChange(entry.recipeId, +1, entry)}
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

              {/* Ingredients */}
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  mb: 1.5,
                }}
              >
                {ingredients.map((ing, idx) => (
                  <Box key={idx}>
                    <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 1, gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {ing.name}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mt: 0.25 }}>
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
                    </Box>
                    {idx < ingredients.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>

              {/* Steps */}
              {(entry.steps ?? []).length > 0 && (
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{
                    mb: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "8px !important",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ minHeight: 40, px: 2, "&.Mui-expanded": { minHeight: 40 } }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Préparation · {entry.steps!.length} étape{entry.steps!.length > 1 ? "s" : ""}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
                    {entry.steps!.map((step, idx) => (
                      <Box key={idx} sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                        <Box
                          sx={{
                            width: 20, height: 20, borderRadius: "50%",
                            bgcolor: "primary.main", color: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.65rem", fontWeight: 700, flexShrink: 0, mt: 0.2,
                          }}
                        >
                          {idx + 1}
                        </Box>
                        <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.6 }}>
                          {step}
                        </Typography>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Actions */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box
                  component="button"
                  onClick={() => handleAddToList(entry)}
                  disabled={adding === entry.recipeId}
                  sx={{
                    flex: 1,
                    py: 1,
                    px: 2,
                    border: "none",
                    borderRadius: 2,
                    bgcolor: "primary.main",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: adding === entry.recipeId ? "wait" : "pointer",
                    opacity: adding === entry.recipeId ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  <span>Ajouter à la liste</span>
                  <span style={{ opacity: 0.8, fontSize: "0.75rem", fontWeight: 400 }}>
                    {ingredients.length} ingrédient{ingredients.length > 1 ? "s" : ""}
                  </span>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => removeEntry(entry.recipeId)}
                  sx={{ color: "text.disabled", border: "1px solid", borderColor: "divider" }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Container>
  );
}
