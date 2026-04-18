import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface TextPasteInputProps {
  onParsed: (text: string) => Promise<void>;
  isLoading: boolean;
}

export function TextPasteInput({ onParsed, isLoading }: TextPasteInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setError(null);
    try {
      await onParsed(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Collez votre liste de courses sous n'importe quel format. L'IA va la
        structurer automatiquement.
      </Typography>
      <TextField
        multiline
        rows={8}
        fullWidth
        placeholder={
          "Exemples :\n• 2 kg de tomates\n• lait demi-écrémé x3\n• pain\n• fromage râpé 200g\n• pâtes spaghetti"
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading}
        sx={{
          "& .MuiOutlinedInput-root": {
            fontFamily: "monospace",
            fontSize: "0.9rem",
          },
        }}
      />
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Button
        variant="contained"
        size="large"
        onClick={handleAnalyze}
        disabled={!text.trim() || isLoading}
        startIcon={
          isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <AutoAwesomeIcon />
          )
        }
        fullWidth
      >
        {isLoading ? "Analyse en cours..." : "Analyser avec l'IA"}
      </Button>
    </Box>
  );
}
