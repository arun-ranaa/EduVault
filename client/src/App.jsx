import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Route Guards
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import GuestRoute from './routes/GuestRoute';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// User Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ResourcesPage from './pages/resources/ResourcesPage';
import ResourceDetailPage from './pages/resources/ResourceDetailPage';
import UploadResourcePage from './pages/resources/UploadResourcePage';
import BookmarksPage from './pages/bookmarks/BookmarksPage';
import VaultPage from './pages/vault/VaultPage';
import VaultFileDetailPage from './pages/vault/VaultFileDetailPage';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminResourcesPage from './pages/admin/AdminResourcesPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminStoragePage from './pages/admin/AdminStoragePage';
import AdminActivityPage from './pages/admin/AdminActivityPage';

// Components
import LoadingSpinner from './components/common/LoadingSpinner';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading EduVault..." />;
  }

  return (
    <Routes>
      {/* Auth Routes (Guest Only) */}
      <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected User Routes */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
        <Route path="/upload" element={<UploadResourcePage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/vault/:id" element={<VaultFileDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<AdminRoute><MainLayout /></AdminRoute>}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/resources" element={<AdminResourcesPage />} />
        <Route path="/admin/categories" element={<AdminCategoriesPage />} />
        <Route path="/admin/storage" element={<AdminStoragePage />} />
        <Route path="/admin/activity" element={<AdminActivityPage />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch-all */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
            <p className="text-xl text-gray-600 mb-6">Page not found</p>
            <a href="/dashboard" className="btn-primary">Go to Dashboard</a>
          </div>
        </div>
      } />
    </Routes>
  );
}

export default App;
