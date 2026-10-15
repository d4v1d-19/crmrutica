import { z } from "zod";

export const CANALES = [
  "WhatsApp",
  "Correo electrónico",
  "Redes sociales",
  "Llamada telefónica",
  "Formulario",
  "Otro",
] as const;
/** Canales que una persona puede elegir; "Formulario" solo lo asigna el sistema. */
export const CANALES_MANUALES = CANALES.filter((c) => c !== "Formulario");

export const MEDIDAS = [
  { value: "caliente", label: "Caliente", color: "#FFD1A6" },
  { value: "tibio", label: "Tibio", color: "#FFF3B0" },
  { value: "frio", label: "Frío", color: "#CDE8F6" },
] as const;
export type Medida = (typeof MEDIDAS)[number]["value"];

export const TIPOS_FACTURACION = [
  { value: "no_necesita", label: "No necesita factura" },
  { value: "sencilla", label: "Factura sencilla" },
  { value: "electronica", label: "Factura electrónica" },
] as const;

export const DELETE_CLIENT_TEXT =
  "Eliminar a este cliente eliminará también sus actividades en el CRM, lo que compró, los ingresos asociados y toda su información y trazabilidad. Esta acción no se puede deshacer.";

const ISO =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW XK";

let paisesCache: string[] | null = null;
export function paises(): string[] {
  if (paisesCache) return paisesCache;
  const dn = new Intl.DisplayNames(["es"], { type: "region" });
  paisesCache = Array.from(new Set(ISO.split(" ").map((c) => dn.of(c) ?? c))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  return paisesCache;
}

export function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

const opt = z.string().trim().optional().or(z.literal(""));

export const clientFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio"),
    email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
    phone: opt,
    company: opt,
    pais: opt,
    dni: z
      .string()
      .trim()
      .regex(/^[0-9-]*$/, "Solo números y guiones")
      .optional(),
    notas: opt,
    medida_interes: z.enum(["", "frio", "tibio", "caliente"]),
    canal: z.enum(CANALES, { message: "El canal es obligatorio" }),
    agente_id: opt,
    tipo_facturacion: z.enum(["no_necesita", "sencilla", "electronica"]),
    billing: z.object({
      cedula: opt,
      nombre_comercial: opt,
      razon_social: opt,
      actividad_economica: opt,
      direccion_fiscal: opt,
      telefono: opt,
      email: opt,
      provincia: opt,
      canton: opt,
      distrito: opt,
      nombre_completo: opt,
      empresa: opt,
    }),
  })
  .superRefine((v, ctx) => {
    const b = v.billing;
    const req = (k: keyof typeof b, msg = "Obligatorio") => {
      if (!b[k]?.trim()) ctx.addIssue({ code: "custom", path: ["billing", k], message: msg });
    };
    const emailOk = (k: "email") => {
      if (b[k] && !z.string().email().safeParse(b[k]).success)
        ctx.addIssue({ code: "custom", path: ["billing", k], message: "Correo inválido" });
    };
    if (v.tipo_facturacion === "electronica") {
      (
        [
          "cedula",
          "nombre_comercial",
          "razon_social",
          "actividad_economica",
          "direccion_fiscal",
          "telefono",
          "email",
          "provincia",
          "canton",
          "distrito",
        ] as const
      ).forEach((k) => req(k));
      emailOk("email");
    }
    if (v.tipo_facturacion === "sencilla") {
      req("nombre_completo");
      if (!b.telefono?.trim() && !b.email?.trim()) {
        ctx.addIssue({ code: "custom", path: ["billing", "telefono"], message: "Indica teléfono o correo" });
      }
      emailOk("email");
    }
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const nullIfEmpty = (s?: string | null) => (s && s.trim() ? s.trim() : null);

/** Builds the client_billing row for the chosen invoice type. */
export function billingRow(clientId: string, v: ClientFormValues) {
  const b = v.billing;
  if (v.tipo_facturacion === "electronica") {
    return {
      client_id: clientId,
      tipo: "electronica",
      cedula: nullIfEmpty(b.cedula),
      nombre_comercial: nullIfEmpty(b.nombre_comercial),
      razon_social: nullIfEmpty(b.razon_social),
      actividad_economica: nullIfEmpty(b.actividad_economica),
      direccion_fiscal: nullIfEmpty(b.direccion_fiscal),
      telefono: nullIfEmpty(b.telefono),
      email: nullIfEmpty(b.email),
      provincia: nullIfEmpty(b.provincia),
      canton: nullIfEmpty(b.canton),
      distrito: nullIfEmpty(b.distrito),
      nombre_completo: null,
      empresa: null,
    };
  }
  return {
    client_id: clientId,
    tipo: "sencilla",
    nombre_completo: nullIfEmpty(b.nombre_completo),
    telefono: nullIfEmpty(b.telefono),
    email: nullIfEmpty(b.email),
    empresa: nullIfEmpty(b.empresa),
    cedula: null,
    nombre_comercial: null,
    razon_social: null,
    actividad_economica: null,
    direccion_fiscal: null,
    provincia: null,
    canton: null,
    distrito: null,
  };
}
