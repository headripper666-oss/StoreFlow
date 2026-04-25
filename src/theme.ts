import { createTheme } from "@mui/material/styles";

const FOREST = "#1C3D30";
const FOREST_LIGHT = "#2A5C47";
const FOREST_DARK = "#0F2018";
const SPICE = "#C2703E";
const SPICE_LIGHT = "#D9916A";
const SPICE_DARK = "#9A5028";
const PARCHMENT = "#F5EFE4";
const PAPER = "#FFFDF8";

export const theme = createTheme({
  palette: {
    primary: {
      main: FOREST,
      light: FOREST_LIGHT,
      dark: FOREST_DARK,
      contrastText: PAPER,
    },
    secondary: {
      main: SPICE,
      light: SPICE_LIGHT,
      dark: SPICE_DARK,
      contrastText: PAPER,
    },
    background: {
      default: PARCHMENT,
      paper: PAPER,
    },
    text: {
      primary: "#1A2520",
      secondary: "#5A6E62",
    },
    divider: "rgba(28, 61, 48, 0.1)",
    success: { main: FOREST_LIGHT },
    error: { main: "#B03A2E" },
  },
  typography: {
    fontFamily: '"DM Sans", "Helvetica", "Arial", sans-serif',
    h4: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 700,
      letterSpacing: -0.5,
    },
    h5: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 700,
      letterSpacing: -0.3,
    },
    h6: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 600,
      letterSpacing: -0.2,
    },
    subtitle1: { fontWeight: 500, letterSpacing: 0.1 },
    subtitle2: { fontWeight: 600, letterSpacing: 0.1 },
    body1: { fontSize: "1rem" },
    body2: { fontSize: "0.875rem" },
    button: { fontWeight: 600, letterSpacing: 0.2 },
    caption: { letterSpacing: 0.3 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
          letterSpacing: 0.2,
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 2px 8px rgba(28, 61, 48, 0.25)",
          },
        },
        sizeLarge: {
          padding: "13px 28px",
          fontSize: "1rem",
        },
        sizeSmall: {
          borderRadius: 6,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow:
            "0 1px 3px rgba(28, 61, 48, 0.06), 0 4px 12px rgba(28, 61, 48, 0.04)",
          borderRadius: 14,
          border: "1px solid rgba(28, 61, 48, 0.07)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6,
        },
        colorPrimary: {
          backgroundColor: FOREST,
          color: PAPER,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: FOREST,
          boxShadow: "none",
          borderBottom: `1px solid ${FOREST_DARK}`,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: "56px !important",
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          boxShadow: "none",
          "&:before": { display: "none" },
          "&.Mui-expanded": { margin: 0 },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&:hover": {
            backgroundColor: "rgba(28, 61, 48, 0.04)",
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: PAPER,
          borderTop: `1px solid rgba(28, 61, 48, 0.1)`,
          height: 64,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 56,
          color: "#8A9E94",
          "&.Mui-selected": {
            color: FOREST,
          },
        },
        label: {
          fontSize: "0.68rem",
          fontWeight: 600,
          letterSpacing: 0.1,
          "&.Mui-selected": {
            fontSize: "0.68rem",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: PAPER,
            "& fieldset": {
              borderColor: "rgba(28, 61, 48, 0.18)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(28, 61, 48, 0.35)",
            },
            "&.Mui-focused fieldset": {
              borderColor: FOREST,
            },
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: "0 4px 16px rgba(28, 61, 48, 0.28)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&.Mui-selected": {
            backgroundColor: "rgba(28, 61, 48, 0.08)",
            "&:hover": {
              backgroundColor: "rgba(28, 61, 48, 0.12)",
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: 0.1,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
