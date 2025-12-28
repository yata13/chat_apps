// src/auth/authContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import config from "../config.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch(`${config.API_URL}/api/me`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const d = await res.json();
        setUser(d.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }

  // Initial load
  useEffect(() => {
    refresh();
  }, []);

  async function login({ email, password }) {
    const r = await fetch(`${config.API_URL}/api/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: email, password }), // Matches backend "identity"
    });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || "Login failed");
    await refresh(); // Reload user from server cookie
  }

  async function logout() {
    await fetch(`${config.API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  const value = useMemo(() => ({ user, ready, loading, login, logout, refresh }), [user, ready, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
