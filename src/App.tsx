import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/auth-context"
import { PermissionsProvider } from "@/contexts/permissions-context"
import { ProtectedRoute } from "@/components/protected-route"
import { useNumberFormatSettings } from "@/hooks/use-number-format"
import LoginPage from "@/pages/login"
import ControlPanelPage from "@/pages/control-panel"
import AccountSettingsPage from "@/pages/account-settings"
import AccountSettingsGeneralPage from "@/pages/account-settings-general"
import {
  AccountSettingsDashboardPage,
  AccountSettingsAppearancePage,
  AccountSettingsNotificationsPage,
} from "@/pages/account-settings-placeholder"
import { DashboardLayout } from "@/components/dashboard-layout"
import ThemePage from "@/pages/theme"
import UsersPermissionsPage from "@/pages/users-permissions"
import VaultsPage from "@/pages/vaults"
import VaultDetailPage from "@/pages/vault-detail"
import SystemSettingsPage from "@/pages/system-settings"
import MetalDetailPage from "@/pages/metal-detail"
import MovementsPage from "@/pages/movements"
import SuppliersPage from "@/pages/suppliers"
import SupplierDetailPage from "@/pages/supplier-detail"
import SectionsPage from "@/pages/sections"
import SectionDetailPage from "@/pages/section-detail"
import ShiftsPage from "@/pages/shifts"
import ShiftDetailPage from "@/pages/shift-detail"
import WorkOrdersPage from "@/pages/work-orders"
import WorkOrderDetailPage from "@/pages/work-order-detail"
import RecoveryPage from "@/pages/recovery"
import ActivityLogPage from "@/pages/activity-log"

export function App() {
  const fmt = useNumberFormatSettings()
  const fmtKey = `${fmt.digitSystem}-${fmt.useThousandsSeparator ? 1 : 0}-${fmt.alwaysShowDecimals ? 1 : 0}-${fmt.decimalPlaces}`
  return (
    <HashRouter>
      <AuthProvider>
        <PermissionsProvider>
        <Routes key={fmtKey}>
          <Route path="/" element={<Navigate to="/control-panel" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/theme" element={<ThemePage />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/control-panel" element={<ControlPanelPage />} />
            <Route path="/account-settings" element={<AccountSettingsPage />} />
            <Route path="/account-settings/general" element={<AccountSettingsGeneralPage />} />
            <Route path="/account-settings/dashboard" element={<AccountSettingsDashboardPage />} />
            <Route path="/account-settings/appearance" element={<AccountSettingsAppearancePage />} />
            <Route path="/account-settings/notifications" element={<AccountSettingsNotificationsPage />} />
            <Route path="/users-permissions" element={<ProtectedRoute requires="view_users"><UsersPermissionsPage /></ProtectedRoute>} />
            <Route path="/vaults" element={<ProtectedRoute requires="view_vaults"><VaultsPage /></ProtectedRoute>} />
            <Route path="/vaults/:vaultId" element={<ProtectedRoute requires="view_vaults"><VaultDetailPage /></ProtectedRoute>} />
            <Route path="/sections" element={<ProtectedRoute requires="view_sections"><SectionsPage /></ProtectedRoute>} />
            <Route path="/sections/:sectionId" element={<ProtectedRoute requires="view_sections"><SectionDetailPage /></ProtectedRoute>} />
            <Route path="/movements" element={<ProtectedRoute requires="view_movements"><MovementsPage /></ProtectedRoute>} />
            <Route path="/work-orders" element={<ProtectedRoute requires="view_work_orders"><WorkOrdersPage /></ProtectedRoute>} />
            <Route path="/work-orders/:id" element={<ProtectedRoute requires="view_work_orders"><WorkOrderDetailPage /></ProtectedRoute>} />
            <Route path="/shifts" element={<ProtectedRoute requires="view_shifts_history"><ShiftsPage /></ProtectedRoute>} />
            <Route path="/shifts/:shiftId" element={<ProtectedRoute requires="view_shift_details"><ShiftDetailPage /></ProtectedRoute>} />
            <Route path="/recovery" element={<ProtectedRoute requires="view_recovery"><RecoveryPage /></ProtectedRoute>} />
            <Route path="/activity-log" element={<ProtectedRoute requires="view_activity_log"><ActivityLogPage /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute requires="view_suppliers"><SuppliersPage /></ProtectedRoute>} />
            <Route path="/suppliers/:supplierId" element={<ProtectedRoute requires="view_suppliers"><SupplierDetailPage /></ProtectedRoute>} />
            <Route path="/system-settings" element={<ProtectedRoute requires="view_system_settings"><SystemSettingsPage /></ProtectedRoute>} />
            <Route path="/system-settings/:section" element={<ProtectedRoute requires="view_system_settings"><SystemSettingsPage /></ProtectedRoute>} />
            <Route path="/system-settings/metals/:metalId" element={<ProtectedRoute requires="view_system_settings"><MetalDetailPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/control-panel" replace />} />
        </Routes>
        </PermissionsProvider>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
