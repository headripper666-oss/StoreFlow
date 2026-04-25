import AddIcon from "@mui/icons-material/Add";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RemoveDoneIcon from "@mui/icons-material/RemoveDone";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Fab,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RayonSection } from "../components/list/RayonSection";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import type { DisplayItem, EssentialItem, ListItem, Rayon } from "../types";

interface ListPageProps {
  items: ListItem[];
  essentials: EssentialItem[];
  rayons: Rayon[];
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearChecked: () => Promise<void>;
  onToggleEssential: (id: string) => Promise<void>;
  onUpdateQuantity: (id: string, quantity: number, unit: string) => Promise<void>;
  onUpdateEssentialQuantity: (id: string, quantity: number, unit: string) => Promise<void>;
  onToggleAll: (checked: boolean) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

export function ListPage({
  items,
  essentials,
  rayons,
  onToggle,
  onDelete,
  onClearChecked,
  onToggleEssential,
  onUpdateQuantity,
  onUpdateEssentialQuantity,
  onToggleAll,
  isLoading,
  isSaving,
}: ListPageProps) {
  const navigate = useNavigate();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Merge: checked essentials (= "à acheter") + personalList
  const essentialItems: DisplayItem[] = essentials
    .filter((e) => e.checked)
    .map((e) => ({
      id: e.id,
      name: e.name,
      quantity: e.quantity,
      unit: e.unit,
      rayonId: e.rayonId,
      checked: false, // shown as "to buy" in the list
      isEssential: true,
    }));

  const listItems: DisplayItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    rayonId: i.rayonId,
    checked: i.checked,
    isEssential: false,
  }));

  const allItems: DisplayItem[] = [...essentialItems, ...listItems];

  const checkedCount = items.filter((i) => i.checked).length;
  const allPersonalChecked = items.length > 0 && items.every((i) => i.checked);
  const hasPersonalItems = items.length > 0;

  const knownRayonIds = new Set(rayons.map((r) => r.id));
  const fallbackRayon: Rayon = rayons.find((r) => r.id === "autre") ?? {
    id: "autre",
    label: "Autre",
    order: 999,
    icon: "📦",
  };
  const normalizedItems = allItems.map((i) =>
    knownRayonIds.has(i.rayonId) ? i : { ...i, rayonId: fallbackRayon.id },
  );

  const grouped = [...rayons, ...(knownRayonIds.has(fallbackRayon.id) ? [] : [fallbackRayon])]
    .map((rayon) => ({
      rayon,
      items: normalizedItems.filter((i) => i.rayonId === rayon.id),
    }))
    .filter((g) => g.items.length > 0);

  const handleToggle = async (id: string) => {
    const isEssential = essentialItems.some((e) => e.id === id);
    if (isEssential) {
      await onToggleEssential(id);
    } else {
      await onToggle(id);
    }
  };

  const handleDelete = async (id: string) => {
    const isEssential = essentialItems.some((e) => e.id === id);
    if (!isEssential) await onDelete(id);
  };

  const handleUpdateQuantity = async (id: string, quantity: number, unit: string) => {
    const isEssential = essentialItems.some((e) => e.id === id);
    if (isEssential) {
      await onUpdateEssentialQuantity(id, quantity, unit);
    } else {
      await onUpdateQuantity(id, quantity, unit);
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 2, pb: { xs: 10, lg: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          Liste de courses
          {allItems.length > 0 && (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              ({allItems.length} article{allItems.length > 1 ? "s" : ""})
            </Typography>
          )}
        </Typography>
        {hasPersonalItems && (
          <Tooltip title={allPersonalChecked ? "Tout décocher" : "Tout cocher"}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={allPersonalChecked ? <RemoveDoneIcon /> : <DoneAllIcon />}
                onClick={() => onToggleAll(!allPersonalChecked)}
                disabled={isSaving}
                color="inherit"
                sx={{ borderColor: "divider" }}
              >
                {allPersonalChecked ? "Décocher tout" : "Cocher tout"}
              </Button>
            </span>
          </Tooltip>
        )}
        {checkedCount > 0 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeleteSweepIcon />}
            onClick={() => setClearDialogOpen(true)}
            disabled={isSaving}
            color="inherit"
            sx={{ borderColor: "divider" }}
          >
            Vider ({checkedCount})
          </Button>
        )}
      </Box>

      {grouped.map(({ rayon, items: rayonItems }) => (
        <RayonSection
          key={rayon.id}
          rayon={rayon}
          items={rayonItems}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onUpdateQuantity={handleUpdateQuantity}
          disabled={isSaving}
        />
      ))}

      {allItems.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography sx={{ variant: "h2", mb: 2 }}>🛍️</Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
            Votre liste est vide
          </Typography>
          <Typography variant="body2">
            Cochez des indispensables ou appuyez sur + pour ajouter des articles
          </Typography>
        </Box>
      )}

      <Fab
        color="primary"
        aria-label="Ajouter des articles"
        onClick={() => navigate("/add")}
        sx={{ position: "fixed", bottom: { xs: 80, lg: 24 }, right: 20 }}
      >
        <AddIcon />
      </Fab>

      <ConfirmDialog
        open={clearDialogOpen}
        title="Vider les articles cochés ?"
        message={`${checkedCount} article${checkedCount > 1 ? "s" : ""} coché${checkedCount > 1 ? "s" : ""} sera${checkedCount > 1 ? "ont" : ""} supprimé${checkedCount > 1 ? "s" : ""} de la liste.`}
        confirmLabel="Vider"
        onConfirm={async () => {
          setClearDialogOpen(false);
          await onClearChecked();
        }}
        onCancel={() => setClearDialogOpen(false)}
      />
    </Container>
  );
}
