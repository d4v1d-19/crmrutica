import { createFileRoute } from "@tanstack/react-router";
import { CrmLayout, PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel — Mi CRM" },
      { name: "description", content: "Panel principal del CRM." },
      { property: "og:title", content: "Panel — Mi CRM" },
      { property: "og:description", content: "Panel principal del CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <CrmLayout>
      <PageHeader title="Panel" description="Resumen general de tu CRM." />
      <EmptyState message="Aquí irá el resumen de tu actividad." />
    </CrmLayout>
  );
}
