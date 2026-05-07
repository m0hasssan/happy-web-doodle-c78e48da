import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
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
import WorkOrdersPage from "@/pages/work-orders"
import WorkOrderDetailPage from "@/pages/work-order-detail"

export function App() {
  return (
    <HashRouter>
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
            <Route path="/control-panel" element={<ProtectedRoute requires="view_control_panel"><ControlPanelPage /></ProtectedRoute>} />
            <Route path="/users-permissions" element={<ProtectedRoute requires="view_users"><UsersPermissionsPage /></ProtectedRoute>} />
            <Route path="/vaults" element={<ProtectedRoute requires="view_vaults"><VaultsPage /></ProtectedRoute>} />
            <Route path="/vaults/:vaultId" element={<ProtectedRoute requires="view_vaults"><VaultDetailPage /></ProtectedRoute>} />
            <Route path="/sections" element={<ProtectedRoute requires="view_sections"><SectionsPage /></ProtectedRoute>} />
            <Route path="/sections/:sectionId" element={<ProtectedRoute requires="view_sections"><SectionDetailPage /></ProtectedRoute>} />
            <Route path="/movements" element={<ProtectedRoute requires="view_movements"><MovementsPage /></ProtectedRoute>} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="/shifts" element={<ProtectedRoute requires="view_shifts_history"><ShiftsPage /></ProtectedRoute>} />
            <Route path="/shifts/:shiftId" element={<ProtectedRoute requires="view_shift_details"><ShiftDetailPage /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute requires="view_suppliers"><SuppliersPage /></ProtectedRoute>} />
            <Route path="/suppliers/:supplierId" element={<ProtectedRoute requires="view_suppliers"><SupplierDetailPage /></ProtectedRoute>} />
            <Route path="/system-settings" element={<SystemSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </PermissionsProvider>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
