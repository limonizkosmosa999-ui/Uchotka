import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalendarPage } from './pages/CalendarPage';
import { TaxCalendarPage } from './pages/TaxCalendarPage';
import { ImportPage } from './pages/ImportPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { CompanyNewPage } from './pages/CompanyNewPage';
import { TaskNewPage } from './pages/TaskNewPage';
import { ManagerPage } from './pages/ManagerPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';

// Global Error Boundary — prevents any uncaught error from showing blank white page
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4EFEA] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xl mb-4">✓</div>
          <h1 className="text-xl font-bold text-[#1A1916] mb-2">Произошла ошибка</h1>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-4 py-2 bg-[#1E4D3B] text-white text-sm rounded-lg hover:bg-[#163B2D] transition"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Wrapper
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4EFEA] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1E4D3B] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout min-h-screen bg-[#F4EFEA]">
      <Navbar />
      <main className="app-main flex-1 pb-16 xl:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
};

// Root index redirect based on role
const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4EFEA] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1E4D3B] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'manager') {
    return <Navigate to="/manager" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies/new"
            element={
              <ProtectedRoute>
                <CompanyNewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies/:id"
            element={
              <ProtectedRoute>
                <CompanyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/new"
            element={
              <ProtectedRoute>
                <TaskNewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute>
                <ManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <ActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/activity"
            element={<Navigate to="/activity" replace />}
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tax-calendar"
            element={
              <ProtectedRoute>
                <TaxCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <ImportPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;