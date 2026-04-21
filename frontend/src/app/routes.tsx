import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RoleGuard } from '../auth/RoleGuard';
import { useAuth } from '../auth/AuthContext';

import { HomePage } from '../pages/Home';
import { LoginPage } from '../pages/Login';
import { RegisterPage } from '../pages/Register';
import { ResetPasswordPage } from '../pages/ResetPassword';
import { AboutPage } from '../pages/About';
import { AccountBlockedPage } from '../pages/AccountBlocked';
import { SettingsPage } from '../pages/Settings';
import { NotFoundPage } from '../pages/NotFound';

import { DriverDashboardPage } from '../features/driver/DriverDashboard';
import { DriverProfilePage } from '../features/driver/DriverProfile';
import { DriverApplicationsPage } from '../features/driver/DriverApplications';
import { PointsPage } from '../pages/pointsPage';
import { DriverCatalog } from '../features/driver/DriverCatalog';
import { DriverProductDetail } from '../features/driver/DriverProductDetail';
import { DriverOrdersPage } from '../features/driver/DriverOrders';

import { CartPage } from '../features/driver/CartPage';
import { CheckoutPage } from '../features/driver/CheckoutPage';
import { OrderConfirmationPage } from '../features/driver/OrderConfirmationPage';

import { SponsorDashboardPage } from '../features/sponsor/SponsorDashboard';
import { SponsorProfileFormPage } from '../features/sponsor/SponsorProfileForm';
import { SponsorApplicationsPage } from '../pages/SponsorApplicationsPage';
import { SponsorDriversPage } from '../features/sponsor/SponsorDrivers';
import { SponsorPointsPage } from '../features/sponsor/SponsorPoints';
import { SponsorRewardSettingsPage } from '../features/sponsor/SponsorRewardSettings';
import { SponsorCatalog } from '../features/sponsor/SponsorCatalog';
import { SponsorPurchaseHistory } from '../features/sponsor/SponsorPurchaseHistory';
import { SponsorErrorLogs } from '../features/sponsor/SponsorErrorLogs';
import { SponsorAuditLogs } from '../features/sponsor/SponsorAuditLogs';
import { SponsorReportsPage } from '../features/sponsor/SponsorReports';
import { SponsorUsersPage } from '../features/sponsor/SponsorUsers';

import { AdminDashboardPage } from '../features/admin/AdminDashboard';
import { AdminUsersPage } from '../features/admin/AdminUsers';
import { AdminSponsorsPage } from '../features/admin/AdminSponsors';
import { AdminReportsPage } from '../features/admin/AdminReports';
import { AdminAuditLogsPage } from '../features/admin/AdminAuditLogs';
import { AdminDriverSponsorsPage } from '../features/admin/AdminDriverSponsors';
import { AdminBulkUploadPage } from '../features/admin/AdminBulkUpload';
import { AdminCommunicationLogsPage } from '../features/admin/AdminCommunicationLogs';
import { AdminDriversPage } from '../features/admin/AdminDrivers';
import { AdminProfilePage } from '../features/admin/AdminProfile';


/**
 * Redirects logged-in users to the dashboard for their role.
 */
function RoleHomeRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={`/${user.role}/dashboard`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      /* ---------------- PUBLIC ---------------- */
      { path: '/', element: <HomePage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/account-blocked', element: <AccountBlockedPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },

      /* ---------------- PROTECTED ---------------- */
      {
        element: <ProtectedRoute />,
        children: [
          /* common */
          { path: '/home', element: <RoleHomeRedirect /> },
          { path: '/account/settings', element: <SettingsPage /> },

          /* DRIVER */
          {
            element: <RoleGuard allowed={['driver']} />,
            children: [
              { path: '/driver/dashboard', element: <DriverDashboardPage /> },
              { path: '/driver/applications', element: <DriverApplicationsPage /> },
              { path: '/driver/profile', element: <DriverProfilePage /> },
              { path: '/driver/points', element: <PointsPage /> },
              { path: '/driver/catalog', element: <DriverCatalog /> },
              { path: '/driver/catalog/:itemId', element: <DriverProductDetail /> },
              { path: '/driver/orders', element: <DriverOrdersPage /> },
              { path: '/driver/cart', element: <CartPage /> },
              { path: '/driver/checkout', element: <CheckoutPage /> },
              { path: '/driver/order-confirmation', element: <OrderConfirmationPage /> },
            ],
          },

          /* SPONSOR */
          {
            element: <RoleGuard allowed={['sponsor']} />,
            children: [
              { path: '/sponsor/dashboard', element: <SponsorDashboardPage /> },
              { path: '/sponsor/profile', element: <SponsorProfileFormPage /> },
              { path: '/sponsor/users', element: <SponsorUsersPage /> },
              { path: '/sponsor/applications', element: <SponsorApplicationsPage /> },
              { path: '/sponsor/drivers', element: <SponsorDriversPage /> },
              { path: '/sponsor/points', element: <SponsorPointsPage /> },
              { path: '/sponsor/reward-settings', element: <SponsorRewardSettingsPage /> },
              { path: '/sponsor/catalog', element: <SponsorCatalog /> },
              { path: '/sponsor/reports', element: <SponsorReportsPage /> },
              { path: '/sponsor/purchase-history', element: <SponsorPurchaseHistory /> },
              { path: '/sponsor/audit-logs', element: <SponsorAuditLogs /> },
              { path: '/sponsor/error-logs', element: <SponsorErrorLogs /> },
              { path: '/sponsor/reports', element: <SponsorReportsPage /> },
            ],
          },

          /* ADMIN */
          {
            element: <RoleGuard allowed={['admin']} />,
            children: [
              { path: '/admin/dashboard', element: <AdminDashboardPage /> },
              { path: '/admin', element: <AdminDashboardPage /> },
              { path: '/admin/users', element: <AdminUsersPage /> },
              { path: '/admin/sponsors', element: <AdminSponsorsPage /> },
              { path: '/admin/reports', element: <AdminReportsPage /> },
              { path: '/admin/audit-logs', element: <AdminAuditLogsPage /> },
              { path: '/admin/driver-sponsors', element: <AdminDriverSponsorsPage /> },
              { path: '/admin/bulk-upload', element: <AdminBulkUploadPage /> },
              { path: '/admin/communication-logs', element: <AdminCommunicationLogsPage /> },
              { path: '/admin/drivers', element: <AdminDriversPage /> },
              { path: '/admin/profile', element: <AdminProfilePage /> },
            ],
          },
        ],
      },

      /* ---------------- 404 ---------------- */
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
