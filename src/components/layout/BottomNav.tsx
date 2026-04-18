import AddCircleIcon from "@mui/icons-material/AddCircle";
import ChecklistIcon from "@mui/icons-material/Checklist";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import TuneIcon from "@mui/icons-material/Tune";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Indispensables", icon: <ChecklistIcon />, path: "/essentials" },
  { label: "Ma Liste", icon: <ShoppingBagIcon />, path: "/list" },
  { label: "Ajouter", icon: <AddCircleIcon />, path: "/add" },
  { label: "Rayons", icon: <TuneIcon />, path: "/rayons" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentValue = NAV_ITEMS.findIndex(
    (item) =>
      location.pathname === item.path ||
      location.pathname.startsWith(item.path + "/"),
  );

  return (
    <Paper elevation={4} square>
      <BottomNavigation
        value={currentValue === -1 ? 0 : currentValue}
        onChange={(_, newValue) => {
          navigate(NAV_ITEMS[newValue].path);
        }}
        showLabels
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
