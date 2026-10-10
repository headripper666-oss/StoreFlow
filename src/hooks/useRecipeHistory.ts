import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthConfig, RecipeHistoryEntry } from "../types";
import { fetchHistory, saveHistory } from "../services/api";

interface UseRecipeHistoryReturn {
  history: RecipeHistoryEntry[];
  isLoading: boolean;
  isSaving: boolean;
  recordUsage: (entry: RecipeHistoryEntry) => Promise<void>;
  removeEntry: (recipeId: string) => Promise<void>;
}

export function useRecipeHistory(config: AuthConfig | null): UseRecipeHistoryReturn {
  const [history, setHistory] = useState<RecipeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const shaRef = useRef<string>("");

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    setIsLoading(true);

    fetchHistory(config)
      .then(({ history: loaded, sha }) => {
        if (cancelled) return;
        shaRef.current = sha;
        setHistory(loaded);
      })
      .catch(() => {
        // Non-bloquant : l'historique est optionnel
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [config]);

  const saveHistoryData = useCallback(
    async (updater: (current: RecipeHistoryEntry[]) => RecipeHistoryEntry[]) => {
      if (!config) return;

      const previous = history;
      const updated = updater(history);
      setHistory(updated);
      setIsSaving(true);

      try {
        const newSha = await saveHistory(config, updated, shaRef.current);
        shaRef.current = newSha;
      } catch {
        setHistory(previous);
      } finally {
        setIsSaving(false);
      }
    },
    [config, history],
  );

  const recordUsage = useCallback(
    async (entry: RecipeHistoryEntry) => {
      await saveHistoryData((current) => {
        const exists = current.find((e) => e.recipeId === entry.recipeId);
        if (exists) {
          return current.map((e) => e.recipeId === entry.recipeId ? entry : e);
        }
        return [...current, entry];
      });
    },
    [saveHistoryData],
  );

  const removeEntry = useCallback(
    async (recipeId: string) => {
      await saveHistoryData((current) => current.filter((e) => e.recipeId !== recipeId));
    },
    [saveHistoryData],
  );

  return { history, isLoading, isSaving, recordUsage, removeEntry };
}
