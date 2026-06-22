import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "mando" | "voluntario";

export interface Session {
  userId: string;
  email: string;
  indicativo: string;
  role: Role;
}

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  loginWithIndicativo: (indicativo: string, password: string, emailIfNew?: string) => Promise<{ ok: boolean; error?: string; needsEmail?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchProfile(userId: string): Promise<Session | null> {
  const { data: u } = await supabase.from("usuarios" as any).select("indicativo,email,revoked").eq("user_id", userId).maybeSingle();
  if (!u) return null;
  if ((u as any).revoked) {
    await supabase.auth.signOut();
    return null;
  }
  const { data: roles } = await supabase.from("user_roles" as any).select("role").eq("user_id", userId);
  const rs = ((roles ?? []) as any[]).map(r => r.role as Role);
  const role: Role = rs.includes("admin") ? "admin" : rs.includes("mando") ? "mando" : "voluntario";
  return { userId, email: (u as any).email, indicativo: (u as any).indicativo, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setSession(null); return; }
    const profile = await fetchProfile(data.session.user.id);
    setSession(profile);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setSession(null); return; }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        refresh();
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const loginWithIndicativo: AuthCtx["loginWithIndicativo"] = async (indicativoRaw, password, emailIfNew) => {
    const indicativo = indicativoRaw.trim().toUpperCase();
    if (!indicativo) return { ok: false, error: "Indicativo requerido" };
    if (!password) return { ok: false, error: "Contraseña requerida" };

    // Lookup existing email for indicativo
    const { data: lookup } = await supabase.rpc("lookup_indicativo" as any, { _indicativo: indicativo });
    const row = Array.isArray(lookup) ? lookup[0] : null;

    if (row) {
      if (row.revoked) return { ok: false, error: "Acceso revocado por el administrador" };
      const { error } = await supabase.auth.signInWithPassword({ email: row.email, password });
      if (error) return { ok: false, error: "Contraseña incorrecta" };
      // Log access
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("accesos_log" as any).insert({ user_id: u.user.id, indicativo, email: row.email, user_agent: navigator.userAgent } as any);
      }
      await refresh();
      return { ok: true };
    }

    // First time: requires email
    const email = (emailIfNew ?? "").trim().toLowerCase();
    if (!email) return { ok: false, needsEmail: true, error: "Primer acceso: introduce tu correo" };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, needsEmail: true, error: "Correo no válido" };
    if (password.length < 6) return { ok: false, needsEmail: true, error: "Contraseña mínima 6 caracteres" };

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { indicativo }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) return { ok: false, needsEmail: true, error: error.message };

    // signUp may not return a session if confirmation required; try login
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) return { ok: false, needsEmail: true, error: "Cuenta creada. Verifica tu email e intenta de nuevo." };

    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("accesos_log" as any).insert({ user_id: u.user.id, indicativo, email, user_agent: navigator.userAgent } as any);
    }
    await refresh();
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return <Ctx.Provider value={{ session, loading, loginWithIndicativo, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
