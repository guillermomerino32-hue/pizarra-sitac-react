import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FUNCION_COLORS, RIVAS_CENTER, RIVAS_ZOOM, TRAZO_COLORS, ZONA_COLORS, type Foco, type Interviniente, type Sticker, type Trazo, type Zona } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Trash2, Pen, MousePointer2, Flame, Eraser } from "lucide-react";

type Tool = "select" | "pencil" | "zone" | "eraser";

interface Props {
  servicioId: string;
  intervinientes: Interviniente[];
  stickers: Sticker[];
  zonas: Zona[];
  trazos: Trazo[];
  focos: Foco[];
  isMando: boolean;
  currentIndicativo: string;
  readonly?: boolean;
  onDropSticker: (intId: string, lat: number, lng: number) => void;
  onMoveSticker: (sticker: Sticker, lat: number, lng: number) => void;
  onContextSticker: (sticker: Sticker, x: number, y: number) => void;
  onCreateZona: (puntos: { lat: number; lng: number }[], color: string) => void;
  onDeleteZona: (id: string) => void;
  onCreateTrazo: (puntos: { lat: number; lng: number }[], color: string) => void;
  onDeleteTrazo: (id: string) => void;
  onCreateFoco: (lat: number, lng: number) => void;
  onMoveFoco: (id: string, lat: number, lng: number) => void;
  onDeleteFoco: (id: string) => void;
  onOpenFoco: (foco: Foco) => void;
}

function stickerIcon(inter: Interviniente, sticker: Sticker) {
  const color = FUNCION_COLORS[inter.funcion];
  const isCircle = inter.tipo === "pie";
  const dashed = sticker.dashed ? "border-style:dashed;" : "border-style:solid;";
  const c0 = sticker.clave === "C0" ? "filter:grayscale(1) brightness(0.6);" : "";
  const shape = isCircle
    ? `border-radius:9999px;width:52px;height:52px;`
    : `border-radius:4px;min-width:56px;min-height:36px;padding:4px 8px;`;
  const html = `<div style="background:${color};color:#000;border:2px solid #000;${dashed}${shape}${c0}display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.5);">${inter.indicativo_recurso}</div>`;
  return L.divIcon({ html, className: "sitac-marker", iconSize: [60, 40], iconAnchor: [30, 20] });
}

function focoIcon(foco: Foco) {
  const html = `<div title="${foco.nombre}" style="position:relative;width:48px;height:48px;">
    <svg viewBox="0 0 64 64" width="48" height="48" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));">
      <polygon points="32,2 38,20 56,14 44,30 62,36 42,40 50,58 32,46 14,58 22,40 2,36 20,30 8,14 26,20" fill="#dc2626" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="8" fill="#7f1d1d" stroke="#000" stroke-width="1.5"/>
    </svg>
    <div style="position:absolute;left:50%;top:100%;transform:translate(-50%,4px);background:#000;color:#fff;font-family:JetBrains Mono,monospace;font-size:10px;font-weight:700;padding:1px 4px;border-radius:2px;white-space:nowrap;">${foco.nombre}</div>
  </div>`;
  return L.divIcon({ html, className: "sitac-foco", iconSize: [48, 60], iconAnchor: [24, 24] });
}

