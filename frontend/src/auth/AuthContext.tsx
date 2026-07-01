import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react"

import { api, setAuthToken, TOKEN_STORAGE_KEY } from "../lib/api"

type User = {
  id: string
  email: string
  created_at: string
}

type AuthResponse = {
  access_token: string
  token_type: "bearer"
  user: User
}

type Credentials = {
  email: string
  password: string
}

type AuthContextValue = {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (credentials: Credentials) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [isLoading, setIsLoading] = useState(Boolean(token))

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    setAuthToken(token)
    api
      .get<User>("/auth/me")
      .then((response) => setUser(response.data))
      .catch(() => {
        setToken(null)
        setUser(null)
        setAuthToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  async function authenticate(endpoint: "/auth/login" | "/auth/register", credentials: Credentials) {
    const response = await api.post<AuthResponse>(endpoint, credentials)
    setToken(response.data.access_token)
    setUser(response.data.user)
    setAuthToken(response.data.access_token)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      login: (credentials) => authenticate("/auth/login", credentials),
      register: (credentials) => authenticate("/auth/register", credentials),
      logout: () => {
        setToken(null)
        setUser(null)
        setAuthToken(null)
      },
    }),
    [isLoading, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return context
}
