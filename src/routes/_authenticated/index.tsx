import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Rutica CRM" },
      { name: "description", content: "Resumen general de la operación de Rutica." },
      { property: "og:title", content: "Dashboard — Rutica CRM" },
      { property: "og:description", content: "Resumen general de la operación de Rutica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Resumen general de la operación de Rutica." />
      <EmptyState message="Aquí irá el resumen de tu actividad." />
    </>
  );
}