function DrawHandler({ tool, onPoint, onFinish, onStrokePoint, onStrokeEnd, onErasePoint }: {
  tool: Tool;
  onPoint: (ll: { lat: number; lng: number }) => void;
  onFinish: () => void;
  onStrokePoint: (ll: { lat: number; lng: number }) => void;
  onStrokeEnd: () => void;
  onErasePoint: (ll: { lat: number; lng: number }) => void;
}) {
  const drawingStroke = useRef(false);
  const erasingStroke = useRef(false);
  useMapEvents({
    click(e) {
      if (tool === "zone") onPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    dblclick() { if (tool === "zone") onFinish(); },
    mousedown(e) {
      if (tool === "eraser") {
        erasingStroke.current = true;
        onErasePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
      if (tool === "pencil") {
        drawingStroke.current = true;
        onStrokePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    mousemove(e) {
      if (tool === "eraser" && erasingStroke.current) {
        onErasePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
      if (tool === "pencil" && drawingStroke.current) {
        onStrokePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    mouseup() {
      if (tool === "eraser") erasingStroke.current = false;
      if (tool === "pencil" && drawingStroke.current) {
        drawingStroke.current = false;
        onStrokeEnd();
      }
    },
  });
  return null;
}

function MapRefBridge({ mapRef, dragging }: { mapRef: React.MutableRefObject<L.Map | null>; dragging: boolean; }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  useEffect(() => {
    if (dragging) { map.dragging.disable(); }
    else { map.dragging.enable(); }
  }, [map, dragging]);
  return null;
}

export default function MapPanel({
  intervinientes, stickers, zonas, trazos, focos, isMando, readonly,
  onDropSticker, onMoveSticker, onContextSticker, onCreateZona, onDeleteZona,
  onCreateTrazo, onDeleteTrazo, onCreateFoco, onMoveFoco, onDeleteFoco, onOpenFoco,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [draftPoints, setDraftPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [strokePts, setStrokePts] = useState<{ lat: number; lng: number }[]>([]);
  const [drawColor, setDrawColor] = useState(ZONA_COLORS[0]);
  const [penColor, setPenColor] = useState(TRAZO_COLORS[1]);
  const [baseLayer, setBaseLayer] = useState<"dark" | "sat">("dark");

  const visibleStickers = useMemo(() => stickers.filter(s => s.panel === "mapa" && !s.removed && s.lat != null && s.lng != null), [stickers]);
  const mapTrazos = useMemo(() => trazos.filter(t => t.panel === "mapa"), [trazos]);
  const mapFocos = useMemo(() => focos.filter(f => f.panel === "mapa" && f.lat != null && f.lng != null), [focos]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (readonly) return;
    const intId = e.dataTransfer.getData("text/interviniente");
    if (!intId || !mapRef.current || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
    const ll = mapRef.current.containerPointToLatLng(point);
    onDropSticker(intId, ll.lat, ll.lng);
  }

  function zonaNameForColor(color: string) {
    const c = color.toLowerCase();
    if (c === "#dc2626") return "Zona Caliente";
    if (c === "#eab308") return "Zona Templada";
    if (c === "#16a34a") return "Zona Fría";
    return `Zona ${zonas.length + 1}`;
  }

  function finishZone() {
    if (draftPoints.length >= 3) onCreateZona(draftPoints, drawColor);
    setDraftPoints([]);
    setTool("select");
  }

  function onStrokePoint(p: { lat: number; lng: number }) {
    setStrokePts(prev => [...prev, p]);
  }
  function onStrokeEnd() {
    setStrokePts(prev => {
      if (prev.length >= 2) onCreateTrazo(prev, penColor);
      return [];
    });
  }

  function handleMapClick(e: React.MouseEvent) {
    if (tool !== "select") return;
    // foco placement removed; foco via toolbar button at map center
  }

  function addFocoAtCenter() {
    if (!mapRef.current) return;
    const c = mapRef.current.getCenter();
    onCreateFoco(c.lat, c.lng);
  }

  const drawing = tool === "pencil" || tool === "zone";

  return (
    <div ref={wrapRef} className="relative h-full w-full" onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={handleMapClick}>
      <MapContainer center={RIVAS_CENTER} zoom={RIVAS_ZOOM} className="h-full w-full" doubleClickZoom={tool !== "zone"} style={{ background: "#0a0a0a", cursor: drawing ? "crosshair" : undefined }}>
        <MapRefBridge mapRef={mapRef} dragging={drawing} />
        {baseLayer === "dark" ? (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
        ) : (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri'
          />
        )}
        <DrawHandler tool={tool} onPoint={p => setDraftPoints(prev => [...prev, p])} onFinish={finishZone} onStrokePoint={onStrokePoint} onStrokeEnd={onStrokeEnd} />

        {zonas.map(z => (
          <Polygon key={z.id} positions={z.puntos.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.18, weight: 2 }}
            eventHandlers={{
              dblclick: () => { if (!readonly && isMando && confirm(`¿Eliminar ${z.nombre}?`)) onDeleteZona(z.id); },
            }} />
        ))}

        {mapTrazos.map(t => (
          <Polyline key={t.id} positions={(t.puntos as any[]).map(p => [p.lat, p.lng]) as any}
            pathOptions={{ color: t.color, weight: 3, opacity: 0.9 }}
            eventHandlers={{
              dblclick: () => { if (!readonly && confirm("¿Eliminar este trazo?")) onDeleteTrazo(t.id); },
            }} />
        ))}

        {tool === "zone" && draftPoints.length > 0 && (
          <>
            <Polyline positions={draftPoints.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: drawColor, weight: 2, dashArray: "4 4" }} />
            {draftPoints.map((p, i) => (
              <Marker key={i} position={[p.lat, p.lng]} icon={L.divIcon({ html: `<div style="width:8px;height:8px;background:${drawColor};border:2px solid #fff;border-radius:50%;"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] })} />
            ))}
          </>
        )}
        {tool === "pencil" && strokePts.length > 1 && (
          <Polyline positions={strokePts.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: penColor, weight: 3, dashArray: "2 4" }} />
        )}

        {mapFocos.map(f => (
          <Marker key={f.id} position={[f.lat!, f.lng!]} icon={focoIcon(f)} draggable={tool === "select" && !readonly}
            eventHandlers={{
              dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onMoveFoco(f.id, ll.lat, ll.lng); },
              dblclick: () => onOpenFoco(f),
            }} />
        ))}

        {visibleStickers.map(s => {
          const inter = intervinientes.find(i => i.id === s.interviniente_id);
          if (!inter) return null;
          return (
            <Marker
              key={s.id}
              position={[s.lat!, s.lng!]}
              draggable={!readonly && s.clave !== "C0" && tool === "select"}
              icon={stickerIcon(inter, s)}
              eventHandlers={{
                dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onMoveSticker(s, ll.lat, ll.lng); },
                contextmenu: (e) => {
                  if (readonly) return;
                  const oe = (e as any).originalEvent as MouseEvent;
                  const rect = wrapRef.current!.getBoundingClientRect();
                  onContextSticker(s, oe.clientX - rect.left, oe.clientY - rect.top);
                },
                dblclick: (e) => {
                  if (readonly) return;
                  const oe = (e as any).originalEvent as MouseEvent;
                  const rect = wrapRef.current!.getBoundingClientRect();
                  onContextSticker(s, oe.clientX - rect.left, oe.clientY - rect.top);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] bg-card border rounded-md shadow-xl p-2 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {!readonly && <>
            <ToolBtn active={tool === "select"} onClick={() => { setTool("select"); setDraftPoints([]); }} title="Seleccionar"><MousePointer2 className="w-3.5 h-3.5" /></ToolBtn>
            <ToolBtn active={tool === "pencil"} onClick={() => { setTool("pencil"); setDraftPoints([]); }} title="Lápiz"><Pen className="w-3.5 h-3.5" /></ToolBtn>
            {isMando && <ToolBtn active={tool === "zone"} onClick={() => { setTool("zone"); setDraftPoints([]); }} title="Dibujar zona"><Pencil className="w-3.5 h-3.5" /></ToolBtn>}
            <ToolBtn active={false} onClick={addFocoAtCenter} title="Añadir foco"><Flame className="w-3.5 h-3.5 text-red-500" /></ToolBtn>
          </>}
          <button onClick={() => setBaseLayer(b => b === "dark" ? "sat" : "dark")} title="Cambiar capa" className="ml-1 px-2 h-8 text-[10px] font-bold uppercase tracking-wider rounded border bg-secondary border-border hover:bg-accent">
            {baseLayer === "dark" ? "SAT" : "MAPA"}
          </button>
        </div>
        {tool === "pencil" && (
          <div className="flex items-center gap-1">
            {TRAZO_COLORS.map(c => (
              <button key={c} onClick={() => setPenColor(c)} className={`w-5 h-5 rounded border-2 ${penColor === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        )}
        {tool === "zone" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {ZONA_COLORS.map(c => (
                <button key={c} onClick={() => setDrawColor(c)} className={`w-5 h-5 rounded border-2 ${drawColor === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{draftPoints.length} pts · 2× clic cierra</span>
            <Button size="sm" variant="default" onClick={finishZone} disabled={draftPoints.length < 3}><Check className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setTool("select"); setDraftPoints([]); }}><X className="w-3.5 h-3.5" /></Button>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">Doble clic en trazo / zona / foco para editarlo o borrarlo</div>
      </div>

      {/* Zones list */}
      {zonas.length > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-card border rounded-md shadow-xl p-2 max-w-[200px]">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Zonas ({zonas.length})</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {zonas.map(z => (
              <div key={z.id} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded" style={{ background: z.color }} />
                <span className="flex-1 truncate">{z.nombre}</span>
                {isMando && (
                  <button onClick={() => onDeleteZona(z.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
