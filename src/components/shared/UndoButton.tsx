import UndoIcon from "@mui/icons-material/Undo";
import { IconButton, Tooltip } from "@mui/material";

interface UndoButtonProps {
  count: number;
  onUndo: () => void;
  color?: string;
}

export function UndoButton({ count, onUndo, color }: UndoButtonProps) {
  return (
    <Tooltip title={count > 0 ? `Annuler la dernière action (${count})` : "Rien à annuler"}>
      <span>
        <IconButton
          onClick={onUndo}
          disabled={count === 0}
          size="small"
          sx={{ color, "&.Mui-disabled": { color, opacity: 0.3 } }}
          aria-label="Annuler la dernière action"
        >
          <UndoIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
