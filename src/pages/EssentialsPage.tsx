import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMemo, useState } from "react";
import { EssentialItem as EssentialItemComponent } from "../components/essentials/EssentialItem";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import type { CatalogProduct, EssentialItem, Rayon } from "../types";
import { normalize } from "../utils/recipeUtils";

interface EssentialsPageProps {
  essentials: EssentialItem[];
  rayons: Rayon[];
  catalog: CatalogProduct[];
  onToggle: (id: string) => void;
  onReset: () => Promise<void>;
  onAdd: (name: string, rayonId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateQuantity: (id: string, quantity: number, unit: string, price: number | undefined) => Promise<void>;
  onUpdateRayon: (id: string, rayonId: string) => Promise<void>;
  onReorder: (id: string, direction: -1 | 1) => Promise<void>;
  onMigrate: () => Promise<{ addedEssentials: number }>;
  isLoading: boolean;
  isSaving: boolean;
}

export function EssentialsPage({
  essentials,
  rayons,
  catalog,
  onToggle,
  onReset,
  onAdd,
  onDelete,
  onUpdateQuantity,
  onUpdateRayon,
  onReorder,
  onMigrate,
  isLoading,
  isSaving,
}: EssentialsPageProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRayons, setExpandedRayons] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("storeflow_essentials_expanded");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const handleAccordionChange = (rayonId: string, isExpanded: boolean) => {
    setExpandedRayons((prev) => {
      const next = { ...prev, [rayonId]: isExpanded };
      try { localStorage.setItem("storeflow_essentials_expanded", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrateSuccessMsg, setMigrateSuccessMsg] = useState<string | null>(
    null,
  );
  const [newName, setNewName] = useState("");
  const [newRayonId, setNewRayonId] = useState("autre");
  const [rayonEditItem, setRayonEditItem] = useState<EssentialItem | null>(null);
  const [openActionsItemId, setOpenActionsItemId] = useState<string | null>(null);

  const checkedCount = essentials.filter((e) => e.checked).length;
  const total = essentials.length;
  const progress = total > 0 ? (checkedCount / total) * 100 : 0;

  const handleOpenAdd = () => {
    setNewName(searchQuery); // Pre-fill with search query if any
    setNewRayonId("autre");
    setAddDialogOpen(true);
  };

  const handleConfirmAdd = async () => {
    if (!newName.trim()) return;
    setAddDialogOpen(false);
    await onAdd(newName, newRayonId);
    setSearchQuery(""); // Clear search after adding
  };

  const filteredEssentials = useMemo(() => {
    const getPrice = (name: string, itemPrice?: number) => {
      if (itemPrice !== undefined) return itemPrice;
      const norm = normalize(name);
      return catalog.find(p => normalize(p.name) === norm)?.pricePerUnit;
    };

    const base = searchQuery.trim()
      ? essentials.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      : essentials;
    
    return base.map(e => ({
      ...e,
      pricePerUnit: getPrice(e.name, e.pricePerUnit)
    }));
  }, [essentials, searchQuery, catalog]);

  const handleAddAllFiltered = async () => {
    const toAdd = filteredEssentials.filter(e => !e.checked);
    for (const item of toAdd) {
      await onToggle(item.id);
    }
    setSearchQuery("");
  };

  const knownRayonIds = new Set(rayons.map((r) => r.id));

  // Group essentials by rayon, sorted by rayon order
  const grouped = rayons
    .map((rayon) => ({
      rayon,
      items: filteredEssentials.filter((e) => e.rayonId === rayon.id),
    }))
    .filter((g) => g.items.length > 0);

  // Items whose rayonId no longer exists in the rayon list
  const orphanItems = filteredEssentials.filter((e) => !knownRayonIds.has(e.rayonId));
  const orphanRayon: Rayon = { id: "__orphan__", label: "Rayon inconnu", order: 9999, icon: "⚠️" };

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
    <Container maxWidth="sm" sx={{ py: 2, pb: { xs: 10, lg: 3 } }}>
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
          startIcon={<SystemUpdateAltIcon />}
          onClick={() => setMigrateDialogOpen(true)}
          disabled={isSaving || isLoading}
          sx={{ mr: 1 }}
        >
          Màj
        </Button>
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

      {/* Search Bar */}
      <Box sx={{ mb: 2, display: "flex", gap: 1 }}>
        <TextField
          placeholder="Rechercher..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery("")} edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              bgcolor: "background.paper",
            },
          }}
        />
        {searchQuery && filteredEssentials.some(e => !e.checked) && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<PlaylistAddCheckIcon />}
            onClick={handleAddAllFiltered}
            disabled={isSaving}
            sx={{ borderRadius: 3, px: 2, whiteSpace: "nowrap" }}
          >
            Tout ajouter
          </Button>
        )}
      </Box>

      {/* Progress bar */}
      {total > 0 && !searchQuery && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "action.hover",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                bgcolor: progress === 100 ? "success.main" : "primary.main",
              },
            }}
          />
          {checkedCount > 0 && (
            <Typography
              variant="caption"
              color={progress === 100 ? "success.main" : "text.secondary"}
              sx={{ display: "block", textAlign: "right", mt: 0.25 }}
            >
              {progress === 100 ? "✓ Tout coché !" : `${checkedCount} / ${total} cochés`}
            </Typography>
          )}
        </Box>
      )}

      {/* Grouped by rayon */}
      {grouped.map(({ rayon, items }) => {
        const uncheckedCount = items.filter((i) => !i.checked).length;
        const unchecked = items
          .filter((i) => !i.checked)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const checked = items.filter((i) => i.checked);
        const sorted = [...unchecked, ...checked];

        const isExpanded = expandedRayons[rayon.id] ?? uncheckedCount > 0;

        return (
          <Accordion
            key={rayon.id}
            expanded={isExpanded}
            onChange={(_, val) => handleAccordionChange(rayon.id, val)}
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
              {sorted.map((item, idx) => {
                const isUnchecked = !item.checked;
                const uncheckedIdx = isUnchecked ? unchecked.findIndex((i) => i.id === item.id) : -1;
                return (
                  <Box key={item.id} sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <EssentialItemComponent
                        item={item}
                        onToggle={() => onToggle(item.id)}
                        onDelete={() => onDelete(item.id)}
                        onUpdateQuantity={(qty, unit) => onUpdateQuantity(item.id, qty, unit, item.pricePerUnit)}
                        onChangeRayon={() => setRayonEditItem(item)}
                        onActionsToggle={(open) => setOpenActionsItemId(open ? item.id : null)}
                        disabled={isSaving}
                        isLast={idx === sorted.length - 1}
                      />
                    </Box>
                    {isUnchecked && openActionsItemId === item.id && (
                      <Box sx={{ display: "flex", flexDirection: "column", pr: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => onReorder(item.id, -1)}
                          disabled={isSaving || uncheckedIdx === 0}
                          sx={{ p: 0.25 }}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => onReorder(item.id, 1)}
                          disabled={isSaving || uncheckedIdx === unchecked.length - 1}
                          sx={{ p: 0.25 }}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Orphaned items — rayonId doesn't match any known rayon */}
      {orphanItems.length > 0 && (
        <Accordion
          key="__orphan__"
          defaultExpanded
          disableGutters
          sx={{
            mb: 0.5,
            borderRadius: "12px !important",
            overflow: "hidden",
            border: "1px solid rgba(255,160,0,0.4)",
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
                {orphanRayon.icon}
              </Typography>
              <Typography variant="subtitle1" color="warning.main">
                {orphanRayon.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                — assignez un rayon via le crayon
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {orphanItems.map((item, idx) => (
              <EssentialItemComponent
                key={item.id}
                item={item}
                onToggle={() => onToggle(item.id)}
                onDelete={() => onDelete(item.id)}
                onUpdateQuantity={(qty, unit) => onUpdateQuantity(item.id, qty, unit, item.pricePerUnit)}
                onChangeRayon={() => setRayonEditItem(item)}
                onActionsToggle={(open) => setOpenActionsItemId(open ? item.id : null)}
                disabled={isSaving}
                isLast={idx === orphanItems.length - 1}
              />
            ))}
          </AccordionDetails>
        </Accordion>
      )}

      {/* No results from search */}
      {searchQuery && filteredEssentials.length === 0 && (
        <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Aucun résultat pour "{searchQuery}"
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            sx={{ borderRadius: 6 }}
          >
            Ajouter "{searchQuery}"
          </Button>
        </Box>
      )}

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
        sx={{ position: "fixed", bottom: { xs: 80, lg: 24 }, right: { xs: 20, lg: "max(20px, calc((100vw - 220px) / 2 + 20px))" } }}
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

      {/* Migrate dialog */}
      <Dialog
        open={migrateDialogOpen}
        onClose={() => setMigrateDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Mettre à jour les données</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Cette action va :</Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <Typography component="li" variant="body2">
              Ajouter les articles indispensables manquants depuis le template
            </Typography>
            <Typography component="li" variant="body2">
              Remplacer les rayons par ceux du template
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Tes articles existants et leurs états ne seront pas modifiés.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setMigrateDialogOpen(false)}
            variant="outlined"
            color="inherit"
          >
            Annuler
          </Button>
          <Button
            onClick={async () => {
              setMigrateDialogOpen(false);
              try {
                const result = await onMigrate();
                setMigrateSuccessMsg(
                  result.addedEssentials > 0
                    ? `${result.addedEssentials} article(s) ajouté(s) avec succès.`
                    : "Données à jour, aucun nouvel article.",
                );
              } catch {
                // error is handled in the hook
              }
            }}
            variant="contained"
          >
            Mettre à jour
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change rayon dialog */}
      <Dialog
        open={rayonEditItem !== null}
        onClose={() => setRayonEditItem(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Changer le rayon</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {rayonEditItem?.name}
          </Typography>
          <Select
            value={rayonEditItem?.rayonId ?? ""}
            onChange={async (e) => {
              if (!rayonEditItem) return;
              const newRayon = e.target.value;
              setRayonEditItem(null);
              await onUpdateRayon(rayonEditItem.id, newRayon);
            }}
            fullWidth
          >
            {rayons.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.icon} {r.label}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRayonEditItem(null)} variant="outlined" color="inherit">
            Annuler
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar
        open={!!migrateSuccessMsg}
        autoHideDuration={4000}
        onClose={() => setMigrateSuccessMsg(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: 80 }}
      >
        <Alert
          onClose={() => setMigrateSuccessMsg(null)}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {migrateSuccessMsg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
