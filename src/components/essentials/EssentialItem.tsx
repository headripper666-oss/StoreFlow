import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import { Box, Divider, IconButton, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import type { EssentialItem as EssentialItemType } from "../../types";
import { CheckButton } from "../list/CheckButton";

interface EssentialItemProps {
  item: EssentialItemType;
  onToggle: () => void;
  onDelete?: () => void;
  onUpdateQuantity?: (quantity: number, unit: string) => void;
  onChangeRayon?: () => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function EssentialItem({
  item,
  onToggle,
  onDelete,
  onUpdateQuantity,
  onChangeRayon,
  disabled,
  isLast,
}: EssentialItemProps) {
  const [localQty, setLocalQty] = useState(item.quantity ?? 1);

  useEffect(() => {
    setLocalQty(item.quantity ?? 1);
  }, [item.quantity]);

  // Sauvegarde différée 600ms après le dernier changement
  useEffect(() => {
    if (!onUpdateQuantity) return;
    const stored = item.quantity ?? 1;
    if (localQty === stored) return;
    const timer = setTimeout(() => {
      onUpdateQuantity(localQty, item.unit ?? "pcs");
    }, 600);
    return () => clearTimeout(timer);
  }, [localQty, onUpdateQuantity, item.quantity, item.unit]);

  const increment = () => setLocalQty((q) => q + 1);
  const decrement = () => setLocalQty((q) => Math.max(1, q - 1));

  const sublabel =
    item.unit && item.unit !== "pcs" ? `${localQty} ${item.unit}` : undefined;

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

        {onUpdateQuantity && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              mr: onDelete ? 0 : 1,
            }}
          >
            <IconButton
              size="small"
              onClick={decrement}
              disabled={disabled || localQty <= 1}
              sx={{ color: "text.secondary" }}
            >
              <RemoveIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <TextField
              type="number"
              value={localQty}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) setLocalQty(v);
              }}
              disabled={disabled}
              sx={{ width: 46 }}
              slotProps={{
                htmlInput: {
                  min: 1,
                  style: { textAlign: "center", padding: "6px 4px" },
                },
              }}
            />
            <IconButton
              size="small"
              onClick={increment}
              disabled={disabled}
              sx={{ color: "text.secondary" }}
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {onChangeRayon && (
          <IconButton
            onClick={onChangeRayon}
            disabled={disabled}
            size="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
            aria-label={`Changer le rayon de ${item.name}`}
          >
            <DriveFileMoveOutlinedIcon fontSize="small" />
          </IconButton>
        )}

        {onDelete && (
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
