import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Divider, IconButton } from "@mui/material";
import type { EssentialItem as EssentialItemType } from "../../types";
import { CheckButton } from "../list/CheckButton";

interface EssentialItemProps {
  item: EssentialItemType;
  onToggle: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function EssentialItem({
  item,
  onToggle,
  onDelete,
  disabled,
  isLast,
}: EssentialItemProps) {
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CheckButton
            checked={item.checked}
            label={item.name}
            onToggle={onToggle}
            disabled={disabled}
          />
        </Box>
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
