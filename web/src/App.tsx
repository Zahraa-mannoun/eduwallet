import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Students } from './pages/Students';
import { Parents } from './pages/Parents';
import { Institutions } from './pages/Institutions';
import { Transactions } from './pages/Transactions';
import { Relationships } from './pages/Relationships';
import { KYC } from './pages/KYC';
import { Resubmissions } from './pages/Resubmissions';
import { SupportMessages } from './pages/SupportMessages';
import { Fraud } from './pages/Fraud';
import { Scholarships } from './pages/Scholarships';
import { Reports } from './pages/Reports';
import { EmailChangeRequests } from './pages/EmailChangeRequests';
import { Settings } from './pages/Settings';

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedPage>
              <Dashboard />
            </ProtectedPage>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedPage>
              <Analytics />
            </ProtectedPage>
          }
        />
        <Route
          path="/users/students"
          element={
            <ProtectedPage>
              <Students />
            </ProtectedPage>
          }
        />
        <Route
          path="/users/parents"
          element={
            <ProtectedPage>
              <Parents />
            </ProtectedPage>
          }
        />
        <Route
          path="/users/institutions"
          element={
            <ProtectedPage>
              <Institutions />
            </ProtectedPage>
          }
        />
        <Route path="/users" element={<Navigate to="/users/students" replace />} />
        <Route
          path="/transactions"
          element={
            <ProtectedPage>
              <Transactions />
            </ProtectedPage>
          }
        />
        <Route
          path="/relationships"
          element={
            <ProtectedPage>
              <Relationships />
            </ProtectedPage>
          }
        />
        <Route
          path="/kyc"
          element={
            <ProtectedPage>
              <KYC />
            </ProtectedPage>
          }
        />
        <Route
          path="/resubmissions"
          element={
            <ProtectedPage>
              <Resubmissions />
            </ProtectedPage>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedPage>
              <SupportMessages />
            </ProtectedPage>
          }
        />
        <Route
          path="/fraud"
          element={
            <ProtectedPage>
              <Fraud />
            </ProtectedPage>
          }
        />
        <Route
          path="/scholarships"
          element={
            <ProtectedPage>
              <Scholarships />
            </ProtectedPage>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedPage>
              <Reports />
            </ProtectedPage>
          }
        />
        <Route
          path="/email-requests"
          element={
            <ProtectedPage>
              <EmailChangeRequests />
            </ProtectedPage>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedPage>
              <Settings />
            </ProtectedPage>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
