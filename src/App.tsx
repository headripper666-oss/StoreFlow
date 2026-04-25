import { useCallback, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { AppShell } from "./components/layout/AppShell";
import { AppShellDesktop } from "./components/layout/AppShellDesktop";
import { ListOverviewPane } from "./components/desktop/ListOverviewPane";
import { RecipeDetailPanel } from "./components/desktop/RecipeDetailPanel";
import { useAuth } from "./hooks/useAuth";
import { useRecipes } from "./hooks/useRecipes";
import { useShoppingList } from "./hooks/useShoppingList";
import { AddItemsPage } from "./pages/AddItemsPage";
import { EssentialsPage } from "./pages/EssentialsPage";
import { ListPage } from "./pages/ListPage";
import { LoginPage } from "./pages/LoginPage";
import { RayonSettingsPage } from "./pages/RayonSettingsPage";
import { RecipesPage } from "./pages/RecipesPage";
import type { Recipe, RecipeIngredient } from "./types";
import { DEFAULT_TAGS } from "./utils/recipeUtils";

export default function App() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const location = useLocation();

  const {
    config,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    login,
    logout,
  } = useAuth();

  const {
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
  } = useShoppingList(config);

  const {
    recipes,
    isSaving: isSavingRecipes,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
  } = useRecipes(config);

  const [desktopSelectedRecipe, setDesktopSelectedRecipe] =
    useState<Recipe | null>(null);

  const allTags = useMemo((): string[] => {
    const tags = new Set<string>(DEFAULT_TAGS);
    recipes.forEach((r) => (r.tags ?? []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [recipes]);

  const handleAddIngredientsToList = useCallback(
    async (ingredients: RecipeIngredient[]) => {
      await addItems(
        ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          rayonId: ing.rayonId,
          productId: undefined,
        })),
      );
    },
    [addItems],
  );

  const listOverviewPane = (
    <ListOverviewPane
      items={data?.personalList ?? []}
      essentials={data?.essentials ?? []}
      rayons={rayons}
      onToggle={toggleItem}
      onDelete={removeItem}
      onToggleEssential={toggleEssential}
      isSaving={isSaving}
    />
  );

  const desktopRightPane: React.ReactNode | null = isDesktop
    ? (() => {
        switch (location.pathname) {
          case "/essentials":
          case "/add":
            return listOverviewPane;
          case "/recipes":
            return (
              <RecipeDetailPanel
                recipe={desktopSelectedRecipe}
                rayons={rayons}
                allTags={allTags}
                isSaving={isSaving || isSavingRecipes}
                onAddToList={handleAddIngredientsToList}
                onUpdateRecipe={updateRecipe}
              />
            );
          default:
            return null;
        }
      })()
    : null;

  const splitStorageKey =
    {
      "/essentials": "storeflow-split-essentials",
      "/add": "storeflow-split-add",
      "/recipes": "storeflow-split-recipes",
    }[location.pathname] ?? "storeflow-split-default";

  if (!isAuthenticated) {
    return (
      <LoginPage onLogin={login} isLoading={authLoading} error={authError} />
    );
  }

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to="/essentials" replace />} />
      <Route
        path="/essentials"
        element={
          <EssentialsPage
            essentials={data?.essentials ?? []}
            rayons={rayons}
            onToggle={toggleEssential}
            onReset={resetEssentials}
            onAdd={addEssential}
            onDelete={removeEssential}
            onUpdateQuantity={updateEssentialQuantity}
            onUpdateRayon={updateEssentialRayon}
            onReorder={reorderEssential}
            onMigrate={migrateData}
            isLoading={isLoading}
            isSaving={isSaving}
          />
        }
      />
      <Route
        path="/list"
        element={
          <ListPage
            items={data?.personalList ?? []}
            essentials={data?.essentials ?? []}
            rayons={rayons}
            onToggle={toggleItem}
            onDelete={removeItem}
            onClearChecked={clearChecked}
            onToggleEssential={toggleEssential}
            onUpdateQuantity={updateItemQuantity}
            onUpdateEssentialQuantity={updateEssentialQuantity}
            onToggleAll={toggleAllItems}
            isLoading={isLoading}
            isSaving={isSaving}
          />
        }
      />
      <Route
        path="/add"
        element={
          <AddItemsPage
            rayons={rayons}
            catalog={catalog}
            onAdd={addItems}
            onAddFromParsed={addFromParsed}
            isSaving={isSaving}
          />
        }
      />
      <Route
        path="/rayons"
        element={
          <RayonSettingsPage
            rayons={rayons}
            essentials={data?.essentials ?? []}
            listItems={data?.personalList ?? []}
            onSave={updateRayons}
            isSaving={isSaving}
          />
        }
      />
      <Route
        path="/recipes"
        element={
          <RecipesPage
            recipes={recipes}
            rayons={rayons}
            isSavingList={isSaving}
            isSavingRecipes={isSavingRecipes}
            onAddToList={handleAddIngredientsToList}
            onSaveRecipe={saveRecipe}
            onUpdateRecipe={updateRecipe}
            onDeleteRecipe={deleteRecipe}
            onDesktopSelect={isDesktop ? setDesktopSelectedRecipe : undefined}
          />
        }
      />
      <Route path="*" element={<Navigate to="/essentials" replace />} />
    </Routes>
  );

  if (isDesktop) {
    return (
      <AppShellDesktop
        syncStatus={syncStatus}
        lastSyncAt={lastSyncAt}
        error={error}
        onLogout={logout}
        rightPane={desktopRightPane}
        splitStorageKey={splitStorageKey}
      >
        {routes}
      </AppShellDesktop>
    );
  }

  return (
    <AppShell
      syncStatus={syncStatus}
      lastSyncAt={lastSyncAt}
      error={error}
      onLogout={logout}
    >
      {routes}
    </AppShell>
  );
}
