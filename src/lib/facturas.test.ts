import { describe, expect, it } from "vitest";
import { estadoFactura, saldo } from "./facturas";

describe("estado de factura", () => {
  it("pagada cuando pagos >= total", () => expect(estadoFactura(100, 100, "2020-01-01", "2026-10-15")).toBe("pagada"));
  it("parcial cuando 0 < pagos < total y no vencida", () => expect(estadoFactura(100, 40, "2026-10-20", "2026-10-15")).toBe("pagada_parcialmente"));
  it("expirada si no está pagada y hoy > vencimiento", () => expect(estadoFactura(100, 40, "2026-10-14", "2026-10-15")).toBe("expirada"));
  it("el día de vencimiento aún no expira", () => expect(estadoFactura(100, 0, "2026-10-15", "2026-10-15")).toBe("pendiente"));
  it("pendiente sin pagos y no vencida", () => expect(estadoFactura(100, 0, null, "2026-10-15")).toBe("pendiente"));
  it("saldo no es negativo", () => expect(saldo(100, 30.5)).toBe(69.5));
});
