import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { EssentialItem as EssentialItemComponent } from "../components/essentials/EssentialItem";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import type { EssentialItem, Rayon } from "../types";

interface EssentialsPageProps {
  essentials: EssentialItem[];
  rayons: Rayon[];
  onToggle: (id: string) => Promise<void>;
  onReset: () => Promise<void>;
  onAdd: (name: string, rayonId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

export function EssentialsPage({
  essentials,
  rayons,
  onToggle,
  onReset,
  onAdd,
  onDelete,
  isLoading,
  isSaving,
}: EssentialsPageProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRayonId, setNewRayonId] = useState("autre");

  const checkedCount = essentials.filter((e) => e.checked).length;
  const total = essentials.length;
  const progress = total > 0 ? (checkedCount / total) * 100 : 0;

  const handleOpenAdd = () => {
    setNewName("");
    setNewRayonId("autre");
    setAddDialogOpen(true);
  };

  const handleConfirmAdd = async () => {
    if (!newName.trim()) return;
    setAddDialogOpen(false);
    await onAdd(newName, newRayonId);
  };

  // Group essentials by rayon, sorted by rayon order
  const grouped = rayons
    .map((rayon) => ({
      rayon,
      items: essentials.filter((e) => e.rayonId === rayon.id),
    }))
    .filter((g) => g.items.length > 0);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Indispensables
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {checkedCount}/{total} cochés
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={() => setResetDialogOpen(true)}
          disabled={isSaving || checkedCount === 0}
        >
          Réinitialiser
        </Button>
      </Box>

      {/* Progress bar */}
      {total > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mb: 2, height: 6, borderRadius: 3 }}
        />
      )}

      {/* Grouped by rayon */}
      {grouped.map(({ rayon, items }) => {
        const uncheckedCount = items.filter((i) => !i.checked).length;
        const sorted = [
          ...items.filter((i) => !i.checked),
          ...items.filter((i) => i.checked),
        ];

        return (
          <Accordion
            key={rayon.id}
            defaultExpanded={uncheckedCount > 0}
            disableGutters
            sx={{
              mb: 0.5,
              borderRadius: "12px !important",
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "none",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 52, px: 2, "&.Mui-expanded": { minHeight: 52 } }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography sx={{ fontSize: "1.3rem", lineHeight: 1 }}>
                  {rayon.icon}
                </Typography>
                <Typography variant="subtitle1">{rayon.label}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {sorted.map((item, idx) => (
                <EssentialItemComponent
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item.id)}
                  onDelete={() => onDelete(item.id)}
                  disabled={isSaving}
                  isLast={idx === sorted.length - 1}
                />
              ))}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {essentials.length === 0 && !isLoading && (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <Typography sx={{ variant: "h2", mb: 1 }}>🛒</Typography>
          <Typography variant="body1">
            Aucun article indispensable configuré.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Appuyez sur + pour en ajouter.
          </Typography>
        </Box>
      )}

      {/* FAB add */}
      <Fab
        color="primary"
        aria-label="Ajouter un indispensable"
        onClick={handleOpenAdd}
        disabled={isSaving}
        sx={{ position: "fixed", bottom: 80, right: 20 }}
      >
        <AddIcon />
      </Fab>

      {/* Add dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nouvel indispensable</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "12px !important",
          }}
        >
          <TextField
            label="Nom de l'article"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) handleConfirmAdd();
            }}
            fullWidth
            autoFocus
            placeholder="Ex : Café, Shampoing..."
          />
          <Select
            value={newRayonId}
            onChange={(e) => setNewRayonId(e.target.value)}
            fullWidth
          >
            {rayons.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.icon} {r.label}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setAddDialogOpen(false)}
            variant="outlined"
            color="inherit"
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirmAdd}
            variant="contained"
            disabled={!newName.trim()}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={resetDialogOpen}
        title="Réinitialiser les indispensables ?"
        message="Tous les articles cochés seront décochés. Cette action ne peut pas être annulée."
        confirmLabel="Réinitialiser"
        onConfirm={async () => {
          setResetDialogOpen(false);
          await onReset();
        }}
        onCancel={() => setResetDialogOpen(false)}
      />
    </Container>
  );
}
