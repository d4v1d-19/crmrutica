import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/facturas")({
  head: () => ({
    meta: [
      { title: "Facturas — Rutica CRM" },
      { name: "description", content: "Facturación de reservas y paquetes." },
      { property: "og:title", content: "Facturas — Rutica CRM" },
      { property: "og:description", content: "Facturación de reservas y paquetes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturasPage,
});

function FacturasPage() {
  return (
    <>
      <PageHeader title="Facturas" description="Facturación de reservas y paquetes." />
      <EmptyState message="Aún no hay facturas." />
    </>
  );
}
