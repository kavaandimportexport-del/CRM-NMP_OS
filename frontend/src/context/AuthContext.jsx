import { createContext, useContext, useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = checking, false = logged out
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await http.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email, password) => {
    const { data } = await http.post("/auth/login", { email, password });
    localStorage.setItem("nmp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const setupAdmin = async (name, email, password) => {
    const { data } = await http.post("/auth/setup-admin", { name, email, password });
    localStorage.setItem("nmp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await http.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("nmp_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, setupAdmin, refresh, formatErr }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
