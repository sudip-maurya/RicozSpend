/** Authentication API calls (Part 2). All requests go through src/api/client.js, which attaches the JWT. */

import api from "../api/client";

const BASE = "/api/auth";

export const signup = (payload) => api.post(`${BASE}/signup`, payload);

export const login = (payload) => api.post(`${BASE}/login`, payload);

/** Restores the current user from a stored JWT (used on page refresh). */
export const fetchCurrentUser = () => api.get(`${BASE}/me`);

// Part 2 - email verification
/** Consume the one-time token from the emailed verification link. */
export const verifyEmail = (token) => api.post(`${BASE}/verify-email`, { token });

/** Ask the backend to send a new verification email. */
export const resendVerification = (email) => api.post(`${BASE}/resend-verification`, { email });

/** POST /api/auth/logout (P1-5) Revokes the current JWT server-side. */
export const logout = () => api.post(`${BASE}/logout`);

