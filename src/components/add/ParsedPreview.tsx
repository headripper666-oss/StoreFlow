import EditIcon from "@mui/icons-material/Edit";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { ParsedProduct, Rayon } from "../../types";

interface ParsedPreviewProps {
  products: ParsedProduct[];
  rayons: Rayon[];
  onConfirm: (products: ParsedProduct[]) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function ParsedPreview({
  products,
  rayons,
  onConfirm,
  onCancel,
  isSaving,
}: ParsedPreviewProps) {
  const [edited, setEdited] = useState<ParsedProduct[]>(products);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const updateField = (
    idx: number,
    field: keyof ParsedProduct,
    value: string | number,
  ) => {
    setEdited((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );
  };

  const handleConfirm = async () => {
    await onConfirm(edited);
  };

  const lowConfidenceCount = edited.filter(
    (p) => p.confidence === "low",
  ).length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6">
          {edited.length} article{edited.length > 1 ? "s" : ""} détecté
          {edited.length > 1 ? "s" : ""}
        </Typography>
        <Button
          variant="text"
          size="small"
          onClick={onCancel}
          sx={{ color: "text.secondary" }}
        >
          Recommencer
        </Button>
      </Box>

      {lowConfidenceCount > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          {lowConfidenceCount} article{lowConfidenceCount > 1 ? "s" : ""} à
          vérifier (surligné{lowConfidenceCount > 1 ? "s" : ""} en orange)
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        {edited.map((product, idx) => (
          <Box key={idx}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                backgroundColor:
                  product.confidence === "low"
                    ? "rgba(255, 143, 0, 0.06)"
                    : "transparent",
              }}
            >
              {editingIdx === idx ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <TextField
                    size="small"
                    label="Nom"
                    value={product.name}
                    onChange={(e) => updateField(idx, "name", e.target.value)}
                    fullWidth
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      size="small"
                      label="Qté"
                      type="number"
                      value={product.quantity}
                      onChange={(e) =>
                        updateField(
                          idx,
                          "quantity",
                          parseFloat(e.target.value) || 1,
                        )
                      }
                      sx={{ width: 80 }}
                      slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
                    />
                    <TextField
                      size="small"
                      label="Unité"
                      value={product.unit}
                      onChange={(e) => updateField(idx, "unit", e.target.value)}
                      sx={{ width: 90 }}
                    />
                    <Select
                      size="small"
                      value={product.rayonId}
                      onChange={(e) =>
                        updateField(idx, "rayonId", e.target.value)
                      }
                      sx={{ flex: 1 }}
                    >
                      {rayons.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.icon} {r.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => setEditingIdx(null)}
                    variant="outlined"
                  >
                    OK
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.name}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.75,
                        mt: 0.25,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {product.quantity} {product.unit}
                      </Typography>
                      <Chip
                        label={`${rayons.find((r) => r.id === product.rayonId)?.icon ?? ""} ${rayons.find((r) => r.id === product.rayonId)?.label ?? product.rayonId}`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.68rem" }}
                        color={
                          product.confidence === "low" ? "warning" : "default"
                        }
                      />
                      {product.confidence === "low" && (
                        <Tooltip title="À vérifier">
                          <WarningAmberIcon
                            sx={{
                              fontSize: 16,
                              color: "warning.main",
                              alignSelf: "center",
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => setEditingIdx(idx)}
                    sx={{ flexShrink: 0 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
            {idx < edited.length - 1 && <Divider />}
          </Box>
        ))}
      </Card>

      <Button
        variant="contained"
        size="large"
        onClick={handleConfirm}
        disabled={isSaving || edited.length === 0}
        fullWidth
      >
        {isSaving
          ? "Ajout en cours..."
          : `Ajouter ${edited.length} article${edited.length > 1 ? "s" : ""}`}
      </Button>
    </Box>
  );
}
