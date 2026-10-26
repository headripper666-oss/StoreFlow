import { useCallback, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { AppShell } from "./components/layout/AppShell";
import { AppShellDesktop } from "./components/layout/AppShellDesktop";
import { ListOverviewPane } from "./components/desktop/ListOverviewPane";
import { RecipeDetailPanel } from "./components/desktop/RecipeDetailPanel";
import { useAuth } from "./hooks/useAuth";
import { useRecipeHistory } from "./hooks/useRecipeHistory";
import { useRecipes } from "./hooks/useRecipes";
import { useShoppingList } from "./hooks/useShoppingList";
import { AddItemsPage } from "./pages/AddItemsPage";
import { EssentialsPage } from "./pages/EssentialsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ListPage } from "./pages/ListPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
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
    undoCount,
    undo,
    toggleEssential,
    resetEssentials,
    addEssential,
    removeEssential,
    updateEssentialQuantity,
    updateEssentialComment,
    updateEssentialRayon,
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
    migrateData,
    updateCatalogProductRayon,
    updateCatalogProductPrice,
    updateCatalogProductUnit,
    updateListItemRayon,
    updateListItemPrice,
    updateListItemUnit,
    updateEssentialPrice,
    updateEssentialUnit,
  } = useShoppingList(config);

  const { recordUsage } = useRecipeHistory(config);

  const updateItemQuantityWithRayon = async (
    id: string,
    quantity: number,
    unit: string,
    price: number | undefined,
    rayonId?: string,
    extras?: { name?: string; comment: string },
  ) => {
    await updateItemQuantity(id, quantity, unit, price, extras);
    if (rayonId) await updateListItemRayon(id, rayonId);
  };

  const {
    recipes,
    isSaving: isSavingRecipes,
    error: recipesError,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    renameTag,
    deleteTag,
    updateRecipeIngredientRayon,
    updateRecipeIngredientPrice,
    updateRecipeIngredientCalories,
    updateRecipeIngredientUnit,
  } = useRecipes(config);

  const combinedError = error || recipesError;

  const [desktopSelectedRecipe, setDesktopSelectedRecipe] =
    useState<Recipe | null>(null);
  const [desktopEditingRecipe, setDesktopEditingRecipe] =
    useState<Recipe | null>(null);

  const handleDesktopEdit = useCallback((recipe: Recipe) => {
    setDesktopEditingRecipe(recipe);
    setDesktopSelectedRecipe(null);
  }, []);

  const handleDesktopEditConfirm = useCallback(
    async (recipe: Recipe) => {
      if (!desktopEditingRecipe) return;
      try {
        await updateRecipe({
          ...recipe,
          id: desktopEditingRecipe.id,
          createdAt: desktopEditingRecipe.createdAt,
        });
        setDesktopEditingRecipe(null);
      } catch {
        // Error handled by hook
      }
    },
    [desktopEditingRecipe, updateRecipe],
  );

  const handleDesktopEditCancel = useCallback(() => {
    setDesktopEditingRecipe(null);
  }, []);

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
          pricePerUnit: ing.pricePerUnit,
        })),
      );
    },
    [addItems],
  );

  const handleSyncIngredientToCatalog = useCallback(
    async (name: string, price?: number, calories?: number) => {
      await Promise.all([
        updateRecipeIngredientPrice(name, price),
        updateRecipeIngredientCalories(name, calories),
      ]);
      const match = catalog.find(
        (p) => p.name.toLowerCase().trim() === name.toLowerCase().trim(),
      );
      if (match) {
        await updateCatalogProductPrice(match.id, price);
      }
    },
    [catalog, updateRecipeIngredientPrice, updateRecipeIngredientCalories, updateCatalogProductPrice],
  );

  const listOverviewPane = (
    <ListOverviewPane
      items={data?.personalList ?? []}
      essentials={data?.essentials ?? []}
      catalog={catalog}
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
                editingRecipe={desktopEditingRecipe}
                rayons={rayons}
                catalog={catalog}
                allTags={allTags}
                isSaving={isSaving || isSavingRecipes}
                onAddToList={handleAddIngredientsToList}
                onUpdateRecipe={updateRecipe}
                onRecordHistory={recordUsage}
                onConfirmEdit={handleDesktopEditConfirm}
                onCancelEdit={handleDesktopEditCancel}
                onUpdateEditingRecipe={setDesktopEditingRecipe}
                onSyncIngredientToCatalog={handleSyncIngredientToCatalog}
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
            catalog={catalog}
            onToggle={toggleEssential}
            onReset={resetEssentials}
            onAdd={addEssential}
            onDelete={removeEssential}
            onUpdateQuantity={updateEssentialQuantity}
            onUpdateRayon={updateEssentialRayon}
            onUpdateComment={updateEssentialComment}
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
            catalog={catalog}
            recipes={recipes}
            onToggle={toggleItem}
            onDelete={removeItem}
            onClearChecked={clearChecked}
            onToggleEssential={toggleEssential}
            onUpdateQuantity={updateItemQuantityWithRayon}
            onUpdateEssentialQuantity={updateEssentialQuantity}
            onToggleAll={toggleAllItems}
            onReorderItem={reorderItem}
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
          <SettingsPage
            rayons={rayons}
            essentials={data?.essentials ?? []}
            listItems={data?.personalList ?? []}
            isSaving={isSaving}
            onSaveRayons={updateRayons}
            recipes={recipes}
            isSavingRecipes={isSavingRecipes}
            onRenameTag={renameTag}
            onDeleteTag={deleteTag}
            personalList={data?.personalList ?? []}
            catalog={catalog}
            onUpdateEssentialRayon={updateEssentialRayon}
            onUpdateRecipeIngredientRayon={updateRecipeIngredientRayon}
            onUpdateListItemRayon={updateListItemRayon}
            onUpdateCatalogProductRayon={updateCatalogProductRayon}
            onUpdateEssentialPrice={updateEssentialPrice}
            onUpdateListItemPrice={updateListItemPrice}
            onUpdateCatalogProductPrice={updateCatalogProductPrice}
            onUpdateRecipeIngredientPrice={updateRecipeIngredientPrice}
            onUpdateRecipeIngredientCalories={updateRecipeIngredientCalories}
            onUpdateEssentialUnit={updateEssentialUnit}
            onUpdateListItemUnit={updateListItemUnit}
            onUpdateCatalogProductUnit={updateCatalogProductUnit}
            onUpdateRecipeIngredientUnit={updateRecipeIngredientUnit}
            onUpdateRecipe={updateRecipe}
          />
        }
      />
      <Route
        path="/recipes"
        element={
          <RecipesPage
            recipes={recipes}
            rayons={rayons}
            essentials={data?.essentials ?? []}
            catalog={catalog}
            isSavingList={isSaving}
            isSavingRecipes={isSavingRecipes}
            onAddToList={handleAddIngredientsToList}
            onSaveRecipe={saveRecipe}
            onUpdateRecipe={updateRecipe}
            onDeleteRecipe={deleteRecipe}
            onRecordHistory={recordUsage}
            onDesktopSelect={isDesktop ? setDesktopSelectedRecipe : undefined}
            onDesktopEdit={isDesktop ? handleDesktopEdit : undefined}
          />
        }
      />
      <Route
        path="/history"
        element={
          <HistoryPage
            config={config}
            rayons={rayons}
            onAddToList={handleAddIngredientsToList}
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
        error={combinedError}
        undoCount={undoCount}
        onUndo={undo}
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
      error={combinedError}
      undoCount={undoCount}
      onUndo={undo}
      onLogout={logout}
    >
      {routes}
    </AppShell>
  );
}
