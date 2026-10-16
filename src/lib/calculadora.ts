export type Tarifas = {
  moneda: string;
  entrada_nacional: number;
  entrada_extranjero: number;
  hospedaje: number;
  desayuno: number;
  merienda: number;
  cena: number;
};

export type Extra = { id: string; nombre: string; descripcion?: string; monto: number; unidad: "c/u" | "total" };

export type CalcVars = {
  dias: number;
  noches: number;
  adultos: number;
  mayores: number;
  ninos: number;
  nacionales: number;
  extranjeros: number;
  hospedaje: boolean;
  t4x4: boolean;
  precio4x4: number;
  barco: boolean;
  precioBarco: number;
  /** Meal quantities per person from a package; null = use días/noches. */
  comidasPaquete: { desayunos: number; meriendas: number; cenas: number } | null;
  extras: Extra[];
};

export type Porcentaje = { id: string; nombre: string; porcion: number; aplica_a: string[] };

export const RUBROS = [
  { key: "entradas_nacionales", label: "Entradas nacionales" },
  { key: "entradas_extranjeros", label: "Entradas extranjeros" },
  { key: "hospedaje", label: "Hospedaje" },
  { key: "desayunos", label: "Desayunos" },
  { key: "meriendas", label: "Meriendas/almuerzos" },
  { key: "cenas", label: "Cenas" },
  { key: "transporte_4x4", label: "Transporte 4x4" },
  { key: "transporte_barco", label: "Transporte barco" },
  { key: "variables_extra", label: "Variables extra" },
] as const;
export const APLICA_OPCIONES = [...RUBROS, { key: "subtotal", label: "Subtotal" }] as const;

export type Linea = { key: string; rubro: string; label: string; detalle: string; monto: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export const personas = (v: CalcVars) => v.adultos + v.mayores + v.ninos;
export const personasValidas = (v: CalcVars) => v.nacionales + v.extranjeros === personas(v);

export function calcular(t: Tarifas, v: CalcVars, porcentajes: Porcentaje[]) {
  const p = personas(v);
  const factor = v.adultos + v.mayores + 0.5 * v.ninos;
  const cp = v.comidasPaquete;
  const nDes = cp ? cp.desayunos : v.dias;
  const nMer = cp ? cp.meriendas : v.dias;
  const nCen = cp ? cp.cenas : v.noches;
  const lineas: Linea[] = [
    { key: "entradas_nacionales", rubro: "entradas_nacionales", label: "Entradas nacionales", detalle: `${v.nacionales} × ${v.dias} día(s) × ${t.entrada_nacional}`, monto: v.nacionales * v.dias * t.entrada_nacional },
    { key: "entradas_extranjeros", rubro: "entradas_extranjeros", label: "Entradas extranjeros", detalle: `${v.extranjeros} × ${v.dias} día(s) × ${t.entrada_extranjero}`, monto: v.extranjeros * v.dias * t.entrada_extranjero },
    { key: "hospedaje", rubro: "hospedaje", label: "Hospedaje", detalle: v.hospedaje ? `${p} × ${v.noches} noche(s) × ${t.hospedaje}` : "No incluido", monto: v.hospedaje ? p * v.noches * t.hospedaje : 0 },
    { key: "desayunos", rubro: "desayunos", label: "Desayunos", detalle: `${nDes} × ${t.desayuno} × ${factor} personas equiv. (${v.adultos + v.mayores} adultos + ${v.ninos} niños al 50%)`, monto: nDes * t.desayuno * factor },
    { key: "meriendas", rubro: "meriendas", label: "Meriendas/almuerzos", detalle: `${nMer} × ${t.merienda} × ${factor} personas equiv. (${v.adultos + v.mayores} adultos + ${v.ninos} niños al 50%)`, monto: nMer * t.merienda * factor },
    { key: "cenas", rubro: "cenas", label: "Cenas", detalle: `${nCen} × ${t.cena} × ${factor} personas equiv. (${v.adultos + v.mayores} adultos + ${v.ninos} niños al 50%)`, monto: nCen * t.cena * factor },
  ];
  if (v.t4x4) lineas.push({ key: "transporte_4x4", rubro: "transporte_4x4", label: "Transporte 4x4", detalle: `${p} × ${v.precio4x4}`, monto: p * v.precio4x4 });
  if (v.barco) lineas.push({ key: "transporte_barco", rubro: "transporte_barco", label: "Transporte barco", detalle: `${p} × ${v.precioBarco}`, monto: p * v.precioBarco });
  for (const e of v.extras) {
    const monto = e.unidad === "c/u" ? p * e.monto : e.monto;
    lineas.push({ key: `extra:${e.id}`, rubro: "variables_extra", label: e.nombre || "Variable", detalle: e.unidad === "c/u" ? `${p} × ${e.monto}` : "Monto fijo", monto });
  }
  lineas.forEach((l) => (l.monto = r2(l.monto)));
  const subtotal = r2(lineas.reduce((a, l) => a + l.monto, 0));
  const aplicados = porcentajes.map((pc) => {
    const base = pc.aplica_a.includes("subtotal")
      ? subtotal
      : lineas.filter((l) => pc.aplica_a.includes(l.rubro)).reduce((a, l) => a + l.monto, 0);
    return { ...pc, base: r2(base), monto: r2(base * pc.porcion) };
  });
  const total = r2(subtotal + aplicados.reduce((a, x) => a + x.monto, 0));
  return { lineas, subtotal, porcentajes: aplicados, total, personas: p };
}

/** Values a "Formulario cliente oficial (cotización)" response pre-fills. */
export function prefillFromResponse(d: Record<string, unknown>) {
  const n = (k: string) => (Number.isFinite(Number(d[k])) ? Math.max(0, Math.trunc(Number(d[k]))) : 0);
  const total = n("total_personas");
  const nacionales = d["misma_nacionalidad"] === "nacionales" ? total : d["misma_nacionalidad"] === "mixto" ? n("cantidad_nacionales") : 0;
  const mayores = d["adultos_mayores"] === "si" ? n("cantidad_adultos_mayores") : 0;
  const ninos = d["ninos"] === "si" ? n("cantidad_ninos") : 0;
  return {
    adultos: Math.max(0, total - mayores - ninos),
    mayores,
    ninos,
    nacionales,
    extranjeros: Math.max(0, total - nacionales),
    t4x4: d["transporte_4x4"] === "si",
    hospedaje: d["hospedaje"] !== "no",
  };
}
