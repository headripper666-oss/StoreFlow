import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Divider, IconButton } from "@mui/material";
import { useState } from "react";
import type { DisplayItem } from "../../types";
import { QuantityEditDialog } from "../shared/QuantityEditDialog";
import { CheckButton } from "./CheckButton";

interface ProductItemProps {
  item: DisplayItem;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateQuantity?: (quantity: number, unit: string) => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function ProductItem({
  item,
  onToggle,
  onDelete,
  onUpdateQuantity,
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

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CheckButton
            checked={item.checked}
            label={item.name}
            sublabel={sublabel}
            onToggle={onToggle}
            disabled={disabled}
          />
        </Box>
        {!item.isEssential && onUpdateQuantity && (
          <IconButton
            onClick={() => setEditOpen(true)}
            disabled={disabled}
            size="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
            aria-label={`Modifier la quantité de ${item.name}`}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        {!item.isEssential && (
          <IconButton
            onClick={onDelete}
            disabled={disabled}
            size="small"
            sx={{ mr: 1, color: "text.disabled", flexShrink: 0 }}
            aria-label={`Supprimer ${item.name}`}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {!isLast && <Divider sx={{ ml: 7 }} />}

      {onUpdateQuantity && (
        <QuantityEditDialog
          open={editOpen}
          initialQuantity={item.quantity ?? 1}
          initialUnit={item.unit ?? "pcs"}
          onConfirm={(qty, unit) => {
            setEditOpen(false);
            onUpdateQuantity(qty, unit);
          }}
          onCancel={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
