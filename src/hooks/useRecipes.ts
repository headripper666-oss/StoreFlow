import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthConfig, Recipe } from "../types";
import { fetchRecipes, saveRecipes } from "../services/github";
import { DEFAULT_TAGS, detectTags } from "../utils/recipeUtils";

const MIGRATION_KEY = "storeflow_tags_migrated_v1";

function getAllKnownTags(recipes: Recipe[]): string[] {
  const tags = new Set<string>(DEFAULT_TAGS);
  recipes.forEach((r) => (r.tags ?? []).forEach((t) => tags.add(t)));
  return [...tags];
}

function silentMigrate(recipes: Recipe[]): Recipe[] {
  return recipes.map((r) => {
    const legacy = r as Recipe & { category?: string };
    if (!r.tags && legacy.category) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { category: _cat, ...rest } = legacy;
      return { ...rest, tags: [legacy.category] };
    }
    return r;
  });
}

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

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRecipes(config)
      .then(({ recipes: loaded, sha }) => {
        if (cancelled) return;

        const seen = new Set<string>();
        const deduped = loaded.filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });

        // Silent migration: category → tags
        const migrated = silentMigrate(deduped);
        shaRef.current = sha;

        if (!localStorage.getItem(MIGRATION_KEY)) {
          // Retroactive migration: re-detect tags and merge with existing
          const knownTags = getAllKnownTags(migrated);
          const retroactive = migrated.map((r) => {
            const detected = detectTags(r, knownTags);
            const existing = r.tags ?? [];
            const merged = [...new Set([...existing, ...detected])];
            return { ...r, tags: merged };
          });
          setRecipes(retroactive);
          saveRecipes(config, retroactive, sha)
            .then((newSha) => {
              shaRef.current = newSha;
              localStorage.setItem(MIGRATION_KEY, "1");
            })
            .catch(() => {
              // Non-blocking, will retry next load
            });
        } else {
          setRecipes(migrated);
        }
      })
      .catch(() => {
        if (cancelled) return;
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
