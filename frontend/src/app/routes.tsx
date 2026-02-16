import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RoleGuard } from '../auth/RoleGuard';

import { LoginPage } from '../pages/Login';
import { AccountSettingsPage } from '../pages/AccountSettings';
import { NotFoundPage } from '../pages/NotFound';
import { DriverProfilePage } from '../features/driver/DriverProfile';
import { SponsorProfileFormPage } from '../features/sponsor/SponsorProfileForm';
import { AdminDashboardPage } from '../features/admin/AdminDashboard';
import { SponsorApplicationsPage } from '../pages/SponsorApplicationsPage';
import { AboutPage } from '../pages/About';
import { PointsPage } from '../pages/pointsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <Layout />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          /* ── Account settings (all roles) ── */
          {
            path: '/account/settings',
            element: <AccountSettingsPage />,
          },

          /* ── Driver routes ── */
          {
            element: <RoleGuard allowed={['driver']} />,
            children: [
              { path: '/driver/profile', element: <DriverProfilePage /> },
              { path: '/driver/points', element: <PointsPage /> },
            ],
          },

          /* ── Sponsor routes ── */
          {
           element: <RoleGuard allowed={['sponsor']} />,
           children: [
             { path: '/sponsor/profile', element: <SponsorProfileFormPage /> },
             { path: '/sponsor/applications', element: <SponsorApplicationsPage /> },
            ],
          },


          /* ── Admin routes ── */
          {
            element: <RoleGuard allowed={['admin']} />,
            children: [
              { path: '/admin', element: <AdminDashboardPage /> },
            ],
          },
        ],
      },

      /* ── Redirect root to login ── */
      { path: '/', element: <Navigate to="/login" replace /> },

      /* ── About Page ── */
      { path: '/about', element: <AboutPage /> },

      /* ── 404 ── */
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
