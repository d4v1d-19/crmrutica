import { describe, expect, it } from "vitest";
import { clientFormSchema, CANALES_MANUALES } from "./clientes";

const base = {
  name: "Ana",
  medida_interes: "" as const,
  canal: "WhatsApp" as const,
  tipo_facturacion: "no_necesita" as const,
  billing: {},
};

describe("clientes rules", () => {
  it("name is required", () => {
    expect(clientFormSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });
  it("dni only numbers and dashes", () => {
    expect(clientFormSchema.safeParse({ ...base, dni: "1-234-567" }).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...base, dni: "AB123" }).success).toBe(false);
  });
  it("sencilla requires nombre_completo and phone or email", () => {
    expect(
      clientFormSchema.safeParse({ ...base, tipo_facturacion: "sencilla", billing: { nombre_completo: "Ana" } }).success,
    ).toBe(false);
    expect(
      clientFormSchema.safeParse({
        ...base,
        tipo_facturacion: "sencilla",
        billing: { nombre_completo: "Ana", email: "a@b.com" },
      }).success,
    ).toBe(true);
  });
  it("electronica requires all fiscal fields", () => {
    expect(
      clientFormSchema.safeParse({ ...base, tipo_facturacion: "electronica", billing: { cedula: "3-101" } }).success,
    ).toBe(false);
  });
  it("users cannot pick Formulario", () => {
    expect(CANALES_MANUALES).not.toContain("Formulario");
  });
});
