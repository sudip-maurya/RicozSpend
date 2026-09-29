import axios from 'axios'
import { SESSION_EXPIRED_EVENT, clearSession, getToken } from '../utils/authStorage'

// Base URL of the Express backend (VITE_API_URL; env.development locally).
const configuredBaseURL = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')

if (
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1' &&
  (!configuredBaseURL || /^https?:\/\/(?:localhost|127(?:\.0{1,3}){3})(?::\d+)?(?:\/|$)/i.test(configuredBaseURL))
) {
  console.warn(
    '[api] VITE_API_URL is not set to the production backend URL. Requests may fail.'
  )
}

const baseURL = configuredBaseURL || 'http://localhost:5000'

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

// Part 2: an expired/invalid token clears the stored session (AuthProvider redirects to Login).
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

