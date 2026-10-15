export const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "number_stepper", label: "Número con botones +/-" },
  { value: "checkbox", label: "Casilla" },
  { value: "dropdown", label: "Lista desplegable" },
  { value: "dropdown_paises", label: "Lista de países" },
  { value: "si_no", label: "Sí / No" },
  { value: "paragraph", label: "Párrafo" },
  { value: "email", label: "Correo electrónico" },
  { value: "telefono", label: "Teléfono" },
  { value: "factura_electronica", label: "Bloque factura electrónica" },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]["value"];

export const CLIENT_MAP_OPTIONS = [
  { value: "name", label: "Nombre" },
  { value: "email", label: "Correo electrónico" },
  { value: "phone", label: "Teléfono" },
  { value: "company", label: "Empresa" },
  { value: "pais", label: "País" },
  { value: "dni", label: "Cédula o pasaporte" },
  { value: "notas", label: "Notas" },
  { value: "medida_interes", label: "Medida de interés" },
  { value: "tipo_facturacion", label: "Tipo de facturación" },
  { value: "billing", label: "Datos de factura electrónica" },
] as const;

export type OptionItem = { label: string; value: string };
export type FieldOptions = {
  items?: OptionItem[];
  defecto?: string;
  patron?: string;
  ayuda?: string;
  min?: number;
  max?: number;
};
export type Rule = { campo: string; valor: string } | null;
export type FieldDef = {
  id?: string;
  orden: number;
  etiqueta: string;
  variable: string;
  tipo: FieldType;
  obligatorio: boolean;
  opciones: FieldOptions | null;
  regla_condicional: Rule;
  mapea_a_campo_cliente?: string | null;
};
export type Validacion = {
  tipo: "confirmar_suma_igual_total";
  total: string;
  partes: string[];
  mensaje: string;
};
export type FormData = Record<string, unknown>;

export const BILLING_FIELDS = [
  { key: "cedula", label: "Cédula jurídica o física" },
  { key: "nombre_comercial", label: "Nombre comercial" },
  { key: "razon_social", label: "Razón social" },
  { key: "actividad_economica", label: "Actividad económica" },
  { key: "direccion_fiscal", label: "Dirección fiscal" },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Correo electrónico" },
  { key: "provincia", label: "Provincia" },
  { key: "canton", label: "Cantón" },
  { key: "distrito", label: "Distrito" },
] as const;

export const SI_NO: OptionItem[] = [
  { label: "Sí", value: "si" },
  { label: "No", value: "no" },
];

export function optionItems(f: FieldDef): OptionItem[] {
  return f.tipo === "si_no" ? SI_NO : (f.opciones?.items ?? []);
}

const asStr = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "boolean" ? String(v) : String(v));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isVisible(f: FieldDef, data: FormData, fields: FieldDef[], depth = 0): boolean {
  const r = f.regla_condicional;
  if (!r || !r.campo) return true;
  const parent = fields.find((x) => x.variable === r.campo);
  if (parent && depth < 10 && !isVisible(parent, data, fields, depth + 1)) return false;
  return asStr(data[r.campo]) === r.valor;
}

/** Initial values for a public form (dropdown defaults, empty strings). */
export function initialData(fields: FieldDef[]): FormData {
  const d: FormData = {};
  for (const f of fields) {
    if (f.tipo === "checkbox") d[f.variable] = false;
    else if (f.tipo === "factura_electronica") d[f.variable] = {};
    else if (f.tipo === "number_stepper") d[f.variable] = f.opciones?.min ?? 0;
    else d[f.variable] = f.opciones?.defecto ?? "";
  }
  return d;
}

