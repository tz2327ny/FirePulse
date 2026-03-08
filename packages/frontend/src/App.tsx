import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { SocketProvider } from './context/SocketContext.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { SessionsPage } from './pages/SessionsPage.js';
import { ClassesPage } from './pages/ClassesPage.js';
import { ParticipantsPage } from './pages/ParticipantsPage.js';
import { DevicesPage } from './pages/DevicesPage.js';
import { ReceiversPage } from './pages/ReceiversPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ParticipantDetailPage } from './pages/ParticipantDetailPage.js';
import { RehabPage } from './pages/RehabPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="rehab" element={<RehabPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="receivers" element={<ReceiversPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="participants/:id" element={<ParticipantDetailPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
