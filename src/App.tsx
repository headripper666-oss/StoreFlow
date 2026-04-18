import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./hooks/useAuth";
import { useShoppingList } from "./hooks/useShoppingList";
import { AddItemsPage } from "./pages/AddItemsPage";
import { EssentialsPage } from "./pages/EssentialsPage";
import { ListPage } from "./pages/ListPage";
import { LoginPage } from "./pages/LoginPage";
import { RayonSettingsPage } from "./pages/RayonSettingsPage";

export default function App() {
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
    updateRayons,
    addItems,
    addFromParsed,
    toggleItem,
    removeItem,
    clearChecked,
  } = useShoppingList(config);

  if (!isAuthenticated) {
    return (
      <LoginPage onLogin={login} isLoading={authLoading} error={authError} />
    );
  }

  return (
    <AppShell
      syncStatus={syncStatus}
      lastSyncAt={lastSyncAt}
      error={error}
      onLogout={logout}
    >
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
        <Route path="*" element={<Navigate to="/essentials" replace />} />
      </Routes>
    </AppShell>
  );
}
