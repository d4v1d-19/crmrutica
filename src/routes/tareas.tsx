import { createFileRoute } from "@tanstack/react-router";
import { CrmLayout, PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas — Mi CRM" },
      { name: "description", content: "Tareas y seguimientos del CRM." },
      { property: "og:title", content: "Tareas — Mi CRM" },
      { property: "og:description", content: "Tareas y seguimientos del CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TareasPage,
});

function TareasPage() {
  return (
    <CrmLayout>
      <PageHeader title="Tareas" description="Organiza tus pendientes y seguimientos." />
      <EmptyState message="Aún no hay tareas. Esta sección está lista para configurar." />
    </CrmLayout>
  );
}
