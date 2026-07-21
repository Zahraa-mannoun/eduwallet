import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { Parents } from './pages/Parents';
import { Institutions } from './pages/Institutions';
import { Transactions } from './pages/Transactions';
import { Relationships } from './pages/Relationships';
import { KYC } from './pages/KYC';
import { Fraud } from './pages/Fraud';
import { Scholarships } from './pages/Scholarships';

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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
