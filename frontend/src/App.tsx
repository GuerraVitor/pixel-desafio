import { Navigate, Route, Routes } from "react-router-dom"

import { useAuth } from "./auth/AuthContext"
import DashboardPage from "./pages/DashboardPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cloud px-6 text-sm text-moss">
        Carregando sessao...
      </main>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const { token, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cloud px-6 text-sm text-moss">
        Carregando sessao...
      </main>
    )
  }

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
