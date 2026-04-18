import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface LoginPageProps {
  onLogin: (pat: string, owner: string, repo: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export function LoginPage({ onLogin, isLoading, error }: LoginPageProps) {
  const [pat, setPat] = useState("");
  const [owner, setOwner] = useState(import.meta.env.VITE_DATA_OWNER ?? "");
  const [repo, setRepo] = useState(
    import.meta.env.VITE_DATA_REPO ?? "storeflow-data",
  );
  const [showPat, setShowPat] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pat || !owner || !repo) return;
    await onLogin(pat.trim(), owner.trim(), repo.trim());
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        backgroundColor: "background.default",
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: "20px",
              backgroundColor: "primary.main",
              mb: 2,
            }}
          >
            <ShoppingCartIcon sx={{ fontSize: 38, color: "white" }} />
          </Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: "primary.dark" }}
          >
            StoreFlow
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Votre liste de courses partagée
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            backgroundColor: "background.paper",
            borderRadius: 3,
            p: 3,
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Connexion
          </Typography>

          <TextField
            label="Utilisateur GitHub"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            fullWidth
            required
            autoComplete="username"
            placeholder="votre-pseudo"
            disabled={isLoading}
          />

          <TextField
            label="Dépôt de données"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            fullWidth
            required
            placeholder="storeflow-data"
            disabled={isLoading}
            helperText="Nom du dépôt GitHub où les données sont stockées"
          />

          <TextField
            label="Personal Access Token"
            type={showPat ? "text" : "password"}
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            fullWidth
            required
            autoComplete="current-password"
            placeholder="github_pat_..."
            disabled={isLoading}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPat((s) => !s)}
                      edge="end"
                      size="small"
                      aria-label={
                        showPat ? "Masquer le token" : "Afficher le token"
                      }
                    >
                      {showPat ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={!pat || !owner || !repo || isLoading}
            startIcon={
              isLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <LockOpenIcon />
              )
            }
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </Button>
        </Box>

        <Accordion
          sx={{
            mt: 2,
            boxShadow: "none",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "12px !important",
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Comment créer un Personal Access Token ?
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="ol"
              sx={{
                pl: 2,
                m: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
              }}
            >
              <li>
                <Typography variant="body2">
                  Connectez-vous sur{" "}
                  <Link href="https://github.com" target="_blank">
                    github.com
                  </Link>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Allez dans{" "}
                  <strong>
                    Settings → Developer settings → Personal access tokens →
                    Fine-grained tokens
                  </strong>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Cliquez sur <strong>Generate new token</strong>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Sélectionnez le dépôt <code>{repo || "storeflow-data"}</code>{" "}
                  uniquement
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Accordez la permission{" "}
                  <strong>Contents: Read and write</strong>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Copiez le token généré et collez-le ci-dessus
                </Typography>
              </li>
            </Box>
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Les deux utilisateurs partagent le même token. Ne le partagez pas
              avec d'autres personnes.
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Container>
    </Box>
  );
}
