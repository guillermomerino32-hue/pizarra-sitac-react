import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { CLAVE_DESCRIPCIONES, FUNCION_LABELS, type Servicio } from "@/lib/domain";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-ES"); } catch { return iso; }
}

export async function generarPdfServicio(servicio: Servicio) {
  const sid = servicio.id;
  const [i, l, z, f] = await Promise.all([
    supabase.from("intervinientes").select("*").eq("servicio_id", sid).order("created_at"),
    supabase.from("claves_log").select("*").eq("servicio_id", sid).order("created_at"),
    (supabase.from as any)("zonas").select("*").eq("servicio_id", sid).order("created_at"),
    (supabase.from as any)("focos").select("*").eq("servicio_id", sid).order("created_at"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Pizarra SITAC — Servicio #${servicio.numero}`, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Mando: ${servicio.mando_indicativo ?? "—"}`, 40, 70);
  doc.text(`Inicio: ${fmt(servicio.created_at)}`, 40, 84);
  doc.text(`Fin: ${fmt(servicio.finished_at)}`, 40, 98);
  doc.setDrawColor(200);
  doc.line(40, 108, W - 40, 108);

  let y = 124;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Intervinientes", 40, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Indicativo recurso", "Componentes", "Tipo", "Función"]],
    body: ((i.data as any[]) ?? []).map(x => [x.indicativo_recurso, x.indicativo_intervinientes, x.tipo, FUNCION_LABELS[x.funcion as keyof typeof FUNCION_LABELS] ?? x.funcion]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Registro de claves", 40, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Hora", "Recurso", "Clave", "Descripción"]],
    body: ((l.data as any[]) ?? []).map(x => [fmt(x.created_at), x.indicativo_recurso, x.clave, CLAVE_DESCRIPCIONES[x.clave as keyof typeof CLAVE_DESCRIPCIONES] ?? x.descripcion]),
    styles: { fontSize: 8 },
    columnStyles: { 3: { cellWidth: 280 } },
    headStyles: { fillColor: [30, 30, 30] },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Focos / puntos de interés", 40, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Nombre", "Panel", "Información"]],
    body: ((f.data as any[]) ?? []).map(x => [x.nombre, x.panel, x.info || "—"]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Zonas", 40, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Nombre", "Vértices"]],
    body: ((z.data as any[]) ?? []).map(x => [x.nombre, Array.isArray(x.puntos) ? x.puntos.length : 0]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30] },
  });

  doc.save(`servicio-${servicio.numero}.pdf`);
}
