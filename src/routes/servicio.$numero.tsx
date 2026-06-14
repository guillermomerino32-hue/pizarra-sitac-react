import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  CLAVES_LOG, CLAVES_VISUALES, CLAVE_DESCRIPCIONES, FUNCION_COLORS, FUNCION_LABELS, TRAZO_COLORS,
  type Clave, type Foco, type Funcion, type Interviniente, type Servicio, type Sticker, type Tipo, type Trazo, type Zona,
} from "@/lib/domain";
import MapPanel from "@/components/MapPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Map as MapIcon, Square, X, AlertTriangle, FileText, ScrollText,
  MousePointer2, Pen, Eraser, Flame, Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Tool = "select" | "pencil" | "eraser";

export const Route = createFileRoute("/servicio/$numero")({
  component: ServicioScreen,
});

function ServicioScreen() {
  const { numero } = useParams({ from: "/servicio/$numero" });
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panel, setPanel] = useState<"pizarra" | "mapa">("pizarra");
  const [intervinientes, setIntervinientes] = useState<Interviniente[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [focos, setFocos] = useState<Foco[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [contextSticker, setContextSticker] = useState<Sticker | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [editInter, setEditInter] = useState<Interviniente | null>(null);
  const [editFoco, setEditFoco] = useState<Foco | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [penColor, setPenColor] = useState(TRAZO_COLORS[1]);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!session) navigate({ to: "/" }); }, [session, navigate]);

  // Load servicio
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("servicios").select("*").eq("numero", parseInt(numero, 10)).eq("estado", "activo").maybeSingle();
      if (!data) { toast.error("Servicio no encontrado"); navigate({ to: "/main" }); return; }
      setServicio(data as any);
      setLoading(false);
    })();
  }, [numero, navigate]);

  // Load + subscribe
  useEffect(() => {
    if (!servicio) return;
    const sid = servicio.id;
    (async () => {
      const [i, s, l, z, t, f] = await Promise.all([
        supabase.from("intervinientes").select("*").eq("servicio_id", sid).order("created_at"),
        supabase.from("stickers").select("*").eq("servicio_id", sid),
        supabase.from("claves_log").select("*").eq("servicio_id", sid).order("created_at", { ascending: true }),
        (supabase.from as any)("zonas").select("*").eq("servicio_id", sid).order("created_at"),
        (supabase.from as any)("trazos").select("*").eq("servicio_id", sid).order("created_at"),
        (supabase.from as any)("focos").select("*").eq("servicio_id", sid).order("created_at"),
      ]);
      setIntervinientes((i.data as any) ?? []);
      setStickers((s.data as any) ?? []);
      setLogs(l.data ?? []);
      setZonas((z.data as any) ?? []);
      setTrazos((t.data as any) ?? []);
      setFocos((f.data as any) ?? []);
    })();

    const ch = supabase.channel(`sv-${sid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "intervinientes", filter: `servicio_id=eq.${sid}` }, (p) => {
        setIntervinientes(prev => upsertOrDelete(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stickers", filter: `servicio_id=eq.${sid}` }, (p) => {
        setStickers(prev => upsertOrDelete(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "claves_log", filter: `servicio_id=eq.${sid}` }, (p) => {
        if (p.eventType === "INSERT") setLogs(prev => [...prev, p.new]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "zonas", filter: `servicio_id=eq.${sid}` }, (p) => {
        setZonas(prev => upsertOrDelete(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trazos", filter: `servicio_id=eq.${sid}` }, (p) => {
        setTrazos(prev => upsertOrDelete(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "focos", filter: `servicio_id=eq.${sid}` }, (p) => {
        setFocos(prev => upsertOrDelete(prev, p));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "servicios", filter: `id=eq.${sid}` }, (p) => {
        const updated = p.new as any;
        if (updated.estado !== "activo") {
          toast.info("El servicio ha sido finalizado");
          navigate({ to: "/main" });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [servicio, navigate]);

  const isMando = session?.role === "mando";
  const readonly = session?.role === "voluntario";
  const stickersByInt = useMemo(() => {
    const m = new Map<string, Sticker>();
    stickers.filter(s => s.panel === panel && !s.removed).forEach(s => m.set(s.interviniente_id, s));
    return m;
  }, [stickers, panel]);

  const pizarraTrazos = useMemo(() => trazos.filter(t => t.panel === "pizarra"), [trazos]);
  const pizarraFocos = useMemo(() => focos.filter(f => f.panel === "pizarra"), [focos]);

  function intStatus(i: Interviniente): { label: string; dot: string; placedHere: boolean; blocked: boolean } {
    const placed = stickersByInt.get(i.id);
    if (placed) {
      return { label: placed.clave, dot: FUNCION_COLORS[i.funcion], placedHere: true, blocked: true };
    }
    const all = stickers
      .filter(s => s.interviniente_id === i.id)
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    const last = all[0];
    if (last && (last.clave === "C4" || last.clave === "C5")) {
      return { label: `${last.clave} Hospital`, dot: "#eab308", placedHere: false, blocked: true };
    }
    return { label: "Disponible", dot: "#22c55e", placedHere: false, blocked: false };
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!servicio) return;
    const intId = e.dataTransfer.getData("text/interviniente");
    if (!intId) return;
    const interviniente = intervinientes.find(i => i.id === intId);
    if (!interviniente) return;
    const rect = boardRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const existing = stickers.find(s => s.interviniente_id === intId && s.panel === "pizarra");
    if (existing) {
      const now = new Date().toISOString();
      await supabase.from("stickers").update({ x, y, clave: "C2", dashed: true, removed: false, c2_at: now, c3_at: null, updated_at: now } as any).eq("id", existing.id);
      await logClave(interviniente.indicativo_recurso, "C2");
    } else {
      const { error } = await supabase.from("stickers").insert({
        servicio_id: servicio.id, interviniente_id: intId, panel: "pizarra", x, y, clave: "C2", dashed: true,
      } as any);
      if (error) { toast.error(error.message); return; }
      await logClave(interviniente.indicativo_recurso, "C2");
    }
  }

  async function logClave(indicativo: string, clave: Clave) {
    if (!servicio) return;
    await supabase.from("claves_log").insert({
      servicio_id: servicio.id, indicativo_recurso: indicativo, clave, descripcion: CLAVE_DESCRIPCIONES[clave],
    } as any);
  }

  async function applyClave(sticker: Sticker, clave: Clave) {
    const inter = intervinientes.find(i => i.id === sticker.interviniente_id);
    if (!inter) return;
    const now = new Date().toISOString();
    let patch: any = {};
    switch (clave) {
      case "C0": patch = { clave: "C0", dashed: false }; break;
      case "C1": patch = { clave: "C1", dashed: false, removed: false }; break;
      case "C2": patch = { clave: "C2", dashed: true, c2_at: now }; break;
      case "C3": patch = { clave: "C3", dashed: false, c3_at: now }; break;
      case "C4": patch = { clave: "C4", removed: true }; break;
      case "C5": patch = { clave: "C5", removed: true }; break;
      case "C6": patch = { clave: "C6", removed: true }; break;
      case "C7": patch = { clave: "C7", removed: true }; break;
      default: break;
    }
    patch.updated_at = now;
    if (Object.keys(patch).length > 1) {
      await supabase.from("stickers").update(patch).eq("id", sticker.id);
    }
    await logClave(inter.indicativo_recurso, clave);
    setContextSticker(null);
  }

  async function moveSticker(sticker: Sticker, x: number, y: number) {
    const inter = intervinientes.find(i => i.id === sticker.interviniente_id);
    if (!inter) return;
    const now = new Date().toISOString();
    await supabase.from("stickers").update({ x, y, clave: "C2", dashed: true, c2_at: now, c3_at: null, updated_at: now } as any).eq("id", sticker.id);
    await logClave(inter.indicativo_recurso, "C2");
  }

  async function dropOnMap(intId: string, lat: number, lng: number) {
    if (!servicio) return;
    const interviniente = intervinientes.find(i => i.id === intId);
    if (!interviniente) return;
    const existing = stickers.find(s => s.interviniente_id === intId && s.panel === "mapa");
    const now = new Date().toISOString();
    if (existing) {
      await supabase.from("stickers").update({ lat, lng, clave: "C2", dashed: true, removed: false, c2_at: now, c3_at: null, updated_at: now } as any).eq("id", existing.id);
    } else {
      const { error } = await supabase.from("stickers").insert({
        servicio_id: servicio.id, interviniente_id: intId, panel: "mapa", x: 0, y: 0, lat, lng, clave: "C2", dashed: true,
      } as any);
      if (error) { toast.error(error.message); return; }
    }
    await logClave(interviniente.indicativo_recurso, "C2");
  }

  async function moveStickerMap(sticker: Sticker, lat: number, lng: number) {
    const inter = intervinientes.find(i => i.id === sticker.interviniente_id);
    if (!inter) return;
    const now = new Date().toISOString();
    await supabase.from("stickers").update({ lat, lng, clave: "C2", dashed: true, c2_at: now, c3_at: null, updated_at: now } as any).eq("id", sticker.id);
    await logClave(inter.indicativo_recurso, "C2");
  }

  async function createZona(puntos: { lat: number; lng: number }[], color: string) {
    if (!servicio) return;
    const c = color.toLowerCase();
    const nombre = c === "#dc2626" ? "Zona Caliente"
      : c === "#eab308" ? "Zona Templada"
      : c === "#16a34a" ? "Zona Fría"
      : `Zona ${zonas.length + 1}`;
    const { error } = await (supabase.from as any)("zonas").insert({
      servicio_id: servicio.id, nombre, color, puntos, created_by: session?.indicativo,
    });
    if (error) toast.error(error.message);
  }
  async function deleteZona(id: string) {
    await (supabase.from as any)("zonas").delete().eq("id", id);
  }

  // Trazos
  async function createTrazoMap(puntos: { lat: number; lng: number }[], color: string) {
    if (!servicio) return;
    await (supabase.from as any)("trazos").insert({
      servicio_id: servicio.id, panel: "mapa", color, puntos, created_by: session?.indicativo,
    });
  }
  async function createTrazoPizarra(puntos: { x: number; y: number }[], color: string) {
    if (!servicio) return;
    await (supabase.from as any)("trazos").insert({
      servicio_id: servicio.id, panel: "pizarra", color, puntos, created_by: session?.indicativo,
    });
  }
  async function deleteTrazo(id: string) {
    await (supabase.from as any)("trazos").delete().eq("id", id);
  }

  // Focos
  async function createFocoMap(lat: number, lng: number) {
    if (!servicio) return;
    await (supabase.from as any)("focos").insert({
      servicio_id: servicio.id, panel: "mapa", nombre: `Foco ${focos.filter(f => f.panel === "mapa").length + 1}`, info: "", lat, lng, x: 0, y: 0, created_by: session?.indicativo,
    });
  }
  async function createFocoPizarra(x: number, y: number) {
    if (!servicio) return;
    await (supabase.from as any)("focos").insert({
      servicio_id: servicio.id, panel: "pizarra", nombre: `Foco ${focos.filter(f => f.panel === "pizarra").length + 1}`, info: "", x, y, created_by: session?.indicativo,
    });
  }
  async function moveFocoMap(id: string, lat: number, lng: number) {
    await (supabase.from as any)("focos").update({ lat, lng, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function moveFocoPizarra(id: string, x: number, y: number) {
    await (supabase.from as any)("focos").update({ x, y, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function saveFoco(id: string, nombre: string, info: string) {
    await (supabase.from as any)("focos").update({ nombre, info, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function deleteFoco(id: string) {
    await (supabase.from as any)("focos").delete().eq("id", id);
  }

  async function finalizarServicio() {
    if (!servicio) return;
    await supabase.from("historial").insert({ numero: servicio.numero, resumen: { intervinientes: intervinientes.length, claves: logs.length } } as any);
    await supabase.from("servicios").update({ estado: "finalizado", finished_at: new Date().toISOString() } as any).eq("id", servicio.id);
    toast.success("Servicio finalizado");
    navigate({ to: "/main" });
  }

  if (loading || !servicio) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando servicio…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b bg-card flex items-center justify-between px-3 py-2 z-20">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/main" })}><ArrowLeft className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(s => !s)}>{sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</Button>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Servicio</div>
            <div className="font-mono text-xl font-bold text-primary leading-tight">#{servicio.numero}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded p-1">
          <button onClick={() => { setPanel("pizarra"); setTool("select"); }} className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded font-bold ${panel==="pizarra"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>
            <Square className="w-3 h-3 inline mr-1" />Pizarra
          </button>
          <button onClick={() => { setPanel("mapa"); setTool("select"); }} className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded font-bold ${panel==="mapa"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>
            <MapIcon className="w-3 h-3 inline mr-1" />Mapa
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Op.</div>
            <div className="font-mono text-sm font-bold">{session?.indicativo}</div>
          </div>
          {isMando && (
            <Button size="sm" variant="destructive" onClick={() => setFinalizeOpen(true)} className="uppercase tracking-wider"><AlertTriangle className="w-3.5 h-3.5 mr-1" />Finalizar</Button>
          )}
          <Button size="sm" variant="ghost" onClick={logout}>Salir</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? "Ocultar barra" : "Mostrar barra"}
          className="absolute top-1/2 -translate-y-1/2 z-[1500] bg-card border border-border rounded-r-md shadow-lg w-6 h-12 flex items-center justify-center hover:bg-accent"
          style={{ left: sidebarOpen ? "18rem" : 0 }}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {sidebarOpen && (
          <aside className="w-72 border-r bg-sidebar text-sidebar-foreground flex flex-col overflow-hidden">
            <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Intervinientes</div>
              {isMando && <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />Añadir</Button>}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {intervinientes.length === 0 && <div className="text-xs text-muted-foreground text-center p-4">Sin intervinientes registrados.</div>}
              {intervinientes.map(i => {
                const st = intStatus(i);
                const draggable = !st.blocked && !readonly;
                return (
                  <div key={i.id}
                    draggable={draggable}
                    onDragStart={e => { if (draggable) e.dataTransfer.setData("text/interviniente", i.id); }}
                    onClick={() => setEditInter(i)}
                    className={`group rounded border bg-card p-2 ${draggable?"cursor-grab hover:border-primary":"opacity-70"}`}>
                    <div className="flex items-start gap-2">
                      <StickerPreview interviniente={i} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm leading-tight truncate">{i.indicativo_recurso}</span>
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded text-black" style={{ background: FUNCION_COLORS[i.funcion] }}>{FUNCION_LABELS[i.funcion]}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{i.indicativo_intervinientes}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: st.dot }} />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{st.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        <div className="flex-1 relative overflow-hidden">
          {panel === "mapa" ? (
            <MapPanel
              servicioId={servicio.id}
              intervinientes={intervinientes}
              stickers={stickers}
              zonas={zonas}
              trazos={trazos}
              focos={focos}
              isMando={isMando && !readonly}
              readonly={readonly}
              currentIndicativo={session?.indicativo ?? ""}
              onDropSticker={dropOnMap}
              onMoveSticker={moveStickerMap}
              onContextSticker={(s, x, y) => { setContextSticker(s); setContextPos({ x, y }); }}
              onCreateZona={createZona}
              onDeleteZona={deleteZona}
              onCreateTrazo={createTrazoMap}
              onDeleteTrazo={deleteTrazo}
              onCreateFoco={createFocoMap}
              onMoveFoco={moveFocoMap}
              onDeleteFoco={deleteFoco}
              onOpenFoco={(f) => setEditFoco(f)}
            />
          ) : (
            <PizarraBoard
              boardRef={boardRef}
              stickers={stickers}
              intervinientes={intervinientes}
              trazos={pizarraTrazos}
              focos={pizarraFocos}
              tool={readonly ? "select" : tool}
              penColor={penColor}
              onDrop={readonly ? (e) => e.preventDefault() : handleDrop}
              onMoveSticker={moveSticker}
              onContextSticker={(s, x, y) => { if (!readonly) { setContextSticker(s); setContextPos({ x, y }); } }}
              onOpenInter={(i) => setEditInter(i)}
              onCreateTrazo={createTrazoPizarra}
              onDeleteTrazo={deleteTrazo}
              onCreateFoco={createFocoPizarra}
              onMoveFoco={moveFocoPizarra}
              onDeleteFoco={deleteFoco}
              onOpenFoco={(f) => setEditFoco(f)}
              numero={servicio.numero}
              readonly={readonly}
            />
          )}

          {/* Toolbar pizarra */}
          {panel === "pizarra" && !readonly && (
            <div className="absolute top-3 left-3 z-30 bg-card border rounded-md shadow-xl p-2 flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <ToolBtn active={tool === "select"} onClick={() => setTool("select")} title="Seleccionar"><MousePointer2 className="w-3.5 h-3.5" /></ToolBtn>
                <ToolBtn active={tool === "pencil"} onClick={() => setTool("pencil")} title="Lápiz"><Pen className="w-3.5 h-3.5" /></ToolBtn>
                <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} title="Goma"><Eraser className="w-3.5 h-3.5" /></ToolBtn>
                <ToolBtn active={false} onClick={() => {
                  if (!boardRef.current) return;
                  const r = boardRef.current.getBoundingClientRect();
                  createFocoPizarra(r.width / 2, r.height / 2);
                }} title="Añadir foco"><Flame className="w-3.5 h-3.5 text-red-500" /></ToolBtn>
              </div>
              {tool === "pencil" && (
                <div className="flex items-center gap-1">
                  {TRAZO_COLORS.map(c => (
                    <button key={c} onClick={() => setPenColor(c)} className={`w-5 h-5 rounded border-2 ${penColor === c ? "border-primary" : "border-transparent"}`} style={{ background: c }} />
                  ))}
                </div>
              )}
              {tool === "eraser" && <div className="text-[10px] text-muted-foreground">Clic en trazo/foco para borrar</div>}
            </div>
          )}

          {readonly && (
            <div className="absolute top-3 left-3 z-30 bg-card/80 border rounded-md shadow-xl px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Modo solo lectura · Voluntario
            </div>
          )}

          {contextSticker && contextPos && (
            <ClaveMenu
              x={contextPos.x} y={contextPos.y}
              onClose={() => setContextSticker(null)}
              onPick={(c) => applyClave(contextSticker, c)}
              onEdit={() => { const i = intervinientes.find(x => x.id === contextSticker.interviniente_id); if (i) setEditInter(i); setContextSticker(null); }}
            />
          )}

          <div className={`absolute bottom-3 right-3 w-80 max-w-[calc(100%-1.5rem)] bg-card border rounded shadow-xl flex flex-col ${logOpen ? "h-64" : "h-9"} transition-all z-30`}>
            <button onClick={() => setLogOpen(o => !o)} className="flex items-center justify-between px-3 py-2 border-b text-xs uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-2"><ScrollText className="w-3.5 h-3.5" />Registro de movimientos ({logs.length})</span>
              {logOpen ? <ChevronRight className="w-3 h-3 rotate-90"/> : <ChevronRight className="w-3 h-3 -rotate-90"/>}
            </button>
            {logOpen && (
              <div className="flex-1 overflow-y-auto font-mono text-[11px] p-2 space-y-0.5">
                {logs.length === 0 && <div className="text-muted-foreground text-center p-3">Sin movimientos.</div>}
                {logs.map(l => (
                  <div key={l.id} className="flex gap-2">
                    <span className="text-muted-foreground">[{new Date(l.created_at).toLocaleTimeString("es-ES",{hour12:false})}]</span>
                    <span className="font-bold text-primary">{l.indicativo_recurso}</span>
                    <span className="text-foreground">→ {l.clave}: {l.descripcion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AddIntervinienteDialog open={addOpen} onOpenChange={setAddOpen} servicioId={servicio.id} existentes={intervinientes} />

      <Sheet open={!!editInter} onOpenChange={(o) => !o && setEditInter(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Interviniente</SheetTitle></SheetHeader>
          {editInter && (
            <IntervinienteEditor inter={editInter} stickers={stickers.filter(s => s.interviniente_id === editInter.id)} logs={logs.filter(l => l.indicativo_recurso === editInter.indicativo_recurso)} canEdit={isMando} onSaved={() => setEditInter(null)} />
          )}
        </SheetContent>
      </Sheet>

      <FocoDialog foco={editFoco} onClose={() => setEditFoco(null)} onSave={saveFoco} onDelete={deleteFoco} canEdit={true} />

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finalizar servicio</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esto cerrará la pizarra para todos los participantes. La generación de PDF y envío por email se habilitarán en la siguiente fase.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={finalizarServicio}>Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode; }) {
  return (
    <button onClick={onClick} title={title} className={`w-8 h-8 flex items-center justify-center rounded border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:bg-accent"}`}>
      {children}
    </button>
  );
}

function PizarraBoard({
  boardRef, stickers, intervinientes, trazos, focos, tool, penColor, numero,
  onDrop, onMoveSticker, onContextSticker, onOpenInter,
  onCreateTrazo, onDeleteTrazo, onCreateFoco, onMoveFoco, onDeleteFoco, onOpenFoco, readonly,
}: {
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  stickers: Sticker[]; intervinientes: Interviniente[]; trazos: Trazo[]; focos: Foco[];
  tool: Tool; penColor: string; numero: number;
  onDrop: (e: React.DragEvent) => void;
  onMoveSticker: (s: Sticker, x: number, y: number) => void;
  onContextSticker: (s: Sticker, x: number, y: number) => void;
  onOpenInter: (i: Interviniente) => void;
  onCreateTrazo: (pts: { x: number; y: number }[], color: string) => void;
  onDeleteTrazo: (id: string) => void;
  onCreateFoco: (x: number, y: number) => void;
  onMoveFoco: (id: string, x: number, y: number) => void;
  onDeleteFoco: (id: string) => void;
  onOpenFoco: (f: Foco) => void;
  readonly?: boolean;
}) {
  const [stroke, setStroke] = useState<{ x: number; y: number }[]>([]);
  const drawing = useRef(false);

  function pointerDown(e: React.PointerEvent) {
    if (tool !== "pencil") return;
    e.preventDefault();
    drawing.current = true;
    const r = boardRef.current!.getBoundingClientRect();
    setStroke([{ x: e.clientX - r.left, y: e.clientY - r.top }]);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const r = boardRef.current!.getBoundingClientRect();
    setStroke(prev => [...prev, { x: e.clientX - r.left, y: e.clientY - r.top }]);
  }
  function pointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    setStroke(prev => {
      if (prev.length >= 2) onCreateTrazo(prev, penColor);
      return [];
    });
  }

  const interactive = tool === "pencil" || tool === "eraser";

  return (
    <div
      ref={boardRef}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      className="absolute inset-0 pizarra-bg overflow-hidden"
      style={{ cursor: tool === "pencil" ? "crosshair" : tool === "eraser" ? "cell" : undefined }}
    >
      {/* SVG layer for trazos + pencil capture */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: interactive ? "auto" : "none" }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
      >
        {trazos.map(t => {
          const pts = (t.puntos as any[]).filter(p => p.x != null && p.y != null);
          if (pts.length < 2) return null;
          const d = "M " + pts.map(p => `${p.x},${p.y}`).join(" L ");
          return (
            <g key={t.id}>
              <path
                d={d}
                stroke={t.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{ pointerEvents: "none" }}
              />
              {tool === "eraser" && (
                <path
                  d={d}
                  stroke="rgba(0,0,0,0.001)"
                  strokeWidth={24}
                  strokeLinecap="round"
                  fill="none"
                  style={{ cursor: "pointer", pointerEvents: "stroke" }}
                  onPointerDown={(e) => { e.stopPropagation(); onDeleteTrazo(t.id); }}
                />
              )}
            </g>
          );
        })}
        {stroke.length > 1 && (
          <path d={"M " + stroke.map(p => `${p.x},${p.y}`).join(" L ")} stroke={penColor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        )}
      </svg>

      {/* Focos */}
      {focos.map(f => (
        <FocoSticker key={f.id} foco={f} tool={tool} boardRef={boardRef} onMove={(x, y) => onMoveFoco(f.id, x, y)} onOpen={() => onOpenFoco(f)} onDelete={() => onDeleteFoco(f.id)} />
      ))}

      {/* Intervinientes stickers */}
      {stickers.filter(s => s.panel === "pizarra" && !s.removed).map(s => {
        const i = intervinientes.find(x => x.id === s.interviniente_id);
        if (!i) return null;
        return <StickerOnBoard key={s.id} sticker={s} interviniente={i}
          onMove={(x,y) => onMoveSticker(s, x, y)}
          onContext={(x,y) => onContextSticker(s, x, y)}
          onOpen={() => onOpenInter(i)}
          disabled={tool !== "select" || readonly}
        />;
      })}

      <div className="absolute bottom-4 left-4 text-xs text-black/30 font-mono uppercase tracking-widest pointer-events-none">SITAC · #{numero}</div>
    </div>
  );
}

function FocoSticker({ foco, tool, boardRef, onMove, onOpen, onDelete }: {
  foco: Foco; tool: Tool;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  onMove: (x: number, y: number) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<{ ox: number; oy: number; moved: boolean } | null>(null);

  function pd(e: React.PointerEvent) {
    if (e.button !== 0 || tool !== "select") return;
    const rect = ref.current!.getBoundingClientRect();
    dragging.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top, moved: false };
    ref.current!.setPointerCapture(e.pointerId);
  }
  function pm(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current.moved = true;
    const board = boardRef.current!.getBoundingClientRect();
    const x = e.clientX - board.left - dragging.current.ox;
    const y = e.clientY - board.top - dragging.current.oy;
    ref.current!.style.left = x + "px";
    ref.current!.style.top = y + "px";
  }
  function pu(e: React.PointerEvent) {
    const d = dragging.current; dragging.current = null;
    if (!d) return;
    if (d.moved) {
      const board = boardRef.current!.getBoundingClientRect();
      const x = e.clientX - board.left - d.ox;
      const y = e.clientY - board.top - d.oy;
      onMove(Math.max(0, x), Math.max(0, y));
    }
  }

  return (
    <div
      ref={ref}
      style={{ position: "absolute", left: foco.x, top: foco.y, width: 48, height: 60, userSelect: "none", cursor: tool === "select" ? "grab" : tool === "eraser" ? "pointer" : undefined }}
      onPointerDown={pd}
      onPointerMove={pm}
      onPointerUp={pu}
      onDoubleClick={onOpen}
      onClick={() => { if (tool === "eraser") onDelete(); }}
      title={foco.nombre}
    >
      <svg viewBox="0 0 64 64" width={48} height={48} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }}>
        <polygon points="32,2 38,20 56,14 44,30 62,36 42,40 50,58 32,46 14,58 22,40 2,36 20,30 8,14 26,20" fill="#dc2626" stroke="#000" strokeWidth={2} strokeLinejoin="round"/>
        <circle cx={32} cy={32} r={8} fill="#7f1d1d" stroke="#000" strokeWidth={1.5}/>
      </svg>
      <div style={{ position: "absolute", left: "50%", top: 48, transform: "translateX(-50%)", background: "#000", color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 2, whiteSpace: "nowrap" }}>
        {foco.nombre}
      </div>
    </div>
  );
}

