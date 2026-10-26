import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RemoveIcon from "@mui/icons-material/Remove";
import { Box, Divider, IconButton, TextField } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { EssentialItem as EssentialItemType } from "../../types";
import { CheckButton } from "../list/CheckButton";

interface EssentialItemProps {
  item: EssentialItemType;
  onToggle: () => void;
  onDelete?: () => void;
  onUpdateQuantity?: (quantity: number, unit: string) => void;
  onChangeRayon?: () => void;
  onEditComment?: () => void;
  onActionsToggle?: (open: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function EssentialItem({
  item,
  onToggle,
  onDelete,
  onUpdateQuantity,
  onChangeRayon,
  onEditComment,
  onActionsToggle,
  disabled,
  isLast,
}: EssentialItemProps) {
  const [localQty, setLocalQty] = useState(item.quantity ?? 1);
  const [actionsOpen, setActionsOpen] = useState(false);
  const textFocusedRef = useRef(false);

  useEffect(() => {
    setLocalQty(item.quantity ?? 1);
  }, [item.quantity]);

  // Debounce save for +/− buttons only (skipped while text field is focused)
  useEffect(() => {
    if (!onUpdateQuantity || textFocusedRef.current) return;
    const stored = item.quantity ?? 1;
    if (localQty === stored) return;
    const timer = setTimeout(() => {
      onUpdateQuantity(localQty, item.unit ?? "pcs");
    }, 1500);
    return () => clearTimeout(timer);
  }, [localQty, onUpdateQuantity, item.quantity, item.unit]);

  const increment = () => setLocalQty((q) => q + 1);
  const decrement = () => setLocalQty((q) => Math.max(1, q - 1));

  const sublabel =
    item.unit && item.unit !== "pcs" ? `${localQty} ${item.unit}` : undefined;

  const totalPrice = item.pricePerUnit ? (item.pricePerUnit * localQty).toFixed(2) : null;

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
            strikeThrough={false}
            marquee
            badge={totalPrice ? `${totalPrice} €` : undefined}
          />
        </Box>

        {onUpdateQuantity && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <IconButton
              size="small"
              onClick={decrement}
              disabled={disabled || localQty <= 1}
              sx={{ color: "text.secondary", p: 0.5 }}
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
              sx={{ width: 40 }}
              slotProps={{
                htmlInput: {
                  min: 1,
                  style: { textAlign: "center", padding: "6px 2px" },
                  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
                    textFocusedRef.current = true;
                    e.target.select();
                  },
                  onBlur: () => {
                    textFocusedRef.current = false;
                    if (!onUpdateQuantity) return;
                    const stored = item.quantity ?? 1;
                    if (localQty !== stored) onUpdateQuantity(localQty, item.unit ?? "pcs");
                  },
                },
              }}
            />
            <IconButton
              size="small"
              onClick={increment}
              disabled={disabled}
              sx={{ color: "text.secondary", p: 0.5 }}
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {(onChangeRayon || onDelete || onEditComment) && (
          <>
            {actionsOpen && (
              <>
                {onEditComment && (
                  <IconButton
                    onClick={() => { onEditComment(); setActionsOpen(false); }}
                    disabled={disabled}
                    size="small"
                    sx={{ color: item.comment ? "primary.main" : "text.disabled", flexShrink: 0, p: 0.5 }}
                    aria-label={`Commentaire pour ${item.name}`}
                  >
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </IconButton>
                )}
                {onChangeRayon && (
                  <IconButton
                    onClick={() => { onChangeRayon(); setActionsOpen(false); }}
                    disabled={disabled}
                    size="small"
                    sx={{ color: "text.disabled", flexShrink: 0, p: 0.5 }}
                    aria-label={`Changer le rayon de ${item.name}`}
                  >
                    <DriveFileMoveOutlinedIcon fontSize="small" />
                  </IconButton>
                )}
                {onDelete && (
                  <IconButton
                    onClick={() => { onDelete(); setActionsOpen(false); }}
                    disabled={disabled}
                    size="small"
                    sx={{ color: "error.light", flexShrink: 0, p: 0.5 }}
                    aria-label={`Supprimer ${item.name}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </>
            )}
            <IconButton
              onClick={() => {
                const next = !actionsOpen;
                setActionsOpen(next);
                onActionsToggle?.(next);
              }}
              disabled={disabled}
              size="small"
              sx={{
                mr: 0.5,
                color: actionsOpen ? "primary.main" : "text.disabled",
                flexShrink: 0,
                p: 0.5,
              }}
              aria-label="Plus d'actions"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>
      {!isLast && <Divider sx={{ ml: 7 }} />}
    </>
  );
}
