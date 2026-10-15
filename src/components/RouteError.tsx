import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/** Error boundary por ruta: el menú lateral sigue visible y el resto de la app funciona. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "route_error_component" });
  }, [error]);
  const msg = error instanceof Error ? error.message : String(error);
  const chunk = /dynamically imported module|Importing a module script|Failed to fetch/i.test(msg);
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-border bg-card p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">Esta sección no se pudo cargar</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {chunk ? "La aplicación se actualizó. Recarga la página para continuar." : "Ocurrió un error inesperado. Puedes reintentar o ir a otra sección del menú."}
      </p>
      <p className="mt-3 break-words text-xs text-muted-foreground">{msg}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={() => { void router.invalidate(); reset(); }}>Reintentar</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Recargar página</Button>
      </div>
    </div>
  );
}
