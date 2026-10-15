import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/paquetes")({
  head: () => ({
    meta: [
      { title: "Catálogo de paquetes — Rutica CRM" },
      { name: "description", content: "Tours y paquetes a Corcovado, Sirena y más." },
      { property: "og:title", content: "Catálogo de paquetes — Rutica CRM" },
      { property: "og:description", content: "Tours y paquetes a Corcovado, Sirena y más." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaquetesPage,
});

function PaquetesPage() {
  return (
    <>
      <PageHeader title="Catálogo de paquetes" description="Tours y paquetes a Corcovado, Sirena y más." />
      <EmptyState message="Aún no hay paquetes en el catálogo." />
    </>
  );
}
