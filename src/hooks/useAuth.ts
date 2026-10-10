import { useCallback, useEffect, useState } from "react";
import type { AuthConfig } from "../types";
import {
  clearAuthConfig,
  loadAuthConfig,
  saveAuthConfig,
} from "../services/storage";
import { fetchShoppingData, initDataRepo } from "../services/github";
import { initApiServer, resetServerCheck } from "../services/api";

interface UseAuthReturn {
  config: AuthConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (pat: string, owner: string, repo: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount — attend que le serveur local soit prêt avant de déclencher les hooks
  useEffect(() => {
    const saved = loadAuthConfig();
    if (!saved) return;
    initApiServer(saved)
      .catch(() => {})
      .finally(() => setConfig(saved));
  }, []);

  const login = useCallback(
    async (pat: string, owner: string, repo: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      const cfg: AuthConfig = { pat, dataOwner: owner, dataRepo: repo };

      try {
        await fetchShoppingData(cfg);
        initDataRepo(cfg).catch(() => {});
        await initApiServer(cfg).catch(() => {}); // attend que la DB soit peuplée avant de charger les hooks
        saveAuthConfig(cfg);
        setConfig(cfg);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "AUTH_ERROR") {
          setError(
            "Token invalide ou accès refusé. Vérifiez votre Personal Access Token.",
          );
        } else if (msg === "NOT_MODIFIED") {
          saveAuthConfig(cfg);
          setConfig(cfg);
          return true;
        } else if (msg === "GitHub API error: 404") {
          // lists.json doesn't exist yet on a fresh repo — initialize then retry
          try {
            await initDataRepo(cfg);
            await fetchShoppingData(cfg);
            await initApiServer(cfg).catch(() => {});
            saveAuthConfig(cfg);
            setConfig(cfg);
            return true;
          } catch {
            setError(
              "Impossible d'initialiser le dépôt de données. Vérifiez les permissions du token.",
            );
          }
        } else {
          setError(`Impossible de se connecter : ${msg}`);
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuthConfig();
    resetServerCheck();
    setConfig(null);
    setError(null);
  }, []);

  return {
    config,
    isAuthenticated: config !== null,
    isLoading,
    error,
    login,
    logout,
  };
}
