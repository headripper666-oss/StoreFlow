import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import type { EssentialItem, ListItem as ListItemType, Rayon } from "../types";

const EMOJI_SUGGESTIONS = [
  "🥖",
  "🥩",
  "🧴",
  "🧹",
  "🥫",
  "🥤",
  "🥛",
  "🧊",
  "🥦",
  "❄️",
  "🍳",
  "🧀",
  "🐟",
  "🥚",
  "🍷",
  "🧽",
  "🐱",
  "🌿",
  "🍎",
  "🛒",
];

interface RayonSettingsPageProps {
  rayons: Rayon[];
  essentials: EssentialItem[];
  listItems: ListItemType[];
  onSave: (rayons: Rayon[]) => Promise<void>;
  isSaving: boolean;
}

export function RayonSettingsPage({
  rayons,
  essentials,
  listItems,
  onSave,
  isSaving,
}: RayonSettingsPageProps) {
  const [localRayons, setLocalRayons] = useState<Rayon[]>(() =>
    [...rayons].sort((a, b) => a.order - b.order),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [deleteTarget, setDeleteTarget] = useState<Rayon | null>(null);

  const assignedIds = new Set([
    ...essentials.map((e) => e.rayonId),
    ...listItems.map((i) => i.rayonId),
  ]);

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= localRayons.length) return;
    const updated = [...localRayons];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    const reordered = updated.map((r, i) => ({ ...r, order: i + 1 }));
    setLocalRayons(reordered);
    setIsDirty(true);
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const id = newLabel
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const updated = [
      ...localRayons,
      {
        id,
        label: newLabel.trim(),
        icon: newIcon,
        order: localRayons.length + 1,
      },
    ];
    setLocalRayons(updated);
    setIsDirty(true);
    setAddDialogOpen(false);
    setNewLabel("");
    setNewIcon("📦");
  };

  const handleDelete = (rayon: Rayon) => {
    const updated = localRayons
      .filter((r) => r.id !== rayon.id)
      .map((r, i) => ({ ...r, order: i + 1 }));
    setLocalRayons(updated);
    setIsDirty(true);
    setDeleteTarget(null);
  };

  const handleSave = async () => {
    await onSave(localRayons);
    setIsDirty(false);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Gestion des rayons
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Réordonnez ou ajoutez des rayons. L'ordre définit celui de la liste de
        courses.
      </Typography>

      <List disablePadding>
        {localRayons.map((rayon, index) => {
          const isAssigned = assignedIds.has(rayon.id);
          return (
            <Box key={rayon.id}>
              <ListItem
                disablePadding
                sx={{
                  py: 0.5,
                  px: 1,
                  borderRadius: 2,
                  "&:hover": { backgroundColor: "action.hover" },
                }}
                secondaryAction={
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || isSaving}
                      aria-label="Monter"
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => move(index, 1)}
                      disabled={index === localRayons.length - 1 || isSaving}
                      aria-label="Descendre"
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <Tooltip
                      title={
                        isAssigned
                          ? "Des articles sont assignés à ce rayon"
                          : "Supprimer"
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => setDeleteTarget(rayon)}
                          disabled={isAssigned || isSaving}
                          aria-label="Supprimer"
                          sx={{ color: "error.main" }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                }
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    py: 1,
                    pl: 1,
                  }}
                >
                  <Typography
                    sx={{ fontSize: "1.3rem", width: 28, textAlign: "center" }}
                  >
                    {rayon.icon}
                  </Typography>
                  <ListItemText
                    primary={rayon.label}
                    secondary={`ordre ${rayon.order}`}
                  />
                </Box>
              </ListItem>
              {index < localRayons.length - 1 && <Divider sx={{ ml: 6 }} />}
            </Box>
          );
        })}
      </List>

      {/* FAB add */}
      <Fab
        color="primary"
        aria-label="Ajouter un rayon"
        onClick={() => setAddDialogOpen(true)}
        disabled={isSaving}
        sx={{ position: "fixed", bottom: 80, right: 20 }}
      >
        <AddIcon />
      </Fab>

      {/* Save button */}
      {isDirty && (
        <Box sx={{ position: "fixed", bottom: 148, right: 20 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
            sx={{ borderRadius: 6, px: 3, boxShadow: 3 }}
          >
            Sauvegarder
          </Button>
        </Box>
      )}

      {/* Add dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nouveau rayon</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "12px !important",
          }}
        >
          <TextField
            label="Nom du rayon"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim()) handleAdd();
            }}
            fullWidth
            autoFocus
            placeholder="Ex : Surgelés, Bio..."
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Icône
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {EMOJI_SUGGESTIONS.map((emoji) => (
                <Box
                  key={emoji}
                  onClick={() => setNewIcon(emoji)}
                  sx={{
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    p: 0.5,
                    borderRadius: 1,
                    border: "2px solid",
                    borderColor:
                      newIcon === emoji ? "primary.main" : "transparent",
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                >
                  {emoji}
                </Box>
              ))}
            </Box>
          </Box>
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
            onClick={handleAdd}
            variant="contained"
            disabled={!newLabel.trim()}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Supprimer "${deleteTarget?.label}" ?`}
        message="Ce rayon sera supprimé définitivement."
        confirmLabel="Supprimer"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Container>
  );
}
