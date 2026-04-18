import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Divider, IconButton } from "@mui/material";
import type { DisplayItem } from "../../types";
import { CheckButton } from "./CheckButton";

interface ProductItemProps {
  item: DisplayItem;
  onToggle: () => void;
  onDelete: () => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function ProductItem({
  item,
  onToggle,
  onDelete,
  disabled,
  isLast,
}: ProductItemProps) {
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
    </>
  );
}
