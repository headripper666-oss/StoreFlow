import Autocomplete from "@mui/material/Autocomplete";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";

const COMMON_UNITS = [
  "pcs",
  "kg",
  "g",
  "L",
  "mL",
  "sachet",
  "boîte",
  "tranche",
  "paquet",
  "bouteille",
  "gousse",
  "œuf",
];

interface QuantityEditDialogProps {
  open: boolean;
  initialQuantity: number;
  initialUnit: string;
  onConfirm: (quantity: number, unit: string) => void;
  onCancel: () => void;
}

export function QuantityEditDialog({
  open,
  initialQuantity,
  initialUnit,
  onConfirm,
  onCancel,
}: QuantityEditDialogProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unit, setUnit] = useState(initialUnit);

  useEffect(() => {
    if (open) {
      setQuantity(initialQuantity);
      setUnit(initialUnit);
    }
  }, [open, initialQuantity, initialUnit]);

  const unitOptions = [...new Set([...COMMON_UNITS, initialUnit])].filter(Boolean);

  const handleConfirm = () => {
    onConfirm(Math.max(0.1, quantity), unit || "pcs");
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Modifier la quantité</DialogTitle>
      <DialogContent
        sx={{ display: "flex", gap: 1.5, pt: "12px !important" }}
      >
        <TextField
          label="Quantité"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
          slotProps={{ htmlInput: { min: 0.1, step: 0.5 } }}
          sx={{ width: 110 }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
        />
        <Autocomplete
          freeSolo
          options={unitOptions}
          value={unit}
          onChange={(_, val) => setUnit(val ?? "pcs")}
          onInputChange={(_, val) => setUnit(val)}
          sx={{ flex: 1 }}
          renderInput={(params) => <TextField {...params} label="Unité" />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} variant="outlined" color="inherit">
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={quantity <= 0}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
