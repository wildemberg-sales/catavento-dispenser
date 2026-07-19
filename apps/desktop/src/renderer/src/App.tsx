import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./screens/LoginScreen";
import { AppShell } from "./layout/AppShell";
import { ImportsListScreen } from "./screens/imports/ImportsListScreen";
import { ImportWizard } from "./screens/imports/ImportWizard";
import { ImportDetailScreen } from "./screens/imports/ImportDetailScreen";
import { QueueManagementScreen } from "./screens/queue/QueueManagementScreen";
import { ProductsListScreen } from "./screens/products/ProductsListScreen";
import { ProductForm } from "./screens/products/ProductForm";
import { ReconciliationScreen } from "./screens/reconciliation/ReconciliationScreen";
import { MonitorScreen } from "./screens/monitor/MonitorScreen";
import { ReportsScreen } from "./screens/reports/ReportsScreen";
import { UsersListScreen } from "./screens/users/UsersListScreen";
import { UserForm } from "./screens/users/UserForm";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function App() {
  return (
    <AuthProvider baseUrl={API_URL}>
      <HashRouter>
        <RootRoutes />
      </HashRouter>
    </AuthProvider>
  );
}

function RootRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p data-testid="app-loading">Carregando...</p>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/imports" replace />} />
        <Route path="imports" element={<ImportsListScreen />} />
        <Route path="imports/new" element={<ImportWizard />} />
        <Route path="imports/:batchId" element={<ImportDetailScreen />} />
        <Route path="queue" element={<QueueManagementScreen />} />
        <Route path="products" element={<ProductsListScreen />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:productId/edit" element={<ProductForm />} />
        <Route path="reconciliation" element={<ReconciliationScreen />} />
        <Route path="monitor" element={<MonitorScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="users" element={<UsersListScreen />} />
        <Route path="users/new" element={<UserForm />} />
        <Route path="*" element={<Navigate to="/imports" replace />} />
      </Route>
    </Routes>
  );
}
