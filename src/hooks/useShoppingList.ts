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
  saveCatalog,
  saveRayons,
  saveShoppingData,
  toggleShoppingItem,
  toggleEssentialItem,
  connectWebSocket,
  isWebSocketConnected,
} from "../services/api";
import { capitalize, normalize, normalizeUnit } from "../utils/recipeUtils";
import templateListsJson from "../../data-init/lists.json";
import templateRayonsJson from "../../data-init/rayons.json";
import {
  cacheData,
  getCachedData,
  getItemOrderMap,
  loadSHA,
  saveETag,
  saveSHA,
  setItemOrderMap,
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
  toggleEssential: (id: string) => void;
  resetEssentials: () => Promise<void>;
  addEssential: (name: string, rayonId: string) => Promise<void>;
  removeEssential: (id: string) => Promise<void>;
  updateEssentialQuantity: (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    extras?: { comment: string },
  ) => Promise<void>;
  updateEssentialComment: (id: string, comment: string) => Promise<void>;
  updateEssentialRayon: (id: string, rayonId: string) => Promise<void>;
  reorderEssential: (id: string, direction: -1 | 1) => Promise<void>;
  reorderItem: (id: string, direction: -1 | 1) => Promise<void>;
  updateRayons: (rayons: Rayon[]) => Promise<void>;
  updateCatalogProductRayon: (id: string, rayonId: string) => Promise<void>;
  updateCatalogProductPrice: (id: string, price: number | undefined) => Promise<void>;
  updateCatalogProductUnit: (id: string, unit: string) => Promise<void>;
  updateListItemRayon: (id: string, rayonId: string) => Promise<void>;
  updateListItemPrice: (id: string, price: number | undefined) => Promise<void>;
  updateListItemUnit: (id: string, unit: string) => Promise<void>;
  updateEssentialPrice: (id: string, price: number | undefined) => Promise<void>;
  updateEssentialUnit: (id: string, unit: string) => Promise<void>;
  addItems: (
    items: Omit<ListItem, "id" | "addedAt" | "checked">[],
  ) => Promise<void>;
  addFromParsed: (parsed: ParsedProduct[]) => Promise<void>;
  toggleItem: (id: string) => void;
  updateItemQuantity: (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    extras?: { name?: string; comment: string },
  ) => Promise<void>;
  toggleAllItems: (checked: boolean) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearChecked: () => Promise<void>;
  migrateData: () => Promise<{ addedEssentials: number }>;
  undoCount: number;
  undo: () => Promise<void>;
}

// Preserves positions of historical items not in the current reordered set
function mergeOrderMap(existingNames: string[], newOrderNames: string[]): string[] {
  if (newOrderNames.length === 0) return existingNames;
  const existingIndices: number[] = [];
  const notInMap: string[] = [];
  for (const name of newOrderNames) {
    const idx = existingNames.indexOf(name);
    if (idx >= 0) existingIndices.push(idx);
    else notInMap.push(name);
  }
  existingIndices.sort((a, b) => a - b);
  const result = [...existingNames, ...notInMap];
  existingIndices.forEach((pos, i) => { result[pos] = newOrderNames[i]; });
  return result;
}

const UNDO_LIMIT = 10;

function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}

