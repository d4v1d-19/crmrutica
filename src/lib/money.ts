export const MONEDAS = ["USD", "CRC", "EUR"] as const;
export type Moneda = (typeof MONEDAS)[number];

export function formatMonto(n: number | string, moneda: string) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: moneda, minimumFractionDigits: 2 }).format(Number(n));
}
