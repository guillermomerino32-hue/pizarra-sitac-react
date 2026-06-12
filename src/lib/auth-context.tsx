import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isValidIndicativo, roleFor, FIXED_PASSWORD, type Role } from "./domain";

interface Session { indicativo: string; role: Role; }

interface AuthCtx {
  session: Session | null;
  login: (indicativo: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "sitac.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  const login = (indicativoRaw: string, password: string) => {
    const indicativo = indicativoRaw.trim().toUpperCase();
    if (!isValidIndicativo(indicativo)) return { ok: false, error: "Indicativo no válido" };
    if (password !== FIXED_PASSWORD) return { ok: false, error: "Contraseña incorrecta" };
    const s: Session = { indicativo, role: roleFor(indicativo) };
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
    return { ok: true };
  };

  const logout = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem("sitac.servicio");
    setSession(null);
  };

  return <Ctx.Provider value={{ session, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
