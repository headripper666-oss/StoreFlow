import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  AuthConfig,
  CatalogProduct,
  EssentialItem,
  ListItem,
  ParsedProduct,
  Rayon,
  ShoppingData,
  SyncStatus,
} from "../types";
import {
  fetchCatalog,
  fetchRayons,
  fetchShoppingData,
  saveRayons,
  saveShoppingData,
} from "../services/github";
import { normalize, normalizeUnit } from "../utils/recipeUtils";
import templateListsJson from "../../data-init/lists.json";
import templateRayonsJson from "../../data-init/rayons.json";
import {
  cacheData,
  getCachedData,
  loadSHA,
  saveETag,
  saveSHA,
} from "../services/storage";
import { DEFAULT_RAYONS } from "../constants/defaultRayons";
import { usePolling } from "./usePolling";

interface UseShoppingListReturn {
  data: ShoppingData | null;
  rayons: Rayon[];
  catalog: CatalogProduct[];
  isLoading: boolean;
  isSaving: boolean;
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  error: string | null;
  toggleEssential: (id: string) => Promise<void>;
  resetEssentials: () => Promise<void>;
  addEssential: (name: string, rayonId: string) => Promise<void>;
  removeEssential: (id: string) => Promise<void>;
  updateEssentialQuantity: (id: string, quantity: number, unit: string) => Promise<void>;
  updateEssentialRayon: (id: string, rayonId: string) => Promise<void>;
  reorderEssential: (id: string, direction: -1 | 1) => Promise<void>;
  updateRayons: (rayons: Rayon[]) => Promise<void>;
  addItems: (
    items: Omit<ListItem, "id" | "addedAt" | "checked">[],
  ) => Promise<void>;
  addFromParsed: (parsed: ParsedProduct[]) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  updateItemQuantity: (id: string, quantity: number, unit: string) => Promise<void>;
  toggleAllItems: (checked: boolean) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearChecked: () => Promise<void>;
  migrateData: () => Promise<{ addedEssentials: number }>;
}

function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}

