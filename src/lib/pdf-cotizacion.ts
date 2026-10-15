import { formatMonto } from "./money";

type Linea = { label: string; detalle: string; monto: number };
type Pct = { nombre: string; porcion: number; base: number; monto: number };
export type QuoteSnapshot = {
  desglose?: Linea[];
  porcentajes?: Pct[];
  subtotal?: number;
  total?: number;
  personas?: number;
  paquete?: string | null;
  variables?: { dias?: number; noches?: number; adultos?: number; mayores?: number; ninos?: number; nacionales?: number; extranjeros?: number };
};
export type Company = { nombre: string; correo: string | null; telefono: string | null; direccion: string | null; cedula_juridica: string | null; logo_url: string | null };

const fecha = (d: string | Date) =>
  new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00-06:00`) : new Date(d),
  );

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = fail;
      r.readAsDataURL(blob);
    });
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = data; });
    return { data, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

export async function generarPdfCotizacion(opts: {
  numero: number;
  cliente: string;
  creada: string;
  vence: string | null;
  moneda: string;
  snapshot: QuoteSnapshot;
  empresa: Company;
}) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const fmt = (n: number) => formatMonto(n ?? 0, opts.moneda);
  const e = opts.empresa;

  let y = M;
  if (e.logo_url) {
    const img = await loadImage(e.logo_url);
    if (img) {
      const h = 50, w = Math.min(160, (img.w / img.h) * h);
      doc.addImage(img.data, W - M - w, y - 6, w, h);
    }
  }
  doc.setFont("helvetica", "bold").setFontSize(26).text("Cotización", M, y + 20);
  doc.setFont("helvetica", "normal").setFontSize(10);
  y += 46;
  const empresaLines = [e.nombre, e.cedula_juridica && `Cédula jurídica: ${e.cedula_juridica}`, e.direccion, e.correo, e.telefono].filter(Boolean) as string[];
  doc.text(empresaLines, M, y);
  const info = [
    `Número: ${opts.numero}`,
    `Fecha: ${fecha(opts.creada)}`,
    `Válida: ${fecha(opts.creada)} al ${opts.vence ? fecha(opts.vence) : "—"}`,
    `Cliente: ${opts.cliente}`,
  ];
  doc.text(info, W - M, y, { align: "right" });
  y += Math.max(empresaLines.length, info.length) * 13 + 16;

  const s = opts.snapshot;
  const v = s.variables ?? {};
  const resumen = [
    s.paquete && `Paquete: ${s.paquete}`,
    `${v.dias ?? 0} día(s), ${v.noches ?? 0} noche(s)`,
    `${s.personas ?? 0} persona(s): ${v.adultos ?? 0} adultos, ${v.mayores ?? 0} adultos mayores, ${v.ninos ?? 0} niños · ${v.nacionales ?? 0} nacionales, ${v.extranjeros ?? 0} extranjeros`,
  ].filter(Boolean) as string[];
  doc.setFontSize(10).text(doc.splitTextToSize(resumen.join("\n"), W - 2 * M), M, y);
  y += resumen.length * 13 + 10;

  const body: (string | { content: string; styles: object })[][] = (s.desglose ?? []).map((l) => [l.label, l.detalle, fmt(l.monto)]);
  body.push([{ content: "Subtotal", styles: { fontStyle: "bold" } }, "", { content: fmt(s.subtotal ?? 0), styles: { fontStyle: "bold" } }]);
  for (const p of s.porcentajes ?? []) body.push([p.nombre, `${+(p.porcion * 100).toFixed(2)}% de ${fmt(p.base)}`, fmt(p.monto)]);
  body.push([{ content: "Total", styles: { fontStyle: "bold", fontSize: 12 } }, "", { content: fmt(s.total ?? 0), styles: { fontStyle: "bold", fontSize: 12 } }]);

  autoTable(doc, {
    startY: y,
    head: [["Rubro", "Detalle", "Monto"]],
    body,
    margin: { left: M, right: M },
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [40, 70, 60] },
    columnStyles: { 2: { halign: "right", cellWidth: 110 } },
  });
  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(8).setTextColor(110).text("Documento proforma. No es una factura.", M, endY + 24);
  doc.save(`cotizacion-${opts.numero}.pdf`);
}