/** Returns error messages keyed by variable (billing sub-errors as "var.key"). */
export function validateSubmission(fields: FieldDef[], data: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!isVisible(f, data, fields)) continue;
    const v = data[f.variable];
    const s = asStr(v).trim();
    if (f.tipo === "factura_electronica") {
      const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
      for (const bf of BILLING_FIELDS) {
        const bv = asStr(b[bf.key]).trim();
        if (!bv) errors[`${f.variable}.${bf.key}`] = "Obligatorio";
        else if (bf.key === "email" && !EMAIL_RE.test(bv)) errors[`${f.variable}.${bf.key}`] = "Correo inválido";
      }
      continue;
    }
    if (f.tipo === "checkbox") {
      if (f.obligatorio && v !== true) errors[f.variable] = "Obligatorio";
      continue;
    }
    if (!s) {
      if (f.obligatorio) errors[f.variable] = "Este campo es obligatorio";
      continue;
    }
    if (s.length > 5000) errors[f.variable] = "Texto demasiado largo";
    else if (f.tipo === "email" && !EMAIL_RE.test(s)) errors[f.variable] = "Correo inválido";
    else if (f.tipo === "telefono" && !/^[0-9+\-\s()]{6,25}$/.test(s)) errors[f.variable] = "Teléfono inválido";
    else if (f.tipo === "number" && Number.isNaN(Number(s))) errors[f.variable] = "Debe ser un número";
    else if (f.tipo === "number_stepper") {
      const n = Number(s);
      if (!Number.isInteger(n)) errors[f.variable] = "Debe ser un número entero";
      else if (f.opciones?.min !== undefined && n < f.opciones.min) errors[f.variable] = `Mínimo ${f.opciones.min}`;
      else if (f.opciones?.max !== undefined && n > f.opciones.max) errors[f.variable] = `Máximo ${f.opciones.max}`;
    } else if ((f.tipo === "dropdown" || f.tipo === "si_no") && !optionItems(f).some((o) => o.value === s))
      errors[f.variable] = "Opción inválida";
    else if (f.opciones?.patron) {
      try {
        if (!new RegExp(f.opciones.patron).test(s)) errors[f.variable] = f.opciones.ayuda || "Formato inválido";
      } catch {
        /* invalid pattern configured: ignore */
      }
    }
  }
  return errors;
}

/** Keeps only visible fields' values. */
export function cleanData(fields: FieldDef[], data: FormData): FormData {
  const out: FormData = {};
  for (const f of fields) if (isVisible(f, data, fields)) out[f.variable] = data[f.variable];
  return out;
}

export function displayValue(f: FieldDef | undefined, v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (!f) return typeof v === "object" ? JSON.stringify(v) : String(v);
  if (f.tipo === "checkbox") return v ? "Sí" : "No";
  if (f.tipo === "factura_electronica" && typeof v === "object") {
    const b = v as Record<string, unknown>;
    return BILLING_FIELDS.map((x) => `${x.label}: ${asStr(b[x.key])}`).join("\n");
  }
  const item = optionItems(f).find((o) => o.value === String(v));
  return item ? item.label : String(v);
}

export function renderTemplate(tpl: string, fields: FieldDef[], data: FormData, extra: Record<string, string> = {}) {
  return tpl.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, k: string) => {
    if (k in extra) return extra[k]!;
    return displayValue(fields.find((f) => f.variable === k), data[k]);
  });
}

/** Confirmation messages required before submitting (e.g. adultos mayores + niños = total). */
export function pendingConfirmations(vals: Validacion[], fields: FieldDef[], data: FormData): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (v.tipo !== "confirmar_suma_igual_total") continue;
    const total = Number(data[v.total] ?? 0);
    const visible = (k: string) => {
      const f = fields.find((x) => x.variable === k);
      return f ? isVisible(f, data, fields) : false;
    };
    const parts = v.partes.map((p) => (visible(p) ? Number(data[p] ?? 0) : 0));
    const sum = parts.reduce((a, b) => a + b, 0);
    if (total > 0 && sum === total) {
      const vars: Record<string, string> = {};
      v.partes.forEach((p, i) => (vars[p] = String(parts[i])));
      out.push(renderTemplate(v.mensaje, fields, data, vars));
    }
  }
  return out;
}

export function sampleValue(f: FieldDef): string {
  switch (f.tipo) {
    case "email": return "ana@ejemplo.com";
    case "telefono": return "+506 8888-8888";
    case "number":
    case "number_stepper": return "4";
    case "checkbox": return "Sí";
    case "dropdown_paises": return "Costa Rica";
    case "paragraph": return "Nos interesa visitar Sirena en marzo.";
    case "dropdown":
    case "si_no": return optionItems(f)[0]?.label ?? "Opción";
    case "factura_electronica": return "Cédula: 3-101-123456 …";
    default: return f.variable.includes("nombre") ? "Ana Rodríguez" : f.etiqueta;
  }
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
export function toVariable(s: string) {
  return slugify(s).replace(/-/g, "_").slice(0, 40) || "campo";
}
