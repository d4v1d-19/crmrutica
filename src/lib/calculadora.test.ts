import { describe, expect, it } from "vitest";
import { calcular, personasValidas, prefillFromResponse, type CalcVars, type Tarifas } from "./calculadora";

const t: Tarifas = { moneda: "USD", entrada_nacional: 3, entrada_extranjero: 15, hospedaje: 30, desayuno: 20, merienda: 12, cena: 25 };
const v: CalcVars = {
  dias: 2, noches: 1, adultos: 2, mayores: 0, ninos: 2, nacionales: 1, extranjeros: 3,
  hospedaje: true, t4x4: true, precio4x4: 70, barco: false, precioBarco: 0, comidasPaquete: null,
  extras: [{ id: "a", nombre: "Refrigerio", monto: 15, unidad: "c/u" }, { id: "b", nombre: "Guía", monto: 100, unidad: "total" }],
};
const get = (r: ReturnType<typeof calcular>, k: string) => r.lineas.find((l) => l.key === k)?.monto;

describe("calculadora", () => {
  const r = calcular(t, v, [{ id: "iva", nombre: "IVA", porcion: 0.13, aplica_a: ["entradas_nacionales", "entradas_extranjeros"] }]);
  it("entradas = personas × días × tarifa", () => {
    expect(get(r, "entradas_nacionales")).toBe(6);
    expect(get(r, "entradas_extranjeros")).toBe(90);
  });
  it("hospedaje = personas × noches × tarifa", () => expect(get(r, "hospedaje")).toBe(120));
  it("niños pagan media comida", () => {
    expect(get(r, "desayunos")).toBe(120); // 2 × 20 × 3
    expect(get(r, "meriendas")).toBe(72);
    expect(get(r, "cenas")).toBe(75);
  });
  it("4x4 y extras", () => {
    expect(get(r, "transporte_4x4")).toBe(280);
    expect(get(r, "extra:a")).toBe(60);
    expect(get(r, "extra:b")).toBe(100);
  });
  it("IVA 13% solo sobre entradas", () => {
    expect(r.porcentajes[0]!.monto).toBe(12.48);
    expect(r.total).toBe(r.subtotal + 12.48);
  });
  it("paquete usa cantidades de comidas por persona", () => {
    const p = calcular(t, { ...v, comidasPaquete: { desayunos: 1, meriendas: 2, cenas: 1 } }, []);
    expect(get(p, "desayunos")).toBe(60);
    expect(get(p, "meriendas")).toBe(72);
  });
  it("nacionales + extranjeros debe igualar personas", () => {
    expect(personasValidas(v)).toBe(true);
    expect(personasValidas({ ...v, extranjeros: 2 })).toBe(false);
  });
  it("respuesta sin hospedaje lo desactiva", () => {
    expect(prefillFromResponse({ total_personas: 4, hospedaje: "no" }).hospedaje).toBe(false);
  });
});
