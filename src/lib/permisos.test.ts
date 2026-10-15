import { describe, expect, it } from "vitest";
import { tienePermiso, TODOS_PERMISOS } from "./permisos";

describe("permisos", () => {
  it("admin tiene todos los permisos", () => expect(tienePermiso("dashboard.general.agentes", { isAdmin: true, permisos: [] })).toBe(true));
  it("agente solo tiene los asignados", () => {
    expect(tienePermiso("dashboard.general.agentes", { isAdmin: false, permisos: ["dashboard.simple.facturas"] })).toBe(false);
    expect(tienePermiso("dashboard.simple.facturas", { isAdmin: false, permisos: ["dashboard.simple.facturas"] })).toBe(true);
  });
  it("usa las claves acordadas", () => expect(TODOS_PERMISOS).toContain("dashboard.simple.facturas"));
});
