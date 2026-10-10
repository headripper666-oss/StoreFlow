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
import {
  fetchAiCredits,
  fetchAiSettings,
  isGithubOnly,
  saveAiSettings,
  type ServerAiSettings,
} from "../../services/api";

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
  const [settings, setSettings] = useState<ServerAiSettings | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [imagesOnly, setImagesOnly] = useState(true);

  async function save(patch: Parameters<typeof saveAiSettings>[0]) {
    setSaving(true);
    setError(null);
    try {
      const next = await saveAiSettings(patch);
      setSettings(next);
      if (patch.apiKey) {
        setKeyInput("");
        setCredits(await fetchAiCredits());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  // Config actuelle du serveur + liste publique des modèles OpenRouter
  useEffect(() => {
    if (isGithubOnly()) return;
    fetchAiSettings()
      .then((s) => {
        setSettings(s);
        if (s.hasKey) fetchAiCredits().then(setCredits);
      })
      .catch(() => setError("Serveur injoignable : réglages IA indisponibles."));
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => r.json())
      .then((json) =>
        setModels(
          (json.data as OpenRouterModel[])
            // Variantes ":batch" = traitement différé, inutilisables pour une réponse immédiate
            .filter((m) => !m.id.endsWith(":batch"))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => {});
  }, []);

  const visibleModels = useMemo(
    () => (imagesOnly ? models.filter(readsImages) : models),
    [models, imagesOnly],
  );

  if (isGithubOnly()) {
    return (
      <Alert severity="info" sx={{ maxWidth: 640 }}>
        L'analyse par IA passe par le PC : elle n'est pas disponible dans la version de secours.
      </Alert>
    );
  }

  if (!settings) {
    return error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />;
  }

  const selectedModel = models.find((m) => m.id === settings.model) ?? null;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Intelligence artificielle
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Utilisée pour analyser les listes et les recettes (texte, photo, lien).
        Réglage partagé par tous les appareils.
      </Typography>

      <RadioGroup
        value={settings.provider}
        onChange={(e) => save({ provider: e.target.value as ServerAiSettings["provider"] })}
      >
        <FormControlLabel value="mistral" control={<Radio />} label="Mistral (clé du serveur)" />
        <FormControlLabel value="openrouter" control={<Radio />} label="OpenRouter (mon compte)" />
      </RadioGroup>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {settings.provider === "openrouter" && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {settings.hasKey ? (
            <Alert severity="success">
              Clé OpenRouter enregistrée sur le serveur
              {credits !== null && ` — ${credits.toFixed(2)} $ de crédits restants`}
            </Alert>
          ) : (
            <Alert severity="info">
              La clé est envoyée une seule fois au serveur, puis ne circule plus. Fais-le depuis le
              Wi-Fi de la maison ou avec le VPN.
            </Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label={settings.hasKey ? "Remplacer la clé API" : "Clé API OpenRouter"}
              type="password"
              placeholder="sk-or-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.trim())}
              size="small"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() => save({ apiKey: keyInput })}
              disabled={!keyInput || saving}
              sx={{ whiteSpace: "nowrap" }}
            >
              {saving ? <CircularProgress size={20} /> : "Enregistrer"}
            </Button>
          </Stack>

          {settings.hasKey && (
            <>
              <FormControlLabel
                control={<Switch checked={imagesOnly} onChange={(e) => setImagesOnly(e.target.checked)} />}
                label="Seulement les modèles qui lisent les images (import photo)"
              />
              <Autocomplete
                options={visibleModels}
                value={selectedModel}
                onChange={(_, m) => m && save({ model: m.id })}
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
              {!settings.model && (
                <Alert severity="info">Choisis un modèle : en attendant, c'est Mistral qui est utilisé.</Alert>
              )}
              {settings.model && models.length > 0 && !selectedModel && (
                <Alert severity="warning">
                  Le modèle enregistré ({settings.model}) n'est pas utilisable : choisis-en un autre.
                </Alert>
              )}
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
