import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Typography,
} from "@mui/material";
import type { DisplayItem, Rayon } from "../../types";
import { ProductItem } from "./ProductItem";

interface RayonSectionProps {
  rayon: Rayon;
  items: DisplayItem[];
  allRayons?: Rayon[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateQuantity?: (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    rayonId?: string,
    extras?: { name?: string; comment: string },
  ) => void;
  onReorder?: (id: string, direction: -1 | 1) => void;
  disabled?: boolean;
}

export function RayonSection({
  rayon,
  items,
  allRayons,
  onToggle,
  onDelete,
  onUpdateQuantity,
  onReorder,
  disabled,
}: RayonSectionProps) {
  const uncheckedCount = items.filter((i) => !i.checked).length;
  const hasUnchecked = uncheckedCount > 0;

  const sorted = [
    ...items.filter((i) => !i.checked),
    ...items.filter((i) => i.checked),
  ];

  // Reorderable = unchecked personal items (not essentials)
  const reorderableItems = onReorder
    ? sorted.filter((i) => !i.checked && !i.isEssential)
    : [];

  return (
    <Accordion
      defaultExpanded={hasUnchecked}
      disableGutters
      sx={{
        mb: 0.5,
        borderRadius: "12px !important",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: 56,
          px: 2,
          backgroundColor: "background.paper",
          "&.Mui-expanded": { minHeight: 56 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
          <Typography
            sx={{ fontSize: "1.4rem", lineHeight: 1 }}
            role="img"
            aria-hidden
          >
            {rayon.icon}
          </Typography>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {rayon.label}
          </Typography>
          {uncheckedCount > 0 && (
            <Chip
              label={uncheckedCount}
              size="small"
              color="primary"
              sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, backgroundColor: "background.paper" }}>
        {sorted.map((item, idx) => {
          const reorderIdx = reorderableItems.indexOf(item);
          return (
            <ProductItem
              key={item.id}
              item={item}
              onToggle={() => onToggle(item.id)}
              onDelete={() => onDelete(item.id)}
              onUpdateQuantity={
                onUpdateQuantity
                  ? (qty, unit, price, newRayonId, extras) =>
                      onUpdateQuantity(item.id, qty, unit, price, newRayonId, extras)
                  : undefined
              }
              rayons={allRayons}
              onReorder={
                reorderIdx >= 0
                  ? (dir) => onReorder!(item.id, dir)
                  : undefined
              }
              isFirst={reorderIdx === 0}
              isLastReorderable={reorderIdx === reorderableItems.length - 1}
              disabled={disabled}
              isLast={idx === sorted.length - 1}
            />
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
}
