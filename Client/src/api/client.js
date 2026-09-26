import axios from 'axios'
import { SESSION_EXPIRED_EVENT, clearSession, getToken } from '../utils/authStorage'

// Base URL of the Express backend in SERVER/.
// Read from Client/.env (VITE_API_URL); falls back to the local dev server.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Login/signup answer 401 for bad credentials; that must not clear a session.
const PUBLIC_AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/signup']

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Part 2: send the JWT (issued by /api/auth/login) with every request.
api.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Part 2: an expired/invalid token clears the stored session and tells the
// AuthProvider, which redirects the user back to the Login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    const isPublicAuthCall = PUBLIC_AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint))

    if (status === 401 && !isPublicAuthCall) {
      clearSession()

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      }
    }

    return Promise.reject(error)
  }
)

export default api

