import { describe, expect, it } from "vitest";
import { isVisible, pendingConfirmations, validateSubmission, type FieldDef, type Validacion } from "./forms";

const f = (p: Partial<FieldDef>): FieldDef => ({
  orden: 0, etiqueta: "x", variable: "x", tipo: "text", obligatorio: false, opciones: null, regla_condicional: null, ...p,
});

describe("form rules", () => {
  const fields = [
    f({ variable: "ninos", tipo: "si_no", obligatorio: true }),
    f({ variable: "cantidad_ninos", tipo: "number_stepper", obligatorio: true, regla_condicional: { campo: "ninos", valor: "si" } }),
  ];
  it("conditional field shows only when rule matches", () => {
    expect(isVisible(fields[1]!, { ninos: "no" }, fields)).toBe(false);
    expect(isVisible(fields[1]!, { ninos: "si" }, fields)).toBe(true);
  });
  it("dni only numbers and dashes", () => {
    const dni = [f({ variable: "dni", opciones: { patron: "^[0-9-]*$", ayuda: "Solo números y guiones" } })];
    expect(validateSubmission(dni, { dni: "12a" })["dni"]).toBe("Solo números y guiones");
    expect(validateSubmission(dni, { dni: "1-234" })["dni"]).toBeUndefined();
  });
  it("stepper must be integer", () => {
    expect(validateSubmission(fields, { ninos: "si", cantidad_ninos: 1.5 })["cantidad_ninos"]).toBeDefined();
  });
  it("asks confirmation when seniors + kids = total", () => {
    const all = [
      f({ variable: "total_personas", tipo: "number_stepper" }),
      f({ variable: "am", tipo: "si_no" }),
      f({ variable: "cantidad_adultos_mayores", tipo: "number_stepper", regla_condicional: { campo: "am", valor: "si" } }),
      ...fields,
    ];
    const v: Validacion[] = [{ tipo: "confirmar_suma_igual_total", total: "total_personas", partes: ["cantidad_adultos_mayores", "cantidad_ninos"], mensaje: "Hay {{cantidad_adultos_mayores}} y {{cantidad_ninos}}" }];
    expect(pendingConfirmations(v, all, { total_personas: 3, am: "si", cantidad_adultos_mayores: 2, ninos: "si", cantidad_ninos: 1 })).toEqual(["Hay 2 y 1"]);
    expect(pendingConfirmations(v, all, { total_personas: 4, am: "si", cantidad_adultos_mayores: 2, ninos: "si", cantidad_ninos: 1 })).toEqual([]);
  });
});
