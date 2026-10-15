import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Rutica CRM" },
      { name: "description", content: "Administra los clientes y viajeros de Rutica." },
      { property: "og:title", content: "Clientes — Rutica CRM" },
      { property: "og:description", content: "Administra los clientes y viajeros de Rutica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <>
      <PageHeader title="Clientes" description="Administra los clientes y viajeros de Rutica." />
      <EmptyState message="Aún no hay clientes." />
    </>
  );
}
