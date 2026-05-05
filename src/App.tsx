import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/auth-context"
import { PermissionsProvider } from "@/contexts/permissions-context"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import LoginPage from "@/pages/login"
import DashboardHome from "@/pages/dashboard"
import ControlPanelPage from "@/pages/control-panel"
import ThemePage from "@/pages/theme"
import UsersPermissionsPage from "@/pages/users-permissions"
import VaultsPage from "@/pages/vaults"
import VaultDetailPage from "@/pages/vault-detail"
import SystemSettingsPage from "@/pages/system-settings"
import MovementsPage from "@/pages/movements"
import SuppliersPage from "@/pages/suppliers"
import SupplierDetailPage from "@/pages/supplier-detail"
import SectionsPage from "@/pages/sections"
import SectionDetailPage from "@/pages/section-detail"
import ShiftsPage from "@/pages/shifts"
import ShiftDetailPage from "@/pages/shift-detail"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionsProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/theme" element={<ThemePage />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/control-panel" element={<ControlPanelPage />} />
            <Route path="/users-permissions" element={<UsersPermissionsPage />} />
            <Route path="/vaults" element={<VaultsPage />} />
            <Route path="/vaults/:vaultId" element={<VaultDetailPage />} />
            <Route path="/sections" element={<SectionsPage />} />
            <Route path="/sections/:sectionId" element={<SectionDetailPage />} />
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/shifts/:shiftId" element={<ShiftDetailPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/suppliers/:supplierId" element={<SupplierDetailPage />} />
            <Route path="/system-settings" element={<SystemSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
