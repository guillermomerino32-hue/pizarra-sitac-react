// Domain constants and helpers
export const VALID_INDICATIVOS = [
  "A00","B00","B01","B02","B03",
  "C00","C01","C02","C03","C04","C05","C06","C07",
  "D01","D02","D03",
];
export const FIXED_PASSWORD = "123456";

export type Role = "mando" | "voluntario";
export function roleFor(indicativo: string): Role {
  return indicativo.toUpperCase().startsWith("V") ? "voluntario" : "mando";
}
export function isValidIndicativo(ind: string): boolean {
  const u = ind.toUpperCase();
  if (VALID_INDICATIVOS.includes(u)) return true;
  // voluntarios: starts with V + alphanum
  if (u.startsWith("V") && u.length >= 2) return true;
  return false;
}

export type Funcion = "sanitario" | "rescate" | "extincion" | "logistico" | "mando";
export type Tipo = "vehiculo" | "pie";
export type Subtipo = "ambulancia" | "cardio" | null;

export const FUNCION_COLORS: Record<Funcion, string> = {
  extincion: "#dc2626",
  rescate: "#f97316",
  sanitario: "#16a34a",
  logistico: "#2563eb",
  mando: "#9333ea",
};

export const FUNCION_LABELS: Record<Funcion, string> = {
  sanitario: "Sanitario",
  rescate: "Rescate",
  extincion: "Extinción",
  logistico: "Logístico",
  mando: "Mando",
};

export type Clave =
  | "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7"
  | "C8" | "C9" | "C10" | "C11" | "C12" | "C13" | "C14" | "C15" | "C16" | "C17" | "C100";

export const CLAVE_DESCRIPCIONES: Record<Clave, string> = {
  C0: "No Operativo",
  C1: "Operativo",
  C2: "De camino",
  C3: "Llegada al lugar",
  C4: "Inicio traslado a Hospital",
  C5: "Transferencia en Hospital",
  C6: "Fin de Intervención",
  C7: "Descanso",
  C8: "Repostaje",
  C9: "Revisión / mantenimiento",
  C10: "Reunión",
  C11: "Comida",
  C12: "Formación",
  C13: "Acompañamiento",
  C14: "Apoyo a unidad",
  C15: "Atención a víctima",
  C16: "Activación grupo",
  C17: "Comunicación radio",
  C100: "Aviso urgente",
};

export const CLAVES_VISUALES: Clave[] = ["C0","C1","C2","C3","C4","C6","C7"];
export const CLAVES_LOG: Clave[] = ["C5","C8","C9","C10","C11","C12","C13","C14","C15","C16","C17","C100"];

export interface Servicio {
  id: string;
  numero: number;
  estado: string;
  mando_indicativo: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Interviniente {
  id: string;
  servicio_id: string;
  indicativo_recurso: string;
  indicativo_intervinientes: string;
  tipo: Tipo;
  funcion: Funcion;
  subtipo: string | null;
  created_at: string;
}

export interface Sticker {
  id: string;
  servicio_id: string;
  interviniente_id: string;
  panel: "mapa" | "pizarra";
  x: number;
  y: number;
  lat: number | null;
  lng: number | null;
  clave: Clave;
  dashed: boolean;
  removed: boolean;
  c2_at: string | null;
  c3_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaveLog {
  id: string;
  servicio_id: string;
  indicativo_recurso: string;
  clave: Clave;
  descripcion: string;
  created_at: string;
}

export interface Zona {
  id: string;
  servicio_id: string;
  nombre: string;
  color: string;
  puntos: { lat: number; lng: number }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Rivas-Vaciamadrid center
export const RIVAS_CENTER: [number, number] = [40.3260, -3.5183];
export const RIVAS_ZOOM = 14;

export const ZONA_COLORS = ["#dc2626","#f97316","#eab308","#16a34a","#2563eb","#9333ea"];
