import AddCircleIcon from "@mui/icons-material/AddCircle";
import ChecklistIcon from "@mui/icons-material/Checklist";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import type { SyncStatus as SyncStatusType } from "../../types";

const NAV_ITEMS = [
  { label: "Indispensables", icon: <ChecklistIcon />, path: "/essentials" },
  { label: "Ma Liste", icon: <ShoppingBagIcon />, path: "/list" },
  { label: "Ajouter", icon: <AddCircleIcon />, path: "/add" },
  { label: "Recettes", icon: <MenuBookIcon />, path: "/recipes" },
];

const SETTINGS_ITEMS = [
  { label: "Rayons", icon: <TuneIcon />, path: "/rayons" },
];

interface SidebarNavProps {
  syncStatus: SyncStatusType;
  lastSyncAt: Date | null;
  onLogout: () => void;
}

export function SidebarNav({
  syncStatus,
  lastSyncAt,
  onLogout,
}: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Typography
          sx={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "primary.main",
            letterSpacing: 0.3,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          🛒 StoreFlow
        </Typography>
      </Box>

      <Divider />

      {/* Main nav */}
      <List sx={{ px: 1.5, pt: 1.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                px: 1.5,
                py: 1,
                "&.Mui-selected": {
                  backgroundColor: "rgba(28, 61, 48, 0.08)",
                  "&:hover": { backgroundColor: "rgba(28, 61, 48, 0.12)" },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: active ? "primary.main" : "text.secondary",
                  "& svg": { fontSize: 20 },
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: "0.875rem",
                      fontWeight: active ? 700 : 500,
                      color: active ? "primary.main" : "text.primary",
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}

        <Divider sx={{ my: 1 }} />

        {SETTINGS_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                px: 1.5,
                py: 1,
                "&.Mui-selected": {
                  backgroundColor: "rgba(28, 61, 48, 0.08)",
                  "&:hover": { backgroundColor: "rgba(28, 61, 48, 0.12)" },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: active ? "primary.main" : "text.secondary",
                  "& svg": { fontSize: 20 },
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: "0.875rem",
                      fontWeight: active ? 700 : 500,
                      color: active ? "primary.main" : "text.primary",
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Bottom: sync + logout */}
      <Divider />
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          backgroundColor: "background.paper",
        }}
      >
        <Box sx={{ flex: 1 }}>
          <SyncStatusSidebar status={syncStatus} lastSyncAt={lastSyncAt} />
        </Box>
        <Tooltip title="Se déconnecter" placement="top">
          <IconButton
            onClick={onLogout}
            size="small"
            sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function SyncStatusSidebar({
  status,
  lastSyncAt,
}: {
  status: SyncStatusType;
  lastSyncAt: Date | null;
}) {
  const colorMap: Record<SyncStatusType, string> = {
    synced: "#6BBF8A",
    saving: "#D9916A",
    offline: "#E07070",
    error: "#E07070",
  };

  function formatLastSync(date: Date | null): string {
    if (!date) return "Jamais";
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `il y a ${diffMin}m`;
    return `il y a ${Math.floor(diffMin / 60)}h`;
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: colorMap[status],
          flexShrink: 0,
        }}
      />
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontSize: "0.7rem" }}
      >
        {formatLastSync(lastSyncAt)}
      </Typography>
    </Box>
  );
}
