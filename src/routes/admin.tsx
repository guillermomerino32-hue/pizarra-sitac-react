import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type Role } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminScreen,
});

interface UsuarioRow {
  id: string;
  user_id: string;
  indicativo: string;
  email: string;
  revoked: boolean;
  created_at: string;
}

function AdminScreen() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, Role[]>>({});
  const [accesos, setAccesos] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && (!session || session.role !== "admin")) navigate({ to: "/main" });
  }, [session, loading, navigate]);

  async function reload() {
    const [{ data: us }, { data: rs }, { data: ac }] = await Promise.all([
      supabase.from("usuarios" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles" as any).select("user_id,role"),
      supabase.from("accesos_log" as any).select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setUsuarios((us as any) ?? []);
    const map: Record<string, Role[]> = {};
    ((rs as any[]) ?? []).forEach(r => { (map[r.user_id] ||= []).push(r.role); });
    setRolesMap(map);
    setAccesos(ac ?? []);
  }

  useEffect(() => { if (session?.role === "admin") reload(); }, [session]);

  function highestRole(rs: Role[] | undefined): Role {
    if (!rs) return "voluntario";
    if (rs.includes("admin")) return "admin";
    if (rs.includes("mando")) return "mando";
    return "voluntario";
  }

  async function setRole(userId: string, newRole: Role) {
    const { error: delErr } = await supabase.from("user_roles" as any).delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); return; }
    const inserts: { user_id: string; role: Role }[] = [{ user_id: userId, role: newRole }];
    if (newRole === "admin") inserts.push({ user_id: userId, role: "mando" });
    const { error } = await supabase.from("user_roles" as any).insert(inserts as any);
    if (error) toast.error(error.message); else toast.success("Rol actualizado");
    reload();
  }

  async function toggleRevoke(u: UsuarioRow) {
    const { error } = await supabase.from("usuarios" as any).update({ revoked: !u.revoked } as any).eq("id", u.id);
    if (error) toast.error(error.message); else toast.success(u.revoked ? "Acceso restaurado" : "Acceso revocado");
    reload();
  }

  if (loading || !session) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  if (session.role !== "admin") return null;

  return (
    <div className="min-h-screen tactical-bg">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/main" })}><ArrowLeft className="w-4 h-4" /></Button>
            <h1 className="text-lg font-bold uppercase tracking-wide">Gestión de usuarios</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Usuarios ({usuarios.length})</h2>
          <div className="bg-card border rounded divide-y">
            {usuarios.map(u => {
              const role = highestRole(rolesMap[u.user_id]);
              return (
                <div key={u.id} className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold">{u.indicativo} {u.revoked && <span className="text-xs text-destructive ml-2">REVOCADO</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <Select value={role} onValueChange={v => setRole(u.user_id, v as Role)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="mando">Mando</SelectItem>
                      <SelectItem value="voluntario">Voluntario</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant={u.revoked ? "secondary" : "destructive"} onClick={() => toggleRevoke(u)} disabled={u.user_id === session.userId}>
                    {u.revoked ? (<><ShieldCheck className="w-3 h-3 mr-1" /> Restaurar</>) : (<><ShieldOff className="w-3 h-3 mr-1" /> Revocar</>)}
                  </Button>
                </div>
              );
            })}
            {usuarios.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin usuarios registrados.</div>}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Últimos accesos</h2>
          <div className="bg-card border rounded divide-y max-h-[400px] overflow-auto">
            {accesos.map((a: any) => (
              <div key={a.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono font-bold">{a.indicativo}</span>
                  <span className="text-muted-foreground ml-2">{a.email}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("es-ES")}</div>
              </div>
            ))}
            {accesos.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin accesos registrados.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