export function useShoppingList(
  config: AuthConfig | null,
): UseShoppingListReturn {
  const [data, setData] = useState<ShoppingData | null>(null);
  const [rayons, setRayons] = useState<Rayon[]>(DEFAULT_RAYONS);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shaRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const pendingDataRef = useRef<ShoppingData | null>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Initial load
  useEffect(() => {
    if (!config) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      // Try cache first for instant display
      const cached = getCachedData();
      const cachedSha = loadSHA();
      if (cached) {
        setData(cached);
        shaRef.current = cachedSha;
      } else {
        // No cache — clear any stale ETag so we always get fresh data
        saveETag("");
      }

      const [fetchedRayons, fetchedCatalog] = await Promise.all([
        fetchRayons(config),
        fetchCatalog(config),
      ]);
      setRayons(fetchedRayons);
      setCatalog(fetchedCatalog);

      try {
        const fileState = await fetchShoppingData(config);
        setData(fileState.content);
        shaRef.current = fileState.sha;
        cacheData(fileState.content);
        setSyncStatus("synced");
        setLastSyncAt(new Date());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "NOT_MODIFIED") {
          setSyncStatus("synced");
          setLastSyncAt(new Date());
        } else if (!cached) {
          setError(
            "Impossible de charger les données. Vérifiez votre connexion.",
          );
          setSyncStatus("offline");
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [config]);

  // Poll for remote changes every 30 seconds
  const pollCallback = useCallback(async () => {
    if (!config || isSaving) return;

    try {
      const fileState = await fetchShoppingData(config);
      if (fileState.sha !== shaRef.current) {
        setData(fileState.content);
        shaRef.current = fileState.sha;
        cacheData(fileState.content);
        setSyncStatus("synced");
        setLastSyncAt(new Date());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "NOT_MODIFIED") {
        setLastSyncAt(new Date());
      } else {
        setSyncStatus("offline");
      }
    }
  }, [config, isSaving]);

  const { lastPolledAt } = usePolling(
    30_000,
    pollCallback,
    config !== null && !isLoading,
  );

  useEffect(() => {
    if (lastPolledAt) setLastSyncAt(lastPolledAt);
  }, [lastPolledAt]);

  // Retry pending save when connectivity is restored
  useEffect(() => {
    const handleOnline = async () => {
      const cfg = configRef.current;
      if (
        !dirtyRef.current ||
        !cfg ||
        !pendingDataRef.current ||
        !shaRef.current
      )
        return;

      setSyncStatus("saving");
      setIsSaving(true);
      try {
        const newSha = await saveShoppingData(
          cfg,
          pendingDataRef.current,
          shaRef.current,
        );
        shaRef.current = newSha;
        saveSHA(newSha);
        cacheData(pendingDataRef.current);
        setSyncStatus("synced");
        setLastSyncAt(new Date());
        dirtyRef.current = false;
        pendingDataRef.current = null;
      } catch {
        setSyncStatus("error");
        setError("Impossible de synchroniser les modifications hors-ligne.");
      } finally {
        setIsSaving(false);
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Generic save helper with optimistic update
  const saveData = useCallback(
    async (updater: (current: ShoppingData) => ShoppingData): Promise<void> => {
      if (!config || !data || !shaRef.current) return;

      const prevData = data;
      const prevSha = shaRef.current;
      const updated = updater(data);

      // Optimistic update
      setData(updated);
      setIsSaving(true);
      setSyncStatus("saving");

      try {
        const newSha = await saveShoppingData(config, updated, shaRef.current);
        shaRef.current = newSha;
        saveSHA(newSha);
        cacheData(updated);
        setSyncStatus("synced");
        setLastSyncAt(new Date());
        dirtyRef.current = false;
        pendingDataRef.current = null;
      } catch (err) {
        if (isNetworkError(err)) {
          // Keep optimistic state, mark as dirty for retry when back online
          dirtyRef.current = true;
          pendingDataRef.current = updated;
          setSyncStatus("offline");
        } else {
          // Non-network error (conflict, auth): rollback
          setData(prevData);
          shaRef.current = prevSha;
          setSyncStatus("error");
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Erreur de sauvegarde : ${msg}`);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [config, data],
  );

  const toggleEssential = useCallback(
    async (id: string) => {
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, checked: !e.checked } : e,
        ),
      }));
    },
    [saveData],
  );

  const resetEssentials = useCallback(async () => {
    await saveData((current) => ({
      ...current,
      essentials: current.essentials.map((e: EssentialItem) => ({
        ...e,
        checked: false,
      })),
    }));
  }, [saveData]);

  const addEssential = useCallback(
    async (name: string, rayonId: string) => {
      await saveData((current) => {
        const rayonItems = current.essentials.filter((e) => e.rayonId === rayonId);
        const maxOrder = rayonItems.reduce((max, e) => Math.max(max, e.order ?? 0), 0);
        return {
          ...current,
          essentials: [
            ...current.essentials,
            { id: uuidv4(), name: name.trim(), rayonId, checked: false, order: maxOrder + 1 },
          ],
        };
      });
    },
    [saveData],
  );

  const reorderEssential = useCallback(
    async (id: string, direction: -1 | 1) => {
      await saveData((current) => {
        const item = current.essentials.find((e) => e.id === id);
        if (!item) return current;
        const rayonUnchecked = current.essentials
          .filter((e) => e.rayonId === item.rayonId && !e.checked)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((e, i) => ({ ...e, order: i + 1 }));
        const idx = rayonUnchecked.findIndex((e) => e.id === id);
        const next = idx + direction;
        if (next < 0 || next >= rayonUnchecked.length) return current;
        [rayonUnchecked[idx], rayonUnchecked[next]] = [rayonUnchecked[next], rayonUnchecked[idx]];
        const reordered = rayonUnchecked.map((e, i) => ({ ...e, order: i + 1 }));
        const reorderedMap = new Map(reordered.map((e) => [e.id, e]));
        return {
          ...current,
          essentials: current.essentials.map((e) => reorderedMap.get(e.id) ?? e),
        };
      });
    },
    [saveData],
  );

  const removeEssential = useCallback(
    async (id: string) => {
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.filter(
          (e: EssentialItem) => e.id !== id,
        ),
      }));
    },
    [saveData],
  );

  const addItems = useCallback(
    async (items: Omit<ListItem, "id" | "addedAt" | "checked">[]) => {
      await saveData((current) => {
        const newList = [...current.personalList];
        for (const item of items) {
          const normalizedName = normalize(item.name.trim());
          const normalizedUnit = normalizeUnit(item.unit);
          const existingIdx = newList.findIndex(
            (e) =>
              normalize(e.name.trim()) === normalizedName &&
              normalizeUnit(e.unit) === normalizedUnit &&
              !e.checked,
          );
          if (existingIdx >= 0) {
            newList[existingIdx] = {
              ...newList[existingIdx],
              quantity: newList[existingIdx].quantity + item.quantity,
            };
          } else {
            newList.push({
              ...item,
              id: uuidv4(),
              addedAt: new Date().toISOString(),
              checked: false,
            });
          }
        }
        return { ...current, personalList: newList };
      });
    },
    [saveData],
  );

  const addFromParsed = useCallback(
    async (parsed: ParsedProduct[]) => {
      const items = parsed.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        rayonId: p.rayonId,
      }));
      await addItems(items);
    },
    [addItems],
  );

  const toggleItem = useCallback(
    async (id: string) => {
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((item: ListItem) =>
          item.id === id
            ? {
                ...item,
                checked: !item.checked,
                checkedAt: !item.checked ? new Date().toISOString() : undefined,
              }
            : item,
        ),
      }));
    },
    [saveData],
  );

  const updateItemQuantity = useCallback(
    async (id: string, quantity: number, unit: string) => {
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((item: ListItem) =>
          item.id === id ? { ...item, quantity, unit } : item,
        ),
      }));
    },
    [saveData],
  );

  const updateEssentialQuantity = useCallback(
    async (id: string, quantity: number, unit: string) => {
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, quantity, unit } : e,
        ),
      }));
    },
    [saveData],
  );

  const updateEssentialRayon = useCallback(
    async (id: string, rayonId: string) => {
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, rayonId } : e,
        ),
      }));
    },
    [saveData],
  );

  const toggleAllItems = useCallback(
    async (checked: boolean) => {
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((item: ListItem) => ({
          ...item,
          checked,
          checkedAt: checked ? new Date().toISOString() : undefined,
        })),
      }));
    },
    [saveData],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.filter(
          (item: ListItem) => item.id !== id,
        ),
      }));
    },
    [saveData],
  );

  const updateRayons = useCallback(
    async (newRayons: Rayon[]) => {
      if (!config) return;
      setIsSaving(true);
      setSyncStatus("saving");
      try {
        await saveRayons(config, newRayons);
        setRayons(newRayons);
        setSyncStatus("synced");
        setLastSyncAt(new Date());
      } catch (err) {
        setSyncStatus("error");
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Impossible de sauvegarder les rayons : ${msg}`);
      } finally {
        setIsSaving(false);
      }
    },
    [config],
  );

  const clearChecked = useCallback(async () => {
    await saveData((current) => ({
      ...current,
      personalList: current.personalList.filter(
        (item: ListItem) => !item.checked,
      ),
    }));
  }, [saveData]);

  const migrateData = useCallback(async (): Promise<{
    addedEssentials: number;
  }> => {
    if (!config) throw new Error("Non authentifié");

    // Merge essentials via saveData — uses shaRef.current, no SHA conflict possible
    let addedCount = 0;
    await saveData((current) => {
      const existingIds = new Set(current.essentials.map((e) => e.id));
      const newItems = (templateListsJson.essentials as EssentialItem[]).filter(
        (e) => !existingIds.has(e.id),
      );
      addedCount = newItems.length;
      return {
        ...current,
        essentials: [...current.essentials, ...newItems],
      };
    });

    // Replace rayons — updateRayons does its own GET for the SHA
    await updateRayons(templateRayonsJson as Rayon[]);

    return { addedEssentials: addedCount };
  }, [config, saveData, updateRayons]);

  return {
    data,
    rayons,
    catalog,
    isLoading,
    isSaving,
    syncStatus,
    lastSyncAt,
    error,
    toggleEssential,
    resetEssentials,
    addEssential,
    removeEssential,
    updateEssentialQuantity,
    updateEssentialRayon,
    reorderEssential,
    updateRayons,
    addItems,
    addFromParsed,
    toggleItem,
    updateItemQuantity,
    toggleAllItems,
    removeItem,
    clearChecked,
    migrateData,
  };
}
