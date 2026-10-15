import { describe, expect, it } from "vitest";
import { comision, rangoPeriodo, resumenFacturas, type InvoiceLite } from "./dashboard";

const inv = (o: Partial<InvoiceLite>): InvoiceLite => ({ id: "1", total: 100, moneda: "USD", fecha_vencimiento: null, agente: "a", dia: "2026-10-01", pagos: [], ...o });

describe("dashboard", () => {
  it("semana va de lunes a domingo", () => expect(rangoPeriodo("semana", 0, "2026-10-15")).toMatchObject({ desde: "2026-10-12", hasta: "2026-10-18" }));
  it("mes anterior", () => expect(rangoPeriodo("mes", -1, "2026-03-31")).toMatchObject({ desde: "2026-02-01", hasta: "2026-02-28" }));
  it("año anterior", () => expect(rangoPeriodo("anio", -1, "2026-10-15")).toMatchObject({ desde: "2025-01-01", hasta: "2025-12-31" }));
  it("comisión = % × cobrado en el periodo", () => {
    const i = [inv({ pagos: [{ monto: 200, fecha: "2026-10-05" }, { monto: 100, fecha: "2026-09-30" }] })];
    expect(comision(i, 10, "2026-10-01", "2026-10-31")).toEqual({ USD: 20 });
  });
  it("cuenta estados con monto", () => {
    const r = resumenFacturas([inv({ pagos: [{ monto: 100, fecha: "2026-10-02" }] }), inv({ total: 50, pagos: [{ monto: 10, fecha: "2026-10-02" }] })], "2026-10-15");
    expect(r.pagada).toEqual({ cantidad: 1, montos: { USD: 100 } });
    expect(r.pagada_parcialmente.cantidad).toBe(1);
  });
});
