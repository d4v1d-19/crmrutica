import { estadoFactura, type EstadoFactura } from "./facturas";

export type Periodo = "semana" | "mes" | "anio";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

/** Rango inclusivo (YYYY-MM-DD) del periodo, `offset` = 0 actual, -1 anterior… `hoy` en zona Costa Rica. */
export function rangoPeriodo(p: Periodo, offset: number, hoy: string) {
  const [y, m, d] = hoy.split("-").map(Number);
  let a: Date, b: Date, label: string;
  if (p === "anio") {
    a = new Date(Date.UTC(y + offset, 0, 1)); b = new Date(Date.UTC(y + offset, 11, 31));
    label = String(y + offset);
  } else if (p === "mes") {
    a = new Date(Date.UTC(y, m - 1 + offset, 1)); b = new Date(Date.UTC(y, m + offset, 0));
    label = `${MESES[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  } else {
    const t = new Date(Date.UTC(y, m - 1, d));
    const dow = (t.getUTCDay() + 6) % 7; // lunes = 0
    a = new Date(t); a.setUTCDate(t.getUTCDate() - dow + offset * 7);
    b = new Date(a); b.setUTCDate(a.getUTCDate() + 6);
    label = `${fmt(a)} – ${fmt(b)}`;
  }
  return { desde: iso(a), hasta: iso(b), label };
}

export type Montos = Record<string, number>;
export type EstadoResumen = Record<EstadoFactura, { cantidad: number; montos: Montos }>;
const add = (m: Montos, moneda: string, n: number) => { m[moneda] = Math.round(((m[moneda] ?? 0) + n) * 100) / 100; };

export type InvoiceLite = { id: string; total: number; moneda: string; fecha_vencimiento: string | null; agente: string | null; dia: string; pagos: { monto: number; fecha: string }[] };

export function resumenFacturas(invs: InvoiceLite[], hoy: string): EstadoResumen {
  const r: EstadoResumen = { pendiente: { cantidad: 0, montos: {} }, pagada_parcialmente: { cantidad: 0, montos: {} }, pagada: { cantidad: 0, montos: {} }, expirada: { cantidad: 0, montos: {} } };
  for (const i of invs) {
    const pagado = i.pagos.reduce((s, p) => s + Number(p.monto), 0);
    const e = estadoFactura(i.total, pagado, i.fecha_vencimiento, hoy);
    r[e].cantidad++;
    add(r[e].montos, i.moneda, Number(i.total));
  }
  return r;
}

/** Comisión = % × monto cobrado (pagos con fecha dentro del periodo). */
export function comision(invs: InvoiceLite[], porcentaje: number, desde: string, hasta: string): Montos {
  const m: Montos = {};
  for (const i of invs) for (const p of i.pagos) if (p.fecha >= desde && p.fecha <= hasta) add(m, i.moneda, (Number(p.monto) * Number(porcentaje)) / 100);
  return m;
}
