import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthConfig, Recipe } from "../types";
import { fetchRecipes, saveRecipes } from "../services/github";

interface UseRecipesReturn {
  recipes: Recipe[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
}

export function useRecipes(config: AuthConfig | null): UseRecipesReturn {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shaRef = useRef<string>("");

  // Load recipes on mount / config change
  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRecipes(config)
      .then(({ recipes: loaded, sha }) => {
        if (cancelled) return;
        setRecipes(loaded);
        shaRef.current = sha;
      })
      .catch(() => {
        if (cancelled) return;
        // Non-blocking: recipes stay empty on error
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config]);

  const saveRecipesData = useCallback(
    async (updater: (current: Recipe[]) => Recipe[]) => {
      if (!config) return;

      const previous = recipes;
      const updated = updater(recipes);
      setRecipes(updated);
      setIsSaving(true);
      setError(null);

      try {
        const newSha = await saveRecipes(config, updated, shaRef.current);
        shaRef.current = newSha;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "CONFLICT") {
          setError(
            "Conflit de synchronisation. Rechargez la page et réessayez.",
          );
        } else {
          setError("Erreur lors de la sauvegarde de la recette.");
        }
        setRecipes(previous);
      } finally {
        setIsSaving(false);
      }
    },
    [config, recipes],
  );

  const saveRecipe = useCallback(
    async (recipe: Recipe) => {
      await saveRecipesData((current) => [...current, recipe]);
    },
    [saveRecipesData],
  );

  const updateRecipe = useCallback(
    async (recipe: Recipe) => {
      await saveRecipesData((current) =>
        current.map((r) => (r.id === recipe.id ? recipe : r)),
      );
    },
    [saveRecipesData],
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      await saveRecipesData((current) => current.filter((r) => r.id !== id));
    },
    [saveRecipesData],
  );

  return {
    recipes,
    isLoading,
    isSaving,
    error,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
  };
}
