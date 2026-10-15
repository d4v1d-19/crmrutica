import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search["authorization_id"] === "string" ? search["authorization_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Autorizar conexión — Rutica CRM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConsentPage,
  errorComponent: ConsentError,
});

function ConsentError({ error }: { error: unknown }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No se pudo cargar la autorización</CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Ocurrió un error inesperado. Vuelve a intentarlo desde tu aplicación."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

type AuthDetails = {
  client?: { name?: string; redirect_uris?: string[] } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

const SCOPE_LABELS: Record<string, string> = {
  openid: "Compartir tu identidad básica",
  email: "Compartir tu dirección de correo",
  profile: "Compartir tu perfil básico",
};

function ConsentPage() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const navigate = useNavigate();
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authorizationId) {
        setError("Falta el identificador de autorización. Vuelve a iniciar la conexión desde tu aplicación.");
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const consentUrl = `/.lovable/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        navigate({ to: "/login", search: { next: consentUrl } });
        return;
      }
      setUserEmail(sessionData.session.user.email ?? null);
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const details = data as AuthDetails | null;
      const redirect = details?.redirect_url ?? details?.redirect_to;
      if (redirect && !details?.client) {
        window.location.href = redirect;
        return;
      }
      setDetails(details);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId, navigate]);

  async function decide(action: "approve" | "deny") {
    if (!authorizationId) return;
    setActing(true);
    setError(null);
    const fn =
      action === "approve"
        ? supabase.auth.oauth.approveAuthorization(authorizationId)
        : supabase.auth.oauth.denyAuthorization(authorizationId);
    const { data, error } = await fn;
    if (error) {
      setError(error.message);
      setActing(false);
      return;
    }
    const result = data as AuthDetails | null;
    const redirect = result?.redirect_url ?? result?.redirect_to;
    if (redirect) window.location.href = redirect;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando autorización…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Autorización no disponible</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const clientName = details?.client?.name ?? "Esta aplicación";
  const scopes = (details?.scope ?? "").split(" ").filter(Boolean);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar {clientName} a Rutica CRM</CardTitle>
          <CardDescription>
            {clientName} podrá usar las herramientas habilitadas de esta app como si fueras tú
            {userEmail ? ` (${userEmail})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopes.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {scopes.map((scope) => (
                <li key={scope}>• {SCOPE_LABELS[scope] ?? `Permiso adicional solicitado: ${scope}`}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Esto no omite los permisos ni las políticas de datos de esta app.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={acting} onClick={() => decide("approve")}>
              Aprobar
            </Button>
            <Button variant="outline" className="flex-1" disabled={acting} onClick={() => decide("deny")}>
              Cancelar conexión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