export function useShoppingList(
  config: AuthConfig | null,
): UseShoppingListReturn {
  const [data, setDataState] = useState<ShoppingData | null>(null);
  const setData = useCallback((next: ShoppingData | null) => {
    dataRef.current = next;
    setDataState(next);
  }, []);
  const [rayons, setRayons] = useState<Rayon[]>(DEFAULT_RAYONS);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shaRef = useRef<string | null>(null);
  const catalogShaRef = useRef<string>("");
  const dirtyRef = useRef(false);
  const capitalizeRanRef = useRef(false);
  const pendingDataRef = useRef<ShoppingData | null>(null);
  const configRef = useRef(config);
  const dataRef = useRef<ShoppingData | null>(null);
  // Annulation : copies de la liste avant chaque action (10 max, en mémoire seulement)
  const undoStackRef = useRef<ShoppingData[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const pushUndo = useCallback((snapshot: ShoppingData) => {
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-UNDO_LIMIT);
    setUndoCount(undoStackRef.current.length);
  }, []);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdaterRef = useRef<((d: ShoppingData) => ShoppingData) | null>(null);
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

      const [fetchedRayons, fetchedCatalogResult] = await Promise.all([
        fetchRayons(config),
        fetchCatalog(config),
      ]);
      setRayons(fetchedRayons);
      setCatalog(fetchedCatalogResult.products);
      catalogShaRef.current = fetchedCatalogResult.sha;

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

    // WebSocket : recharge les données quand un autre device fait une mutation
    const disconnectWs = connectWebSocket((table) => {
      if (table === "lists" || table === "all") {
        fetchShoppingData(config).then((state) => {
          setData(state.content);
          shaRef.current = state.sha;
          cacheData(state.content);
          setSyncStatus("synced");
          setLastSyncAt(new Date());
        }).catch(() => {});
      }
      if (table === "catalog" || table === "all") {
        fetchCatalog(config).then(({ products, sha }) => {
          setCatalog(products);
          catalogShaRef.current = sha;
        }).catch(() => {});
      }
      if (table === "rayons" || table === "all") {
        fetchRayons(config).then(setRayons).catch(() => {});
      }
    });

    return disconnectWs;
  }, [config]);

  // One-time migration: capitalize all article names
  useEffect(() => {
    const CAP_KEY = "storeflow_capitalize_v1";
    if (!data || !config || isLoading || capitalizeRanRef.current || localStorage.getItem(CAP_KEY)) return;
    capitalizeRanRef.current = true;

    const runMigration = async () => {
      await saveData((cur) => ({
        ...cur,
        essentials: cur.essentials.map((e) => ({ ...e, name: capitalize(e.name) })),
        personalList: cur.personalList.map((i) => ({ ...i, name: capitalize(i.name) })),
      }), { undoable: false });
      if (catalog.length > 0) {
        const capCatalog = catalog.map((p) => ({
          ...p,
          name: capitalize(p.name),
          aliases: (p.aliases ?? []).map(capitalize),
        }));
        try {
          const newSha = await saveCatalog(config, capCatalog, catalogShaRef.current);
          catalogShaRef.current = newSha;
          setCatalog(capCatalog);
        } catch { /* non-blocking */ }
      }
      localStorage.setItem(CAP_KEY, "1");
    };

    runMigration().catch(() => { capitalizeRanRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, !!config, isLoading]);

  // Poll for remote changes every 30 seconds
  const pollCallback = useCallback(async () => {
    if (!config || isSaving || isWebSocketConnected()) return;

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

  // Generic save helper with optimistic update.
  // Reads dataRef.current (not closure `data`) so it stays stable across renders
  // and always sees the latest state even after rapid successive calls.
  const saveData = useCallback(
    async (
      updater: (current: ShoppingData) => ShoppingData,
      opts?: { undoable?: boolean },
    ): Promise<void> => {
      const cfg = configRef.current;
      const current = dataRef.current;
      if (!cfg || !current || !shaRef.current) return;

      const undoable = opts?.undoable !== false;
      if (undoable) pushUndo(current);
      const prevData = current;
      const prevSha = shaRef.current;
      const updated = updater(current);

      // Optimistic update — UI reflects change immediately
      setData(updated);
      setIsSaving(true);
      setSyncStatus("saving");

      try {
        const newSha = await saveShoppingData(cfg, updated, shaRef.current);
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
          if (undoable) {
            undoStackRef.current = undoStackRef.current.slice(0, -1);
            setUndoCount(undoStackRef.current.length);
          }
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
    [pushUndo],
  );

  // Debounced variant: applies the optimistic update immediately but batches
  // the network save — useful for rapid toggles (check/uncheck items).
  const saveDataDebounced = useCallback(
    (updater: (current: ShoppingData) => ShoppingData): void => {
      const current = dataRef.current;
      if (!current) return;

      // Apply optimistic update immediately for instant UI feedback
      const updated = updater(current);
      setData(updated);
      setSyncStatus("saving");

      // Compose pending updaters so rapid calls accumulate into one save
      const previousUpdater = pendingUpdaterRef.current;
      pendingUpdaterRef.current = previousUpdater
        ? (d: ShoppingData) => updater(previousUpdater(d))
        : updater;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const composedUpdater = pendingUpdaterRef.current;
        pendingUpdaterRef.current = null;
        debounceTimerRef.current = null;
        if (composedUpdater) saveData(composedUpdater, { undoable: false });
      }, 300);
    },
    [saveData],
  );

  const undo = useCallback(async () => {
    const snapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (!snapshot) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoCount(undoStackRef.current.length);
    await saveData(() => snapshot, { undoable: false });
  }, [saveData]);

  const toggleEssential = useCallback(
    (id: string): void => {
      // Optimistic update immediately
      const current = dataRef.current;
      if (!current) return;
      pushUndo(current);
      const updated = {
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, checked: !e.checked, ...(e.checked && { comment: undefined }) } : e,
        ),
      };
      setData(updated);
      setSyncStatus("saving");

      // Try atomic PATCH first; fall back to full PUT if unavailable
      toggleEssentialItem(id).then((patched) => {
        if (patched) {
          setSyncStatus("synced");
          setLastSyncAt(new Date());
          cacheData(updated);
        } else {
          // Fallback: full save via debounced PUT
          saveDataDebounced((d) => ({
            ...d,
            essentials: d.essentials.map((e: EssentialItem) =>
              e.id === id ? { ...e, checked: !e.checked, ...(e.checked && { comment: undefined }) } : e,
            ),
          }));
        }
      });
    },
    [saveDataDebounced, pushUndo],
  );

  const resetEssentials = useCallback(async () => {
    await saveData((current) => ({
      ...current,
      essentials: current.essentials.map((e: EssentialItem) => ({
        ...e,
        checked: false,
        comment: undefined,
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
            { id: uuidv4(), name: capitalize(name.trim()), rayonId, checked: false, order: maxOrder + 1 },
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

  const reorderItem = useCallback(
    async (id: string, direction: -1 | 1) => {
      await saveData((current) => {
        const item = current.personalList.find((e) => e.id === id);
        if (!item) return current;
        const rayonUnchecked = current.personalList
          .filter((e) => e.rayonId === item.rayonId && !e.checked)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((e, i) => ({ ...e, order: i + 1 }));
        const idx = rayonUnchecked.findIndex((e) => e.id === id);
        const next = idx + direction;
        if (next < 0 || next >= rayonUnchecked.length) return current;
        [rayonUnchecked[idx], rayonUnchecked[next]] = [rayonUnchecked[next], rayonUnchecked[idx]];
        const reordered = rayonUnchecked.map((e, i) => ({ ...e, order: i + 1 }));
        const newOrderNames = reordered.map((e) => normalize(e.name.trim()));
        const orderMap = getItemOrderMap();
        orderMap[item.rayonId] = mergeOrderMap(orderMap[item.rayonId] ?? [], newOrderNames);
        setItemOrderMap(orderMap);
        const reorderedMap = new Map(reordered.map((e) => [e.id, e]));
        return {
          ...current,
          personalList: current.personalList.map((e) => reorderedMap.get(e.id) ?? e),
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

  const updateCatalogProductUnit = useCallback(
    async (id: string, defaultUnit: string) => {
      if (!config) return;
      const updated = catalog.map((p) => (p.id === id ? { ...p, defaultUnit } : p));
      setCatalog(updated);
      setIsSaving(true);
      setSyncStatus("saving");
      try {
        const newSha = await saveCatalog(config, updated, catalogShaRef.current);
        catalogShaRef.current = newSha;
        setSyncStatus("synced");
        setLastSyncAt(new Date());
      } catch (err) {
        setCatalog(catalog);
        setSyncStatus("error");
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Erreur catalogue : ${msg}`);
      } finally {
        setIsSaving(false);
      }
    },
    [config, catalog],
  );

  const updateEssentialUnit = useCallback(
    async (id: string, unit: string) => {
      const item = dataRef.current?.essentials.find((e) => e.id === id);
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, unit } : e,
        ),
      }));
      // Cascade: update matching catalog product
      if (item) {
        const normalizedName = normalize(item.name.trim());
        const catalogMatch = catalog.find(
          (p) => normalize(p.name.trim()) === normalizedName,
        );
        if (catalogMatch) {
          await updateCatalogProductUnit(catalogMatch.id, unit);
        }
      }
    },
    [saveData, catalog, updateCatalogProductUnit],
  );

  const updateCatalogProductPrice = useCallback(
    async (id: string, pricePerUnit: number | undefined) => {
      if (!config) return;
      const updated = catalog.map((p) => (p.id === id ? { ...p, pricePerUnit } : p));
      setCatalog(updated);
      setIsSaving(true);
      setSyncStatus("saving");
      try {
        const newSha = await saveCatalog(config, updated, catalogShaRef.current);
        catalogShaRef.current = newSha;
        setSyncStatus("synced");
        setLastSyncAt(new Date());
      } catch (err) {
        setCatalog(catalog);
        setSyncStatus("error");
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Erreur catalogue : ${msg}`);
      } finally {
        setIsSaving(false);
      }
    },
    [config, catalog],
  );

  const updateEssentialPrice = useCallback(
    async (id: string, pricePerUnit: number | undefined) => {
      const item = dataRef.current?.essentials.find((e) => e.id === id);
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, pricePerUnit } : e,
        ),
      }));
      // Cascade: update matching catalog product
      if (item) {
        const normalizedName = normalize(item.name.trim());
        const catalogMatch = catalog.find(
          (p) => normalize(p.name.trim()) === normalizedName,
        );
        if (catalogMatch) {
          await updateCatalogProductPrice(catalogMatch.id, pricePerUnit);
        }
      }
    },
    [saveData, catalog, updateCatalogProductPrice],
  );

  const addItems = useCallback(
    async (items: Omit<ListItem, "id" | "addedAt" | "checked">[]) => {
      await saveData((current) => {
        const orderMap = getItemOrderMap();
        let mapDirty = false;
        const newList = [...current.personalList];
        for (const item of items) {
          const normalizedName = normalize(capitalize(item.name.trim()));
          const normalizedUnit = normalizeUnit(item.unit);
          const existingIdx = newList.findIndex(
            (e) =>
              normalize(e.name.trim()) === normalizedName &&
              normalizeUnit(e.unit) === normalizedUnit &&
              !e.checked,
          );
          if (existingIdx >= 0) {
            const existing = newList[existingIdx];
            if (!existing.pricePerUnit) {
              const catalogMatch = catalog.find(p => normalize(p.name.trim()) === normalizedName);
              const essentialMatch = current.essentials.find(e => normalize(e.name.trim()) === normalizedName);
              const pricePerUnit = item.pricePerUnit ?? catalogMatch?.pricePerUnit ?? essentialMatch?.pricePerUnit;
              newList[existingIdx] = { ...existing, quantity: existing.quantity + item.quantity, ...(pricePerUnit ? { pricePerUnit } : {}) };
            } else {
              newList[existingIdx] = { ...existing, quantity: existing.quantity + item.quantity };
            }
          } else {
            const rayonNames = orderMap[item.rayonId] ?? [];
            const nameIdx = rayonNames.indexOf(normalizedName);
            let order: number;
            if (nameIdx >= 0) {
              order = nameIdx + 1;
            } else {
              order = rayonNames.length + 1;
              orderMap[item.rayonId] = [...rayonNames, normalizedName];
              mapDirty = true;
            }

            // Look up price in catalog or essentials
            const catalogMatch = catalog.find(p => normalize(p.name.trim()) === normalizedName);
            const essentialMatch = current.essentials.find(e => normalize(e.name) === normalizedName);
            const pricePerUnit = item.pricePerUnit ?? catalogMatch?.pricePerUnit ?? essentialMatch?.pricePerUnit;

            newList.push({
              ...item,
              name: capitalize(item.name.trim()),
              id: uuidv4(),
              addedAt: new Date().toISOString(),
              checked: false,
              order,
              pricePerUnit,
            });
          }
        }
        if (mapDirty) setItemOrderMap(orderMap);
        return { ...current, personalList: newList };
      });
    },
    [saveData, catalog],
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
    (id: string): void => {
      // Optimistic update immediately
      const current = dataRef.current;
      if (!current) return;
      pushUndo(current);
      const updated = {
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
      };
      setData(updated);
      setSyncStatus("saving");

      // Try atomic PATCH first; fall back to full PUT if unavailable
      toggleShoppingItem(id).then((patched) => {
        if (patched) {
          setSyncStatus("synced");
          setLastSyncAt(new Date());
          cacheData(updated);
        } else {
          // Fallback: full save via debounced PUT
          saveDataDebounced((d) => ({
            ...d,
            personalList: d.personalList.map((item: ListItem) =>
              item.id === id
                ? {
                    ...item,
                    checked: !item.checked,
                    checkedAt: !item.checked ? new Date().toISOString() : undefined,
                  }
                : item,
            ),
          }));
        }
      });
    },
    [saveDataDebounced, pushUndo],
  );

  const updateItemQuantity = useCallback(
    async (
      id: string,
      quantity: number,
      unit: string,
      price: number | undefined,
      extras?: { name?: string; comment: string },
    ) => {
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((item: ListItem) =>
          item.id === id
            ? {
                ...item,
                quantity,
                unit,
                pricePerUnit: price,
                ...(extras && {
                  name: extras.name ? capitalize(extras.name) : item.name,
                  comment: extras.comment || undefined,
                }),
              }
            : item,
        ),
      }));
    },
    [saveData],
  );

  const updateEssentialQuantity = useCallback(
    async (id: string, quantity: number, unit: string, price: number | undefined, extras?: { comment: string }) => {
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id
            ? { ...e, quantity, unit, pricePerUnit: price, ...(extras && { comment: extras.comment || undefined }) }
            : e,
        ),
      }));
    },
    [saveData],
  );

  const updateEssentialComment = useCallback(
    async (id: string, comment: string) => {
      await saveData((current) => ({
        ...current,
        essentials: current.essentials.map((e: EssentialItem) =>
          e.id === id ? { ...e, comment: comment.trim() || undefined } : e,
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

  const updateCatalogProductRayon = useCallback(
    async (id: string, rayonId: string) => {
      if (!config) return;
      const updated = catalog.map((p) => (p.id === id ? { ...p, rayonId } : p));
      setCatalog(updated);
      setIsSaving(true);
      setSyncStatus("saving");
      try {
        const newSha = await saveCatalog(config, updated, catalogShaRef.current);
        catalogShaRef.current = newSha;
        setSyncStatus("synced");
        setLastSyncAt(new Date());
      } catch (err) {
        setCatalog(catalog);
        setSyncStatus("error");
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Erreur catalogue : ${msg}`);
      } finally {
        setIsSaving(false);
      }
    },
    [config, catalog],
  );

  const updateListItemPrice = useCallback(
    async (id: string, pricePerUnit: number | undefined) => {
      const item = dataRef.current?.personalList.find((i) => i.id === id);
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((i) =>
          i.id === id ? { ...i, pricePerUnit } : i,
        ),
      }));
      // Cascade: update matching catalog product
      if (item) {
        const normalizedName = normalize(item.name.trim());
        const catalogMatch = catalog.find(
          (p) => normalize(p.name.trim()) === normalizedName,
        );
        if (catalogMatch) {
          await updateCatalogProductPrice(catalogMatch.id, pricePerUnit);
        }
      }
    },
    [saveData, catalog, updateCatalogProductPrice],
  );

  const updateListItemUnit = useCallback(
    async (id: string, unit: string) => {
      const item = dataRef.current?.personalList.find((i) => i.id === id);
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((i) =>
          i.id === id ? { ...i, unit } : i,
        ),
      }));
      // Cascade: update matching catalog product
      if (item) {
        const normalizedName = normalize(item.name.trim());
        const catalogMatch = catalog.find(
          (p) => normalize(p.name.trim()) === normalizedName,
        );
        if (catalogMatch) {
          await updateCatalogProductUnit(catalogMatch.id, unit);
        }
      }
    },
    [saveData, catalog, updateCatalogProductUnit],
  );

  const updateListItemRayon = useCallback(
    async (id: string, rayonId: string) => {
      const item = dataRef.current?.personalList.find((i) => i.id === id);
      await saveData((current) => ({
        ...current,
        personalList: current.personalList.map((i) =>
          i.id === id ? { ...i, rayonId } : i,
        ),
      }));
      // Cascade: update matching catalog product
      if (item) {
        const normalizedName = normalize(item.name.trim());
        const catalogMatch = catalog.find(
          (p) => normalize(p.name.trim()) === normalizedName,
        );
        if (catalogMatch) {
          await updateCatalogProductRayon(catalogMatch.id, rayonId);
        }
      }
    },
    [saveData, catalog, updateCatalogProductRayon],
  );

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
    updateEssentialComment,
    updateEssentialRayon,
    updateEssentialPrice,
    updateEssentialUnit,
    reorderEssential,
    reorderItem,
    updateRayons,
    addItems,
    addFromParsed,
    toggleItem,
    updateItemQuantity,
    toggleAllItems,
    removeItem,
    clearChecked,
    updateCatalogProductRayon,
    updateCatalogProductPrice,
    updateCatalogProductUnit,
    updateListItemRayon,
    updateListItemPrice,
    updateListItemUnit,
    migrateData,
    undoCount,
    undo,
  };
}
