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
import type { CatalogProduct, DisplayItem, EssentialItem, ListItem, Rayon, Recipe } from "../types";
import { normalize } from "../utils/recipeUtils";

interface ListPageProps {
  items: ListItem[];
  essentials: EssentialItem[];
  rayons: Rayon[];
  catalog: CatalogProduct[];
  recipes: Recipe[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onClearChecked: () => Promise<void>;
  onToggleEssential: (id: string) => void;
  onUpdateQuantity: (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    rayonId?: string,
    extras?: { name?: string; comment: string },
  ) => Promise<void>;
  onUpdateEssentialQuantity: (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    extras?: { comment: string },
  ) => Promise<void>;
  onToggleAll: (checked: boolean) => Promise<void>;
  onReorderItem: (id: string, direction: -1 | 1) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

export function ListPage({
  items,
  essentials,
  rayons,
  catalog,
  recipes,
  onToggle,
  onDelete,
  onClearChecked,
  onToggleEssential,
  onUpdateQuantity,
  onUpdateEssentialQuantity,
  onToggleAll,
  onReorderItem,
  isLoading,
  isSaving,
}: ListPageProps) {
  const navigate = useNavigate();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const getPrice = (name: string, itemPrice?: number) => {
    if (itemPrice !== undefined) return itemPrice;
    const norm = normalize(name);
    const catalogPrice = catalog.find(p => normalize(p.name) === norm)?.pricePerUnit;
    if (catalogPrice !== undefined) return catalogPrice;
    for (const recipe of recipes) {
      const ing = recipe.ingredients.find(i => normalize(i.name) === norm);
      if (ing?.pricePerUnit !== undefined) return ing.pricePerUnit;
    }
    return undefined;
  };

  // Merge: checked essentials (= "à acheter") + personalList
  const essentialItems: DisplayItem[] = essentials
    .filter((e) => e.checked)
    .map((e) => ({
      id: e.id,
      name: e.name,
      quantity: e.quantity,
      unit: e.unit,
      rayonId: e.rayonId,
      checked: false,
      isEssential: true,
      comment: e.comment,
      pricePerUnit: getPrice(e.name, e.pricePerUnit),
    }));

  const listItems: DisplayItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    rayonId: i.rayonId,
    checked: i.checked,
    isEssential: false,
    order: i.order,
    comment: i.comment,
    pricePerUnit: getPrice(i.name, i.pricePerUnit),
  }));

  const allItems: DisplayItem[] = [...essentialItems, ...listItems];

  const grandTotal = allItems.reduce((sum, item) => {
    const qty = item.quantity ?? 1;
    if (item.pricePerUnit !== undefined && item.pricePerUnit !== null) {
      return sum + item.pricePerUnit * qty;
    }
    return sum;
  }, 0);

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
      items: normalizedItems
        .filter((i) => i.rayonId === rayon.id)
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)),
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

  const handleUpdateQuantity = async (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    rayonId?: string,
    extras?: { name?: string; comment: string },
  ) => {
    const isEssential = essentialItems.some((e) => e.id === id);
    if (isEssential) {
      await onUpdateEssentialQuantity(id, quantity, unit, price, extras);
    } else {
      await onUpdateQuantity(id, quantity, unit, price, rayonId, extras);
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
    <Container maxWidth="sm" sx={{ py: 2, pb: { xs: 10, lg: 10 } }}>
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

      {grandTotal > 0 && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(28, 61, 48, 0.2)",
            position: "sticky",
            top: 8,
            zIndex: 10,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Total estimé
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {grandTotal.toFixed(2)} €
          </Typography>
        </Box>
      )}

      {grouped.map(({ rayon, items: rayonItems }) => (
        <RayonSection
          key={rayon.id}
          rayon={rayon}
          items={rayonItems}
          allRayons={rayons}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onUpdateQuantity={handleUpdateQuantity}
          onReorder={onReorderItem}
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
        sx={{ position: "fixed", bottom: { xs: "calc(80px + var(--sab))", lg: 24 }, right: { xs: 20, lg: "max(20px, calc((100vw - 220px - 600px) / 2 + 20px))" } }}
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
