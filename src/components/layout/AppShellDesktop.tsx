import { Box, Snackbar } from "@mui/material";
import type { SyncStatus as SyncStatusType } from "../../types";
import { SidebarNav } from "./SidebarNav";
import { SplitPane } from "./SplitPane";

interface AppShellDesktopProps {
  children: React.ReactNode;
  syncStatus: SyncStatusType;
  lastSyncAt: Date | null;
  error: string | null;
  onLogout: () => void;
  rightPane: React.ReactNode | null;
  splitStorageKey?: string;
}

export function AppShellDesktop({
  children,
  syncStatus,
  lastSyncAt,
  error,
  onLogout,
  rightPane,
  splitStorageKey = "storeflow-split-default",
}: AppShellDesktopProps) {
  return (
    <Box
      sx={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "background.default",
      }}
    >
      <SidebarNav
        syncStatus={syncStatus}
        lastSyncAt={lastSyncAt}
        onLogout={onLogout}
      />

      <Box sx={{ flex: 1, overflow: "hidden", height: "100%" }}>
        {rightPane ? (
          <SplitPane
            storageKey={splitStorageKey}
            left={children}
            right={rightPane}
          />
        ) : (
          <Box
            sx={{
              height: "100%",
              overflowY: "auto",
              backgroundColor: "background.default",
            }}
          >
            {children}
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!error}
        message={error}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
