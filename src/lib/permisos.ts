export const PERMISOS = [
  {
    grupo: "Información financiera → Dashboard sencillo",
    items: [
      { key: "dashboard.simple.facturas", label: "Mi dashboard (facturas y comisión)" },
      { key: "dashboard.simple.potenciales", label: "Clientes potenciales" },
      { key: "dashboard.simple.oficiales", label: "Clientes oficiales" },
    ],
  },
  {
    grupo: "Información financiera → Dashboard general",
    items: [
      { key: "dashboard.general.potenciales", label: "Clientes potenciales" },
      { key: "dashboard.general.oficiales", label: "Clientes oficiales" },
      { key: "dashboard.general.facturas", label: "Facturas" },
      { key: "dashboard.general.agentes", label: "Agentes" },
    ],
  },
] as const;

export const TODOS_PERMISOS = PERMISOS.flatMap((g) => g.items.map((i) => i.key));

/** Los admin tienen todos los permisos. */
export function tienePermiso(permiso: string, opts: { isAdmin: boolean; permisos: string[] }) {
  return opts.isAdmin || opts.permisos.includes(permiso);
}
