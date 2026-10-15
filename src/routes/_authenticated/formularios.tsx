import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/formularios")({
  head: () => ({
    meta: [
      { title: "Formularios — Rutica CRM" },
      { name: "description", content: "Formularios de captación de clientes." },
      { property: "og:title", content: "Formularios — Rutica CRM" },
      { property: "og:description", content: "Formularios de captación de clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormulariosPage,
});

function FormulariosPage() {
  return (
    <>
      <PageHeader title="Formularios" description="Formularios de captación de clientes." />
      <EmptyState message="Aún no hay formularios." />
    </>
  );
}
