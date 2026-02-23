import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RoleGuard } from '../auth/RoleGuard';
import { useAuth } from '../auth/AuthContext';

import { HomePage } from '../pages/Home';
import { LoginPage } from '../pages/Login';
import CatalogPage from "../pages/CatalogPage";
import { AboutPage } from '../pages/About';
import { SettingsPage } from '../pages/Settings';
import { NotFoundPage } from '../pages/NotFound';

import { DriverDashboardPage } from '../features/driver/DriverDashboard';
import { DriverProfilePage } from '../features/driver/DriverProfile';
import { PointsPage } from '../pages/pointsPage';

import { SponsorDashboardPage } from '../features/sponsor/SponsorDashboard';
import { SponsorProfileFormPage } from '../features/sponsor/SponsorProfileForm';
import { SponsorApplicationsPage } from '../pages/SponsorApplicationsPage';
import { SponsorDriversPage } from '../features/sponsor/SponsorDrivers';
import { SponsorPointsPage } from '../features/sponsor/SponsorPoints';
import { SponsorRewardSettingsPage } from '../features/sponsor/SponsorRewardSettings';

import { AdminDashboardPage } from '../features/admin/AdminDashboard';


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
      { path: '/login', element: <LoginPage /> },

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
              { path: '/driver/profile', element: <DriverProfilePage /> },
              { path: '/driver/points', element: <PointsPage /> },
              { path: '/driver/catalog', element: <CatalogPage /> }, 
            ],
          },

          /* SPONSOR */
          {
            element: <RoleGuard allowed={['sponsor']} />,
            children: [
              { path: '/sponsor/dashboard', element: <SponsorDashboardPage /> },
              { path: '/sponsor/profile', element: <SponsorProfileFormPage /> },
              { path: '/sponsor/applications', element: <SponsorApplicationsPage /> },
              { path: '/sponsor/drivers', element: <SponsorDriversPage /> },
              { path: '/sponsor/points', element: <SponsorPointsPage /> },
              { path: '/sponsor/reward-settings', element: <SponsorRewardSettingsPage /> },

              { path: '/sponsor/catalog', element: <CatalogPage /> },
            ],
          },

          /* ADMIN */
          {
            element: <RoleGuard allowed={['admin']} />,
            children: [
              { path: '/admin/dashboard', element: <AdminDashboardPage /> },
              { path: '/admin', element: <AdminDashboardPage /> },
            ],
          },
        ],
      },

      /* ---------------- 404 ---------------- */
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
