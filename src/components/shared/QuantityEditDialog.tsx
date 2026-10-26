import Autocomplete from "@mui/material/Autocomplete";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { Rayon } from "../../types";

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
  initialPrice?: number;
  initialRayonId?: string;
  rayons?: Rayon[];
  initialName?: string;
  initialComment?: string;
  onConfirm: (
    quantity: number,
    unit: string,
    price: number | undefined,
    rayonId?: string,
    extras?: { name?: string; comment: string },
  ) => void;
  onCancel: () => void;
}

export function QuantityEditDialog({
  open,
  initialQuantity,
  initialUnit,
  initialPrice,
  initialRayonId,
  rayons,
  initialName,
  initialComment,
  onConfirm,
  onCancel,
}: QuantityEditDialogProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unit, setUnit] = useState(initialUnit);
  const [price, setPrice] = useState<string>(initialPrice?.toString() ?? "");
  const [rayonId, setRayonId] = useState<string>(initialRayonId ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [comment, setComment] = useState(initialComment ?? "");

  useEffect(() => {
    if (open) {
      setQuantity(initialQuantity);
      setUnit(initialUnit);
      setPrice(initialPrice?.toString() ?? "");
      setRayonId(initialRayonId ?? "");
      setName(initialName ?? "");
      setComment(initialComment ?? "");
    }
  }, [open, initialQuantity, initialUnit, initialPrice, initialRayonId, initialName, initialComment]);

  const unitOptions = [...new Set([...COMMON_UNITS, initialUnit])].filter(Boolean);

  const handleConfirm = () => {
    const p = parseFloat(price);
    onConfirm(Math.max(0.1, quantity), unit || "pcs", isNaN(p) ? undefined : p, rayonId || undefined, {
      name: initialName !== undefined ? name.trim() || initialName : undefined,
      comment: comment.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Modifier l'article</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, pt: "12px !important" }}
      >
        {initialName !== undefined && (
          <TextField
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
        )}
        <TextField
          label="Qté"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
          slotProps={{ htmlInput: { min: 0.1, step: 0.5 } }}
          sx={{ width: 90 }}
          autoFocus={initialName === undefined}
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
          sx={{ flex: 1, minWidth: 120 }}
          renderInput={(params) => <TextField {...params} label="Unité" />}
        />
        <TextField
          label="Prix unitaire (€)"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
        />
        <TextField
          label="Commentaire"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 120 } }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
        />
        {rayons && rayons.length > 0 && (
          <TextField
            select
            label="Rayon"
            value={rayonId}
            onChange={(e) => setRayonId(e.target.value)}
            fullWidth
          >
            {rayons.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.icon} {r.label}
              </MenuItem>
            ))}
          </TextField>
        )}
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
