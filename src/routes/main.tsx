import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Servicio } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, LogIn, LogOut, FileText, X, Users } from "lucide-react";
import { toast } from "sonner";
import { generarPdfServicio } from "@/lib/pdf";

export const Route = createFileRoute("/main")({
  component: MainScreen,
});

function MainScreen() {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [activos, setActivos] = useState<Servicio[]>([]);
  const [finalizados, setFinalizados] = useState<Servicio[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [numero, setNumero] = useState("");

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  async function reloadServicios() {
    const { data: act } = await supabase.from("servicios").select("*").eq("estado", "activo").order("created_at", { ascending: false });
    setActivos((act as any) ?? []);
    if (session?.role !== "voluntario") {
      const { data: fin } = await supabase.from("servicios").select("*").eq("estado", "finalizado").order("finished_at", { ascending: false }).limit(30);
      setFinalizados((fin as any) ?? []);
    }
  }

  useEffect(() => { if (session) reloadServicios(); }, [session]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  if (!session) return null;

  const canMando = session.role === "mando" || session.role === "admin";

  async function reabrirServicio(s: Servicio) {
    const { data: exists } = await supabase.from("servicios").select("id").eq("numero", s.numero).eq("estado", "activo").maybeSingle();
    if (exists) { toast.error("Ya hay un servicio activo con ese número"); return; }
    await supabase.from("servicios").update({ estado: "activo", finished_at: null } as any).eq("id", s.id);
    toast.success(`Servicio #${s.numero} reabierto`);
    navigate({ to: "/servicio/$numero", params: { numero: String(s.numero) } });
  }

  async function cerrarServicio(s: Servicio) {
    if (!confirm(`¿Cerrar el servicio #${s.numero}?`)) return;
    const { error } = await supabase.from("servicios").update({ estado: "finalizado", finished_at: new Date().toISOString() } as any).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Servicio #${s.numero} cerrado`);
    reloadServicios();
  }

  async function descargarPdf(s: Servicio) {
    try {
      await generarPdfServicio(s);
    } catch (e: any) {
      toast.error("Error generando PDF: " + (e?.message ?? e));
    }
  }

  async function crearServicio() {
    const n = parseInt(numero, 10);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Número inválido"); return; }
    const { data: exists } = await supabase.from("servicios").select("id").eq("numero", n).eq("estado", "activo").maybeSingle();
    if (exists) { toast.error("Ya existe un servicio activo con ese número"); return; }
    const { data, error } = await supabase.from("servicios").insert({ numero: n, mando_indicativo: session!.indicativo, estado: "activo" } as any).select().single();
    if (error || !data) { toast.error(error?.message || "Error creando servicio"); return; }
    setNewOpen(false); setNumero("");
    navigate({ to: "/servicio/$numero", params: { numero: String(n) } });
  }

  async function unirseServicio() {
    const n = parseInt(numero, 10);
    if (!Number.isFinite(n)) { toast.error("Número inválido"); return; }
    const { data } = await supabase.from("servicios").select("id").eq("numero", n).eq("estado", "activo").maybeSingle();
    if (!data) { toast.error("No existe servicio activo con ese número"); return; }
    setJoinOpen(false); setNumero("");
    navigate({ to: "/servicio/$numero", params: { numero: String(n) } });
  }

  return (
    <div className="min-h-screen tactical-bg">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-primary/20 border border-primary flex items-center justify-center"><Shield className="w-5 h-5 text-primary" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Pizarra SITAC</div>
              <div className="text-sm font-bold">Protección Civil Rivas</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Indicativo</div>
              <div className="font-mono font-bold">{session.indicativo} · <span className="text-primary uppercase text-xs">{session.role}</span></div>
            </div>
            {session.role === "admin" && (
              <Button variant="outline" size="sm" onClick={() => navigate({ to: "/admin" })}><Users className="w-4 h-4 mr-1" /> Usuarios</Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {canMando && (
            <button onClick={() => setNewOpen(true)} className="bg-card border-2 border-primary/40 hover:border-primary rounded-lg p-6 text-left transition-colors">
              <Plus className="w-7 h-7 text-primary mb-3" />
              <h2 className="text-lg font-bold uppercase tracking-wide">Nuevo Servicio</h2>
              <p className="text-sm text-muted-foreground mt-1">Crear una nueva intervención y abrir la pizarra.</p>
            </button>
          )}
          <button onClick={() => setJoinOpen(true)} className="bg-card border-2 border-border hover:border-primary rounded-lg p-6 text-left transition-colors">
            <LogIn className="w-7 h-7 text-primary mb-3" />
            <h2 className="text-lg font-bold uppercase tracking-wide">Unirse a Servicio</h2>
            <p className="text-sm text-muted-foreground mt-1">Acceder a un servicio activo por su número.</p>
          </button>
        </section>

        {activos.length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Servicios activos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {activos.map(s => (
                <div key={s.id} className="bg-card border rounded p-3 flex flex-col gap-2 hover:border-primary">
                  <button onClick={() => navigate({ to: "/servicio/$numero", params: { numero: String(s.numero) } })} className="text-left">
                    <div className="text-xs text-muted-foreground">#</div>
                    <div className="text-2xl font-mono font-bold text-primary">{s.numero}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("es-ES")}</div>
                  </button>
                  {canMando && (
                    <Button size="sm" variant="destructive" className="w-full" onClick={() => cerrarServicio(s)}>
                      <X className="w-3 h-3 mr-1" /> Cerrar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {canMando && finalizados.length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Servicios finalizados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {finalizados.map(s => (
                <div key={s.id} className="bg-card border rounded p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-2xl font-mono font-bold text-muted-foreground">#{s.numero}</div>
                    <div className="text-[10px] text-muted-foreground">{s.finished_at ? new Date(s.finished_at).toLocaleString("es-ES") : ""}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="secondary" onClick={() => descargarPdf(s)}><FileText className="w-3 h-3 mr-1" /> PDF</Button>
                    <Button size="sm" variant="ghost" onClick={() => reabrirServicio(s)}>Reabrir</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Servicio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Número de servicio</Label>
            <Input type="number" autoFocus value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ej: 42" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={crearServicio}>Crear y abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unirse a servicio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Número de servicio</Label>
            <Input type="number" autoFocus value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>Cancelar</Button>
            <Button onClick={unirseServicio}>Unirse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
