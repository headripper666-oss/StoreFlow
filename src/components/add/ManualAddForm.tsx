import AddIcon from "@mui/icons-material/Add";
import {
  Autocomplete,
  Box,
  Button,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { CatalogProduct, ListItem, Rayon } from "../../types";

interface ManualAddFormProps {
  rayons: Rayon[];
  catalog?: CatalogProduct[];
  onAdd: (item: Omit<ListItem, "id" | "addedAt" | "checked">) => Promise<void>;
  isSaving: boolean;
}

const COMMON_UNITS = [
  "pcs",
  "kg",
  "g",
  "L",
  "mL",
  "sachet",
  "boîte",
  "bouteille",
  "paquet",
];

export function ManualAddForm({
  rayons,
  catalog = [],
  onAdd,
  isSaving,
}: ManualAddFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState("pcs");
  const [rayonId, setRayonId] = useState("autre");

  const handleAdd = async () => {
    if (!name.trim()) return;
    await onAdd({
      name: name.trim(),
      quantity,
      unit,
      rayonId,
    });
    setName("");
    setQuantity(1);
    setUnit("pcs");
    setRayonId("autre");
  };

  const handleSelectProduct = (productName: string | null) => {
    if (!productName) return;
    const product = catalog.find((p) => p.name === productName);
    if (product) {
      setRayonId(product.rayonId);
      if (product.defaultUnit) setUnit(product.defaultUnit);
    }
  };

  const catalogNames = catalog.map((p) => p.name);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Ajoutez un article manuellement.
      </Typography>

      <Autocomplete
        freeSolo
        options={catalogNames}
        value={name}
        onInputChange={(_, newValue) => setName(newValue)}
        onChange={(_, newValue) => {
          if (typeof newValue === "string") {
            setName(newValue);
            handleSelectProduct(newValue);
          }
        }}
        disabled={isSaving}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Nom de l'article"
            autoFocus
            placeholder="Ex : Yaourts, Poulet rôti..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
        )}
      />

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          label="Quantité"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
          sx={{ width: 100 }}
          disabled={isSaving}
          slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
        />
        <Select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          disabled={isSaving}
          sx={{ width: 130 }}
        >
          {COMMON_UNITS.map((u) => (
            <MenuItem key={u} value={u}>
              {u}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Select
        value={rayonId}
        onChange={(e) => setRayonId(e.target.value)}
        disabled={isSaving}
        fullWidth
        displayEmpty
      >
        {rayons.map((r) => (
          <MenuItem key={r.id} value={r.id}>
            {r.icon} {r.label}
          </MenuItem>
        ))}
      </Select>

      <Button
        variant="contained"
        size="large"
        onClick={handleAdd}
        disabled={!name.trim() || isSaving}
        startIcon={<AddIcon />}
        fullWidth
      >
        Ajouter
      </Button>
    </Box>
  );
}
