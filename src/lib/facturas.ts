export type EstadoFactura = "pendiente" | "pagada_parcialmente" | "pagada" | "expirada";

export const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "sinpe_movil", label: "SINPE Móvil" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** hoy: fecha YYYY-MM-DD en America/Costa_Rica */
export function hoyCR(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(d);
}

export function estadoFactura(total: number, pagado: number, vence: string | null, hoy = hoyCR()): EstadoFactura {
  const t = r2(Number(total)), p = r2(Number(pagado));
  if (p >= t) return "pagada";
  if (vence && hoy > vence) return "expirada";
  if (p > 0) return "pagada_parcialmente";
  return "pendiente";
}

export function saldo(total: number, pagado: number) {
  return Math.max(0, r2(Number(total) - Number(pagado)));
}
