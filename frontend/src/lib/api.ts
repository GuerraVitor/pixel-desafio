import axios from "axios"

export const TOKEN_STORAGE_KEY = "pixel_breeders_token"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
})

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    return
  }

  delete api.defaults.headers.common.Authorization
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
if (storedToken) {
  setAuthToken(storedToken)
}
