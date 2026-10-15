import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuraciones — Rutica CRM" },
      { name: "description", content: "Usuarios, roles, permisos y preferencias." },
      { property: "og:title", content: "Configuraciones — Rutica CRM" },
      { property: "og:description", content: "Usuarios, roles, permisos y preferencias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
  return (
    <>
      <PageHeader title="Configuraciones" description="Usuarios, roles, permisos y preferencias." />
      <EmptyState message="Configuraciones pendientes de definir." />
    </>
  );
}
