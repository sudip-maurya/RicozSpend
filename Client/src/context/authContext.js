import { createContext, useContext } from "react";

/** Shared authentication context (Part 2). The provider lives in AuthProvider.jsx */
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }

  return context;
};
