import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/CrmLayout";

export const Route = createFileRoute("/_authenticated/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora de precios — Rutica CRM" },
      { name: "description", content: "Calcula precios de tours y paquetes." },
      { property: "og:title", content: "Calculadora de precios — Rutica CRM" },
      { property: "og:description", content: "Calcula precios de tours y paquetes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalculadoraPage,
});

function CalculadoraPage() {
  return (
    <>
      <PageHeader title="Calculadora de precios" description="Calcula precios de tours y paquetes." />
      <EmptyState message="La calculadora estará disponible pronto." />
    </>
  );
}
