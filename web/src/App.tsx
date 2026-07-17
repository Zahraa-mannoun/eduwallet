import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
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
          path="/users"
          element={
            <ProtectedPage>
              <Users />
            </ProtectedPage>
          }
        />
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
