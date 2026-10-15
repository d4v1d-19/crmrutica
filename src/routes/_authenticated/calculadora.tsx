import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatFecha } from "@/lib/clientes";

type Search = { respuesta?: string };

export const Route = createFileRoute("/_authenticated/calculadora")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["respuesta"] === "string" && /^[0-9a-f-]{36}$/.test(s["respuesta"]) ? { respuesta: s["respuesta"] } : {},
  head: () => ({
    meta: [
      { title: "Calculadora de precios — Rutica CRM" },
      { name: "description", content: "Calcula precios de tours y paquetes." },
      { property: "og:title", content: "Calculadora de precios — Rutica CRM" },
      { property: "og:description", content: "Calcula precios de tours y paquetes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalculadoraPage,
});

/** Quantities a cotización response pre-fills into the calculator. */
export type Prefill = {
  total_personas: number;
  nacionales: number;
  extranjeros: number;
  adultos_mayores: number;
  ninos: number;
  transporte_4x4: boolean;
  hospedaje: boolean;
};

function toPrefill(d: Record<string, unknown>): Prefill {
  const n = (k: string) => (Number.isFinite(Number(d[k])) ? Number(d[k]) : 0);
  const total = n("total_personas");
  const nac = d["misma_nacionalidad"] === "nacionales" ? total : d["misma_nacionalidad"] === "mixto" ? n("cantidad_nacionales") : 0;
  return {
    total_personas: total,
    nacionales: nac,
    extranjeros: Math.max(0, total - nac),
    adultos_mayores: d["adultos_mayores"] === "si" ? n("cantidad_adultos_mayores") : 0,
    ninos: d["ninos"] === "si" ? n("cantidad_ninos") : 0,
    transporte_4x4: d["transporte_4x4"] === "si",
    hospedaje: d["hospedaje"] === "si",
  };
}

function CalculadoraPage() {
  const { respuesta } = Route.useSearch();
  const { data } = useQuery({
    queryKey: ["respuesta", respuesta],
    enabled: !!respuesta,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, data, created_at, clients(codigo, name)")
        .eq("id", respuesta!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const p = data ? toPrefill((data.data ?? {}) as Record<string, unknown>) : null;
  const c = data?.clients as { codigo: string; name: string } | null | undefined;

  return (
    <>
      <PageHeader title="Calculadora de precios" description="Calcula precios de tours y paquetes." />
      {p && (
        <div className="mb-6 rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">
            Datos prellenados desde la respuesta del {formatFecha(data!.created_at)}
            {c && ` · ${c.codigo} ${c.name}`}
          </p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            {[
              ["Personas", p.total_personas],
              ["Nacionales", p.nacionales],
              ["Extranjeros", p.extranjeros],
              ["Adultos mayores", p.adultos_mayores],
              ["Niños", p.ninos],
              ["Transporte 4x4", p.transporte_4x4 ? "Sí" : "No"],
              ["Hospedaje", p.hospedaje ? "Sí" : "No"],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <Link to="/calculadora" className="mt-3 inline-block text-xs text-muted-foreground hover:underline">Quitar datos</Link>
        </div>
      )}
      <EmptyState message="La calculadora estará disponible pronto." />
    </>
  );
}
