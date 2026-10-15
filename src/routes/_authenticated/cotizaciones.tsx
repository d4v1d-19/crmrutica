import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones — Rutica CRM" },
      { name: "description", content: "Cotizaciones enviadas a clientes." },
      { property: "og:title", content: "Cotizaciones — Rutica CRM" },
      { property: "og:description", content: "Cotizaciones enviadas a clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CotizacionesPage,
});

function CotizacionesPage() {
  return (
    <>
      <PageHeader title="Cotizaciones" description="Cotizaciones enviadas a clientes." />
      <EmptyState message="Aún no hay cotizaciones." />
    </>
  );
}
