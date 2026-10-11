import { createFileRoute } from "@tanstack/react-router";
import { CrmLayout, PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/oportunidades")({
  head: () => ({
    meta: [
      { title: "Oportunidades — Mi CRM" },
      { name: "description", content: "Pipeline de ventas y oportunidades." },
      { property: "og:title", content: "Oportunidades — Mi CRM" },
      { property: "og:description", content: "Pipeline de ventas y oportunidades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OportunidadesPage,
});

function OportunidadesPage() {
  return (
    <CrmLayout>
      <PageHeader title="Oportunidades" description="Sigue tu pipeline de ventas." />
      <EmptyState message="Aún no hay oportunidades. Esta sección está lista para configurar." />
    </CrmLayout>
  );
}
