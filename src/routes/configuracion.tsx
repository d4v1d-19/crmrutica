import { createFileRoute } from "@tanstack/react-router";
import { CrmLayout, PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Mi CRM" },
      { name: "description", content: "Configuración del CRM." },
      { property: "og:title", content: "Configuración — Mi CRM" },
      { property: "og:description", content: "Configuración del CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
  return (
    <CrmLayout>
      <PageHeader title="Configuración" description="Ajustes generales del CRM." />
      <EmptyState message="Las opciones de configuración aparecerán aquí." />
    </CrmLayout>
  );
}
