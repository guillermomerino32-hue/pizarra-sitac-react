import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FUNCION_COLORS, RIVAS_CENTER, RIVAS_ZOOM, ZONA_COLORS, type Interviniente, type Sticker, type Zona } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Trash2 } from "lucide-react";

interface Props {
  servicioId: string;
  intervinientes: Interviniente[];
  stickers: Sticker[];
  zonas: Zona[];
  isMando: boolean;
  currentIndicativo: string;
  onDropSticker: (intId: string, lat: number, lng: number) => void;
  onMoveSticker: (sticker: Sticker, lat: number, lng: number) => void;
  onContextSticker: (sticker: Sticker, x: number, y: number) => void;
  onCreateZona: (puntos: { lat: number; lng: number }[], color: string) => void;
  onDeleteZona: (id: string) => void;
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

function DrawHandler({ active, onPoint, onFinish }: { active: boolean; onPoint: (ll: { lat: number; lng: number }) => void; onFinish: () => void; }) {
  useMapEvents({
    click(e) { if (active) onPoint({ lat: e.latlng.lat, lng: e.latlng.lng }); },
    dblclick() { if (active) onFinish(); },
  });
  return null;
}

function MapRefBridge({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

export default function MapPanel({
  intervinientes, stickers, zonas, isMando,
  onDropSticker, onMoveSticker, onContextSticker, onCreateZona, onDeleteZona,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [drawColor, setDrawColor] = useState(ZONA_COLORS[0]);

  const visibleStickers = useMemo(() => stickers.filter(s => s.panel === "mapa" && !s.removed && s.lat != null && s.lng != null), [stickers]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const intId = e.dataTransfer.getData("text/interviniente");
    if (!intId || !mapRef.current || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
    const ll = mapRef.current.containerPointToLatLng(point);
    onDropSticker(intId, ll.lat, ll.lng);
  }

  function finishDraw() {
    if (draftPoints.length >= 3) onCreateZona(draftPoints, drawColor);
    setDraftPoints([]);
    setDrawing(false);
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <MapContainer center={RIVAS_CENTER} zoom={RIVAS_ZOOM} className="h-full w-full" doubleClickZoom={!drawing} style={{ background: "#0a0a0a" }}>
        <MapRefBridge mapRef={mapRef} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <DrawHandler active={drawing} onPoint={p => setDraftPoints(prev => [...prev, p])} onFinish={finishDraw} />

        {zonas.map(z => (
          <Polygon key={z.id} positions={z.puntos.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.18, weight: 2 }}
            eventHandlers={{ contextmenu: () => { if (isMando && confirm(`Eliminar zona "${z.nombre}"?`)) onDeleteZona(z.id); } }} />
        ))}
        {drawing && draftPoints.length > 0 && (
          <>
            <Polyline positions={draftPoints.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: drawColor, weight: 2, dashArray: "4 4" }} />
            {draftPoints.map((p, i) => (
              <Marker key={i} position={[p.lat, p.lng]} icon={L.divIcon({ html: `<div style="width:8px;height:8px;background:${drawColor};border:2px solid #fff;border-radius:50%;"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] })} />
            ))}
          </>
        )}

        {visibleStickers.map(s => {
          const inter = intervinientes.find(i => i.id === s.interviniente_id);
          if (!inter) return null;
          return (
            <Marker
              key={s.id}
              position={[s.lat!, s.lng!]}
              draggable={s.clave !== "C0"}
              icon={stickerIcon(inter, s)}
              eventHandlers={{
                dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onMoveSticker(s, ll.lat, ll.lng); },
                contextmenu: (e) => {
                  const oe = (e as any).originalEvent as MouseEvent;
                  const rect = wrapRef.current!.getBoundingClientRect();
                  onContextSticker(s, oe.clientX - rect.left, oe.clientY - rect.top);
                },
                dblclick: (e) => {
                  const oe = (e as any).originalEvent as MouseEvent;
                  const rect = wrapRef.current!.getBoundingClientRect();
                  onContextSticker(s, oe.clientX - rect.left, oe.clientY - rect.top);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Drawing toolbar */}
      {isMando && (
        <div className="absolute top-3 left-3 z-[1000] bg-card border rounded-md shadow-xl p-2 flex items-center gap-2">
          {!drawing ? (
            <Button size="sm" variant="secondary" onClick={() => { setDrawing(true); setDraftPoints([]); }}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Dibujar zona
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-1">
                {ZONA_COLORS.map(c => (
                  <button key={c} onClick={() => setDrawColor(c)} className={`w-5 h-5 rounded border-2 ${drawColor === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{draftPoints.length} pts · doble clic para cerrar</span>
              <Button size="sm" variant="default" onClick={finishDraw} disabled={draftPoints.length < 3}><Check className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setDrawing(false); setDraftPoints([]); }}><X className="w-3.5 h-3.5" /></Button>
            </>
          )}
        </div>
      )}

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
                  <button onClick={() => { if (confirm(`Eliminar "${z.nombre}"?`)) onDeleteZona(z.id); }} className="text-muted-foreground hover:text-destructive">
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
