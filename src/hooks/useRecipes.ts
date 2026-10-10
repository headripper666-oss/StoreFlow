import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthConfig, Recipe } from "../types";
import { fetchRecipes, saveRecipes, connectWebSocket } from "../services/api";
import { capitalize, DEFAULT_TAGS, detectTags, normalize } from "../utils/recipeUtils";
import { usePolling } from "./usePolling";

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
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;
  updateRecipeIngredientRayon: (name: string, rayonId: string) => Promise<void>;
  updateRecipeIngredientPrice: (name: string, pricePerUnit: number | undefined) => Promise<void>;
  updateRecipeIngredientCalories: (name: string, caloriesPerUnit: number | undefined) => Promise<void>;
  updateRecipeIngredientUnit: (name: string, unit: string) => Promise<void>;
}

export function useRecipes(config: AuthConfig | null): UseRecipesReturn {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shaRef = useRef<string>("");
  const capitalizeRanRef = useRef(false);

  const processLoadedRecipes = useCallback((loaded: Recipe[], sha: string) => {
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
      if (config) {
        saveRecipes(config, retroactive, sha)
          .then((newSha) => {
            shaRef.current = newSha;
            localStorage.setItem(MIGRATION_KEY, "1");
          })
          .catch(() => {
            // Non-blocking, will retry next load
          });
      }
    } else {
      setRecipes(migrated);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRecipes(config)
      .then(({ recipes: loaded, sha }) => {
        if (cancelled) return;
        processLoadedRecipes(loaded, sha);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Erreur lors du chargement des recettes.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const disconnectWs = connectWebSocket((table) => {
      if ((table === "recipes" || table === "all") && !isSaving) {
        fetchRecipes(config).then(({ recipes: loaded, sha }) => {
          processLoadedRecipes(loaded, sha);
        }).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      disconnectWs();
    };
  }, [config, processLoadedRecipes]);

  // Poll for remote changes every 60 seconds
  const pollCallback = useCallback(async () => {
    if (!config || isSaving || isLoading) return;

    try {
      const { recipes: loaded, sha } = await fetchRecipes(config);
      if (sha !== shaRef.current) {
        processLoadedRecipes(loaded, sha);
      }
    } catch {
      // Silently fail polling
    }
  }, [config, isSaving, isLoading, processLoadedRecipes]);

  usePolling(60_000, pollCallback, config !== null && !isLoading);

  // One-time migration: capitalize all ingredient names
  useEffect(() => {
    const CAP_KEY = "storeflow_capitalize_recipes_v1";
    if (!recipes.length || !config || isLoading || capitalizeRanRef.current || localStorage.getItem(CAP_KEY)) return;
    capitalizeRanRef.current = true;

    saveRecipesData((current) =>
      current.map((r) => ({
        ...r,
        ingredients: r.ingredients.map((ing) => ({ ...ing, name: capitalize(ing.name) })),
      })),
    )
      .then(() => localStorage.setItem(CAP_KEY, "1"))
      .catch(() => { capitalizeRanRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!recipes.length, !!config, isLoading]);


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
        let userError = `Erreur lors de la sauvegarde : ${msg}`;
        if (msg === "CONFLICT") {
          userError = "Conflit de synchronisation : quelqu'un d'autre a modifié les recettes. Rechargez la page.";
        } else if (msg.includes("403") || msg.includes("401")) {
          userError = "Erreur de permission : votre token GitHub n'a peut-être pas les droits d'écriture.";
        }
        setError(userError);
        setRecipes(previous);
        throw err; // Re-throw to allow callers to handle failure
      } finally {
        setIsSaving(false);
      }
    },
    [config, recipes],
  );

  const capIngredients = (recipe: Recipe): Recipe => ({
    ...recipe,
    ingredients: recipe.ingredients.map((ing) => ({ ...ing, name: capitalize(ing.name) })),
  });

  const saveRecipe = useCallback(
    async (recipe: Recipe) => {
      await saveRecipesData((current) => [...current, capIngredients(recipe)]);
    },
    [saveRecipesData],
  );

  const updateRecipe = useCallback(
    async (recipe: Recipe) => {
      await saveRecipesData((current) =>
        current.map((r) => (r.id === recipe.id ? capIngredients(recipe) : r)),
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

  const renameTag = useCallback(
    async (oldTag: string, newTag: string) => {
      if (!newTag.trim() || oldTag === newTag.trim()) return;
      const trimmed = newTag.trim();
      await saveRecipesData((current) =>
        current.map((r) => {
          if (!(r.tags ?? []).includes(oldTag)) return r;
          const updated = [...new Set((r.tags ?? []).map((t) => (t === oldTag ? trimmed : t)))];
          return { ...r, tags: updated };
        }),
      );
    },
    [saveRecipesData],
  );

  const deleteTag = useCallback(
    async (tag: string) => {
      await saveRecipesData((current) =>
        current.map((r) => ({ ...r, tags: (r.tags ?? []).filter((t) => t !== tag) })),
      );
    },
    [saveRecipesData],
  );

  const updateRecipeIngredientRayon = useCallback(
    async (name: string, rayonId: string) => {
      const n = normalize(name);
      await saveRecipesData((current) =>
        current.map((r) => ({
          ...r,
          ingredients: r.ingredients.map((ing) =>
            normalize(ing.name) === n ? { ...ing, rayonId } : ing,
          ),
        })),
      );
    },
    [saveRecipesData],
  );

  const updateRecipeIngredientPrice = useCallback(
    async (name: string, pricePerUnit: number | undefined) => {
      const n = normalize(name);
      await saveRecipesData((current) =>
        current.map((r) => ({
          ...r,
          ingredients: r.ingredients.map((ing) =>
            normalize(ing.name) === n ? { ...ing, pricePerUnit } : ing,
          ),
        })),
      );
    },
    [saveRecipesData],
  );

  const updateRecipeIngredientCalories = useCallback(
    async (name: string, caloriesPerUnit: number | undefined) => {
      const n = normalize(name);
      await saveRecipesData((current) =>
        current.map((r) => ({
          ...r,
          ingredients: r.ingredients.map((ing) =>
            normalize(ing.name) === n ? { ...ing, caloriesPerUnit } : ing,
          ),
        })),
      );
    },
    [saveRecipesData],
  );

  const updateRecipeIngredientUnit = useCallback(
    async (name: string, unit: string) => {
      const n = normalize(name);
      await saveRecipesData((current) =>
        current.map((r) => ({
          ...r,
          ingredients: r.ingredients.map((ing) =>
            normalize(ing.name) === n ? { ...ing, unit } : ing,
          ),
        })),
      );
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
    renameTag,
    deleteTag,
    updateRecipeIngredientRayon,
    updateRecipeIngredientPrice,
    updateRecipeIngredientCalories,
    updateRecipeIngredientUnit,
  };
}
