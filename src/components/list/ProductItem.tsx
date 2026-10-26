import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Divider, IconButton } from "@mui/material";
import { useState } from "react";
import type { DisplayItem, Rayon } from "../../types";
import { QuantityEditDialog } from "../shared/QuantityEditDialog";
import { CheckButton } from "./CheckButton";

interface ProductItemProps {
  item: DisplayItem;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateQuantity?: (
    quantity: number,
    unit: string,
    price: number | undefined,
    rayonId?: string,
    extras?: { name?: string; comment: string },
  ) => void;
  onReorder?: (direction: -1 | 1) => void;
  rayons?: Rayon[];
  isFirst?: boolean;
  isLastReorderable?: boolean;
  disabled?: boolean;
  isLast?: boolean;
}

export function ProductItem({
  item,
  onToggle,
  onDelete,
  onUpdateQuantity,
  onReorder,
  rayons,
  isFirst,
  isLastReorderable,
  disabled,
  isLast,
}: ProductItemProps) {
  const [editOpen, setEditOpen] = useState(false);

  const sublabel =
    item.quantity !== undefined &&
    item.unit !== undefined &&
    (item.quantity !== 1 || item.unit !== "pcs")
      ? `${item.quantity} ${item.unit}`
      : undefined;

  const totalPrice = item.pricePerUnit ? (item.pricePerUnit * (item.quantity ?? 1)).toFixed(2) : null;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CheckButton
            checked={item.checked}
            label={item.name}
            sublabel={sublabel}
            comment={item.comment}
            onToggle={onToggle}
            disabled={disabled}
            badge={totalPrice ? `${totalPrice} €` : undefined}
          />
        </Box>
        {onReorder && (
          <Box sx={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onReorder(-1); }}
              disabled={disabled || isFirst}
              sx={{ p: 0.25 }}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onReorder(1); }}
              disabled={disabled || isLastReorderable}
              sx={{ p: 0.25 }}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
        {onUpdateQuantity && (
          <IconButton
            onClick={() => setEditOpen(true)}
            disabled={disabled}
            size="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
            aria-label={`Modifier ${item.name}`}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton
          onClick={onDelete}
          disabled={disabled}
          size="small"
          sx={{ mr: 1, color: "text.disabled", flexShrink: 0 }}
          aria-label={item.isEssential ? `Décocher ${item.name}` : `Supprimer ${item.name}`}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      {!isLast && <Divider sx={{ ml: 7 }} />}

      {onUpdateQuantity && (
        <QuantityEditDialog
          open={editOpen}
          initialQuantity={item.quantity ?? 1}
          initialUnit={item.unit ?? "pcs"}
          initialPrice={item.pricePerUnit}
          initialRayonId={item.rayonId}
          rayons={item.isEssential ? undefined : rayons}
          initialName={item.isEssential ? undefined : item.name}
          initialComment={item.comment}
          onConfirm={(qty, unit, price, newRayonId, extras) => {
            setEditOpen(false);
            onUpdateQuantity(qty, unit, price, item.isEssential ? undefined : newRayonId, extras);
          }}
          onCancel={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
