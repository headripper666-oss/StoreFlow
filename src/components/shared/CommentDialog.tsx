import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { useEffect, useState } from "react";

interface CommentDialogProps {
  open: boolean;
  title: string;
  initialComment?: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}

export function CommentDialog({ open, title, initialComment, onConfirm, onCancel }: CommentDialogProps) {
  const [comment, setComment] = useState(initialComment ?? "");

  useEffect(() => {
    if (open) setComment(initialComment ?? "");
  }, [open, initialComment]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: "12px !important" }}>
        <TextField
          label="Commentaire"
          helperText="Affiché dans la liste de courses, effacé quand l'article est décoché."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { maxLength: 120 } }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") onConfirm(comment);
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} variant="outlined" color="inherit">
          Annuler
        </Button>
        <Button onClick={() => onConfirm(comment)} variant="contained">
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
