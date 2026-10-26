import ChecklistIcon from "@mui/icons-material/Checklist";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, Paper, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Indispensables", icon: <ChecklistIcon />, path: "/essentials" },
  { label: "Ma Liste", icon: <ShoppingBagIcon />, path: "/list" },
  { label: "Recettes", icon: <MenuBookIcon />, path: "/recipes" },
  { label: "Réglages", icon: <TuneIcon />, path: "/rayons" },
];

// Chemins qui correspondent à un item de nav (pour l'état actif)
const PATH_TO_NAV: Record<string, string> = {
  "/add": "/list",
  "/history": "/rayons",
  "/settings": "/rayons",
};

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activePath = PATH_TO_NAV[location.pathname] ?? location.pathname;
  const currentIndex = NAV_ITEMS.findIndex(
    (item) =>
      activePath === item.path ||
      activePath.startsWith(item.path + "/"),
  );
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <Paper
      elevation={0}
      square
      sx={{
        backgroundColor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
        pb: "var(--sab)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          height: 64,
          alignItems: "center",
        }}
      >
        {NAV_ITEMS.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Box
              key={item.path}
              onClick={() => navigate(item.path)}
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.4,
                cursor: "pointer",
                py: 0.5,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 26,
                  borderRadius: "13px",
                  backgroundColor: isActive
                    ? "rgba(28, 61, 48, 0.1)"
                    : "transparent",
                  color: isActive ? "primary.main" : "#8A9E94",
                  transition: "all 0.18s ease",
                  "& svg": { fontSize: 20 },
                }}
              >
                {item.icon}
              </Box>
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: 0.1,
                  color: isActive ? "primary.main" : "#8A9E94",
                  lineHeight: 1,
                  transition: "color 0.18s ease",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