function FocoDialog({ foco, onClose, onSave, onDelete, canEdit }: {
  foco: Foco | null; onClose: () => void;
  onSave: (id: string, nombre: string, info: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canEdit: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [info, setInfo] = useState("");
  useEffect(() => { if (foco) { setNombre(foco.nombre); setInfo(foco.info); } }, [foco]);
  if (!foco) return null;
  return (
    <Dialog open={!!foco} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Flame className="w-4 h-4 text-red-500" />Foco</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input value={nombre} disabled={!canEdit} onChange={e => setNombre(e.target.value)} /></div>
          <div><Label>Información</Label><Textarea value={info} disabled={!canEdit} onChange={e => setInfo(e.target.value)} rows={6} placeholder="Detalles del foco, riesgos, recursos asignados…" /></div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {canEdit ? (
            <Button variant="destructive" size="sm" onClick={async () => { if (confirm("¿Eliminar foco?")) { await onDelete(foco.id); onClose(); } }}><Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            {canEdit && <Button onClick={async () => { await onSave(foco.id, nombre.trim() || "Foco", info); onClose(); }}>Guardar</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function upsertOrDelete<T extends { id: string }>(prev: T[], p: any): T[] {
  if (p.eventType === "DELETE") return prev.filter(x => x.id !== (p.old as any).id);
  const row = p.new as T;
  const idx = prev.findIndex(x => x.id === row.id);
  if (idx === -1) return [...prev, row];
  const next = [...prev]; next[idx] = row; return next;
}

function StickerPreview({ interviniente }: { interviniente: Interviniente }) {
  const color = FUNCION_COLORS[interviniente.funcion];
  const isCircle = interviniente.tipo === "pie";
  const style: CSSProperties = { background: color, color: "#000", border: "2px solid #000" };
  return (
    <div className={`flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 ${isCircle ? "rounded-full w-9 h-9" : "rounded w-10 h-7"}`} style={style}>
      {interviniente.indicativo_recurso.slice(0, 4)}
    </div>
  );
}

function StickerOnBoard({ sticker, interviniente, onMove, onContext, onOpen, disabled }: {
  sticker: Sticker; interviniente: Interviniente;
  onMove: (x: number, y: number) => void;
  onContext: (x: number, y: number) => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const color = FUNCION_COLORS[interviniente.funcion];
  const isCircle = interviniente.tipo === "pie";
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<{ ox: number; oy: number; moved: boolean } | null>(null);
  const blocked = sticker.clave === "C0" || disabled;

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (blocked) return;
    const el = ref.current!;
    const rect = el.getBoundingClientRect();
    dragging.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top, moved: false };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current.moved = true;
    const board = ref.current!.parentElement!.getBoundingClientRect();
    const x = e.clientX - board.left - dragging.current.ox;
    const y = e.clientY - board.top - dragging.current.oy;
    ref.current!.style.left = x + "px";
    ref.current!.style.top = y + "px";
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = dragging.current; dragging.current = null;
    if (!d) return;
    if (d.moved) {
      const board = ref.current!.parentElement!.getBoundingClientRect();
      const x = e.clientX - board.left - d.ox;
      const y = e.clientY - board.top - d.oy;
      onMove(Math.max(0, x), Math.max(0, y));
    }
  }

  return (
    <div
      ref={ref}
      className={`sticker ${isCircle ? "circle" : "rect"} ${sticker.dashed ? "dashed" : ""} ${sticker.clave === "C0" ? "c0" : ""}`}
      style={{ left: sticker.x, top: sticker.y, background: color }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => { e.preventDefault(); const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); onContext(e.clientX - r.left, e.clientY - r.top); }}
      onDoubleClick={(e) => { const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); onContext(e.clientX - r.left, e.clientY - r.top); }}
    >
      {interviniente.indicativo_recurso}
    </div>
  );
}

function ClaveMenu({ x, y, onClose, onPick, onEdit }: { x: number; y: number; onClose: () => void; onPick: (c: Clave) => void; onEdit: () => void; }) {
  return (
    <>
      <div className="absolute inset-0 z-[2000]" onClick={onClose} />
      <div className="absolute z-[2001] bg-popover text-popover-foreground border rounded-md shadow-2xl py-1 w-56 text-sm" style={{ left: Math.min(x, window.innerWidth - 240), top: Math.min(y, window.innerHeight - 400) }}>
        <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Claves visuales</div>
        {CLAVES_VISUALES.map(c => (
          <button key={c} onClick={() => onPick(c)} className="w-full text-left px-3 py-1.5 hover:bg-accent flex justify-between"><span className="font-mono font-bold">{c}</span><span className="text-muted-foreground text-xs">{CLAVE_DESCRIPCIONES[c]}</span></button>
        ))}
        <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground border-t mt-1">Claves de registro</div>
        <div className="max-h-44 overflow-y-auto">
          {CLAVES_LOG.map(c => (
            <button key={c} onClick={() => onPick(c)} className="w-full text-left px-3 py-1.5 hover:bg-accent flex justify-between"><span className="font-mono font-bold">{c}</span><span className="text-muted-foreground text-xs truncate ml-2">{CLAVE_DESCRIPCIONES[c]}</span></button>
          ))}
        </div>
        <div className="border-t mt-1">
          <button onClick={onEdit} className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"><FileText className="w-3.5 h-3.5" />Ver / Editar información</button>
        </div>
      </div>
    </>
  );
}

function AddIntervinienteDialog({ open, onOpenChange, servicioId, existentes }:
  { open: boolean; onOpenChange: (o: boolean) => void; servicioId: string; existentes: Interviniente[] }) {
  const [recurso, setRecurso] = useState("");
  const [personas, setPersonas] = useState("");
  const [tipo, setTipo] = useState<Tipo>("vehiculo");
  const [funcion, setFuncion] = useState<Funcion>("rescate");
  const [subtipo, setSubtipo] = useState<string>("ambulancia");

  async function submit() {
    const r = recurso.trim().toUpperCase();
    const p = personas.trim().toUpperCase();
    if (!r || !p) { toast.error("Indica recurso e intervinientes"); return; }
    if (existentes.some(i => i.indicativo_recurso === r)) { toast.error("Indicativo de recurso ya usado"); return; }
    if (existentes.some(i => i.indicativo_intervinientes === p)) { toast.error("Indicativo de intervinientes ya usado"); return; }
    const sub = funcion === "sanitario" && tipo === "vehiculo" ? subtipo : null;
    const { error } = await supabase.from("intervinientes").insert({
      servicio_id: servicioId, indicativo_recurso: r, indicativo_intervinientes: p, tipo, funcion, subtipo: sub,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Interviniente añadido");
    setRecurso(""); setPersonas(""); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo interviniente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Indicativo del recurso</Label><Input value={recurso} onChange={e => setRecurso(e.target.value)} className="font-mono uppercase" placeholder="Ej: RIV-01" /></div>
          <div><Label>Indicativo de los intervinientes</Label><Input value={personas} onChange={e => setPersonas(e.target.value)} className="font-mono uppercase" placeholder="Ej: B01-B02" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vehiculo">Vehículo</SelectItem>
                  <SelectItem value="pie">Equipo a pie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Función</Label>
              <Select value={funcion} onValueChange={v => setFuncion(v as Funcion)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FUNCION_LABELS) as Funcion[]).map(f => <SelectItem key={f} value={f}>{FUNCION_LABELS[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {funcion === "sanitario" && tipo === "vehiculo" && (
            <div>
              <Label>Subtipo sanitario</Label>
              <Select value={subtipo} onValueChange={setSubtipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambulancia">Ambulancia</SelectItem>
                  <SelectItem value="cardio">Vehículo cardioprotegido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Añadir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IntervinienteEditor({ inter, stickers, logs, canEdit, onSaved }: {
  inter: Interviniente; stickers: Sticker[]; logs: any[]; canEdit: boolean; onSaved: () => void;
}) {
  const [recurso, setRecurso] = useState(inter.indicativo_recurso);
  const [personas, setPersonas] = useState(inter.indicativo_intervinientes);
  const [funcion, setFuncion] = useState<Funcion>(inter.funcion);
  const [tipo, setTipo] = useState<Tipo>(inter.tipo);

  async function save() {
    if (!canEdit) return;
    const { error } = await supabase.from("intervinientes").update({
      indicativo_recurso: recurso.trim().toUpperCase(),
      indicativo_intervinientes: personas.trim().toUpperCase(),
      funcion, tipo,
    } as any).eq("id", inter.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    onSaved();
  }
  async function remove() {
    if (!canEdit) return;
    if (!confirm("¿Eliminar interviniente?")) return;
    await supabase.from("intervinientes").delete().eq("id", inter.id);
    onSaved();
  }

  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Recurso</Label><Input value={recurso} disabled={!canEdit} onChange={e => setRecurso(e.target.value)} className="font-mono uppercase" /></div>
        <div><Label>Intervinientes</Label><Input value={personas} disabled={!canEdit} onChange={e => setPersonas(e.target.value)} className="font-mono uppercase" /></div>
        <div>
          <Label>Función</Label>
          <Select value={funcion} disabled={!canEdit} onValueChange={v => setFuncion(v as Funcion)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(FUNCION_LABELS) as Funcion[]).map(f => <SelectItem key={f} value={f}>{FUNCION_LABELS[f]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} disabled={!canEdit} onValueChange={v => setTipo(v as Tipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vehiculo">Vehículo</SelectItem>
              <SelectItem value="pie">Equipo a pie</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Timestamps</div>
        {stickers.length === 0 && <div className="text-muted-foreground text-xs">Sin colocaciones.</div>}
        {stickers.map(s => (
          <div key={s.id} className="border rounded p-2 mb-2 font-mono text-xs">
            <div className="flex justify-between"><span>{s.panel.toUpperCase()}</span><span className="text-primary font-bold">{s.clave}</span></div>
            {s.c2_at && <div>C2: {new Date(s.c2_at).toLocaleString("es-ES")}</div>}
            {s.c3_at && <div>C3: {new Date(s.c3_at).toLocaleString("es-ES")}</div>}
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Historial de claves</div>
        <div className="max-h-48 overflow-y-auto font-mono text-[11px] space-y-0.5">
          {logs.length === 0 && <div className="text-muted-foreground">Sin registros.</div>}
          {logs.map(l => (
            <div key={l.id} className="flex gap-2">
              <span className="text-muted-foreground">[{new Date(l.created_at).toLocaleTimeString("es-ES",{hour12:false})}]</span>
              <span className="font-bold text-primary">{l.clave}</span>
              <span>{l.descripcion}</span>
            </div>
          ))}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={save} className="flex-1">Guardar</Button>
          <Button variant="destructive" onClick={remove} size="icon"><X className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
