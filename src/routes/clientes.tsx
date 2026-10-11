import { createFileRoute } from "@tanstack/react-router";
import { CrmLayout, PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Mi CRM" },
      { name: "description", content: "Gestión de clientes del CRM." },
      { property: "og:title", content: "Clientes — Mi CRM" },
      { property: "og:description", content: "Gestión de clientes del CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <CrmLayout>
      <PageHeader title="Clientes" description="Administra tus contactos y empresas." />
      <EmptyState message="Aún no hay clientes. Esta sección está lista para configurar." />
    </CrmLayout>
  );
}
