import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ProcessWithdrawal } from './pages/ProcessWithdrawal';
import { WithdrawalHistory } from './pages/WithdrawalHistory';

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
          path="/process"
          element={
            <ProtectedPage>
              <ProcessWithdrawal />
            </ProtectedPage>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedPage>
              <WithdrawalHistory />
            </ProtectedPage>
          }
        />
        <Route path="/" element={<Navigate to="/process" replace />} />
        <Route path="*" element={<Navigate to="/process" replace />} />
      </Routes>
    </AuthProvider>
  );
}
