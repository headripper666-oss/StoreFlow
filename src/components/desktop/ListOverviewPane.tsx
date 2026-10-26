import { Box, Typography } from "@mui/material";
import { RayonSection } from "../list/RayonSection";
import type { CatalogProduct, DisplayItem, EssentialItem, ListItem, Rayon } from "../../types";
import { normalize } from "../../utils/recipeUtils";

interface ListOverviewPaneProps {
  items: ListItem[];
  essentials: EssentialItem[];
  catalog: CatalogProduct[];
  rayons: Rayon[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleEssential: (id: string) => void;
  isSaving: boolean;
}

export function ListOverviewPane({
  items,
  essentials,
  catalog,
  rayons,
  onToggle,
  onDelete,
  onToggleEssential,
  isSaving,
}: ListOverviewPaneProps) {
  const getPrice = (name: string, itemPrice?: number) => {
    if (itemPrice !== undefined) return itemPrice;
    const norm = normalize(name);
    return catalog.find((p) => normalize(p.name) === norm)?.pricePerUnit;
  };

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

  const allItems = [...essentialItems, ...listItems];

  const grouped = rayons
    .map((rayon) => ({
      rayon,
      items: allItems.filter((i) => i.rayonId === rayon.id),
    }))
    .filter((g) => g.items.length > 0);

  const handleToggle = async (id: string) => {
    if (essentialItems.some((e) => e.id === id)) {
      await onToggleEssential(id);
    } else {
      await onToggle(id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!essentialItems.some((e) => e.id === id)) {
      await onDelete(id);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        🛍 Ma Liste
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

      {grouped.map(({ rayon, items: rayonItems }) => (
        <RayonSection
          key={rayon.id}
          rayon={rayon}
          items={rayonItems}
          onToggle={handleToggle}
          onDelete={handleDelete}
          disabled={isSaving}
        />
      ))}

      {allItems.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography sx={{ fontSize: "2.5rem", mb: 1 }}>🛍️</Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            Liste vide
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.7 }}>
            Cochez des indispensables ou ajoutez des articles
          </Typography>
        </Box>
      )}
    </Box>
  );
}
