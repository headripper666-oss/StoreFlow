import LogoutIcon from "@mui/icons-material/Logout";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import {
  AppBar,
  Box,
  IconButton,
  Snackbar,
  Toolbar,
  Typography,
} from "@mui/material";
import type { SyncStatus as SyncStatusType } from "../../types";
import { UndoButton } from "../shared/UndoButton";
import { SyncStatus } from "../shared/SyncStatus";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  syncStatus: SyncStatusType;
  lastSyncAt: Date | null;
  error: string | null;
  undoCount: number;
  onUndo: () => void;
  onLogout: () => void;
}

export function AppShell({
  children,
  syncStatus,
  lastSyncAt,
  error,
  undoCount,
  onUndo,
  onLogout,
}: AppShellProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <AppBar position="fixed" elevation={1}>
        <Toolbar sx={{ minHeight: 56, gap: 1 }}>
          <ShoppingCartIcon sx={{ fontSize: 20, opacity: 0.85 }} />
          <Typography
            sx={{
              flex: 1,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 700,
              fontSize: "1.2rem",
              letterSpacing: 0.2,
              color: "#FFFDF8",
            }}
          >
            StoreFlow
          </Typography>
          <UndoButton count={undoCount} onUndo={onUndo} color="rgba(255,255,255,0.8)" />
          <SyncStatus status={syncStatus} lastSyncAt={lastSyncAt} />
          <IconButton
            onClick={onLogout}
            size="small"
            sx={{ color: "rgba(255,255,255,0.8)", ml: 0.5 }}
            aria-label="Se déconnecter"
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flex: 1,
          overflowY: "auto",
          pt: "56px",
          pb: "64px",
          backgroundColor: "background.default",
        }}
      >
        {children}
      </Box>

      <Box
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1200 }}
      >
        <BottomNav />
      </Box>

      <Snackbar
        open={!!error}
        message={error}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: 80 }}
      />
    </Box>
  );
}
