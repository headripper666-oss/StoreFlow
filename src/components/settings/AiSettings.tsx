import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { loadAiSettings, saveAiSettings } from "../../services/storage";
import type { AiSettings as AiSettingsType } from "../../types";

const OPENROUTER_API = "https://openrouter.ai/api/v1";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  architecture?: { input_modalities?: string[] };
}

// Prix en $ par million de tokens (entrée / sortie)
function formatPrice(m: OpenRouterModel): string {
  const input = Number(m.pricing.prompt) * 1e6;
  const output = Number(m.pricing.completion) * 1e6;
  if (input === 0 && output === 0) return "gratuit";
  return `${input.toFixed(2)} $ / ${output.toFixed(2)} $ par M tokens`;
}

function readsImages(m: OpenRouterModel): boolean {
  return m.architecture?.input_modalities?.includes("image") ?? false;
}

export function AiSettings() {
  const [settings, setSettings] = useState<AiSettingsType>(loadAiSettings);
  const [keyInput, setKeyInput] = useState(settings.openrouterKey);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [imagesOnly, setImagesOnly] = useState(true);

  function update(patch: Partial<AiSettingsType>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  }

  // Vérifie la clé, affiche le solde et charge la liste des modèles
  async function connect(key: string) {
    setConnecting(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${key}` };
      const keyRes = await fetch(`${OPENROUTER_API}/key`, { headers });
      if (!keyRes.ok) throw new Error("Clé API refusée par OpenRouter");
      const credits = await fetch(`${OPENROUTER_API}/credits`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const remaining = credits
        ? `${(credits.data.total_credits - credits.data.total_usage).toFixed(2)} $ de crédits restants`
        : "connecté";
      setAccount(remaining);

      const modelsRes = await fetch(`${OPENROUTER_API}/models`);
      const json = await modelsRes.json();
      setModels(
        (json.data as OpenRouterModel[]).sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (key !== settings.openrouterKey) update({ openrouterKey: key });
    } catch (e) {
      setAccount(null);
      setError(e instanceof Error ? e.message : "Connexion impossible");
    } finally {
      setConnecting(false);
    }
  }

  // Reconnexion automatique si une clé est déjà enregistrée
  useEffect(() => {
    if (settings.provider === "openrouter" && settings.openrouterKey) {
      connect(settings.openrouterKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleModels = useMemo(
    () => (imagesOnly ? models.filter(readsImages) : models),
    [models, imagesOnly],
  );
  const selectedModel = models.find((m) => m.id === settings.openrouterModel) ?? null;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Intelligence artificielle
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Utilisée pour analyser les listes et les recettes (texte, photo, lien).
        Réglage propre à cet appareil.
      </Typography>

      <RadioGroup
        value={settings.provider}
        onChange={(e) => update({ provider: e.target.value as AiSettingsType["provider"] })}
      >
        <FormControlLabel value="mistral" control={<Radio />} label="Mistral (clé du serveur)" />
        <FormControlLabel value="openrouter" control={<Radio />} label="OpenRouter (mon compte)" />
      </RadioGroup>

      {settings.provider === "openrouter" && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Clé API OpenRouter"
              type="password"
              placeholder="sk-or-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.trim())}
              size="small"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() => connect(keyInput)}
              disabled={!keyInput || connecting}
              sx={{ whiteSpace: "nowrap" }}
            >
              {connecting ? <CircularProgress size={20} /> : "Connecter"}
            </Button>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
          {account && <Alert severity="success">Compte OpenRouter : {account}</Alert>}

          {account && (
            <>
              <FormControlLabel
                control={<Switch checked={imagesOnly} onChange={(e) => setImagesOnly(e.target.checked)} />}
                label="Seulement les modèles qui lisent les images (import photo)"
              />
              <Autocomplete
                options={visibleModels}
                value={selectedModel}
                onChange={(_, m) => update({ openrouterModel: m?.id ?? "" })}
                getOptionLabel={(m) => m.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                filterOptions={(opts, { inputValue }) => {
                  const q = inputValue.toLowerCase();
                  return opts.filter(
                    (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
                  );
                }}
                renderOption={(props, m) => (
                  <li {...props} key={m.id}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {m.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatPrice(m)}
                        {readsImages(m) && " · lit les images"}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label={`Modèle (${visibleModels.length} disponibles)`} size="small" />
                )}
              />
              {selectedModel && (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip label={selectedModel.id} size="small" />
                  <Chip label={formatPrice(selectedModel)} size="small" />
                  {!readsImages(selectedModel) && (
                    <Chip label="ne lit pas les images" size="small" color="warning" />
                  )}
                </Stack>
              )}
              {!settings.openrouterModel && (
                <Alert severity="info">Choisis un modèle : en attendant, c'est Mistral qui est utilisé.</Alert>
              )}
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
