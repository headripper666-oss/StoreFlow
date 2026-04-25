import { Box, CircularProgress, Tooltip, Typography } from "@mui/material";
import type { SyncStatus as SyncStatusType } from "../../types";

interface SyncStatusProps {
  status: SyncStatusType;
  lastSyncAt: Date | null;
}

function formatLastSync(date: Date | null): string {
  if (!date) return "Jamais synchronisé";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return `il y a ${diffH}h`;
}

const statusConfig: Record<SyncStatusType, { color: string; label: string }> = {
  synced: { color: "#6BBF8A", label: "Synchronisé" },
  saving: { color: "#D9916A", label: "Sauvegarde..." },
  offline: { color: "#E07070", label: "Hors ligne" },
  error: { color: "#E07070", label: "Erreur de sync" },
};

export function SyncStatus({ status, lastSyncAt }: SyncStatusProps) {
  const { color, label } = statusConfig[status];
  const tooltipText = `${label} — ${formatLastSync(lastSyncAt)}`;

  return (
    <Tooltip title={tooltipText} arrow>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          cursor: "default",
        }}
      >
        {status === "saving" ? (
          <CircularProgress size={10} sx={{ color: "#D9916A" }} />
        ) : (
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: color,
              flexShrink: 0,
            }}
          />
        )}
        <Typography
          variant="caption"
          sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.7rem" }}
        >
          {formatLastSync(lastSyncAt)}
        </Typography>
      </Box>
    </Tooltip>
  );
}
