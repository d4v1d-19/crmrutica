import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/forms";
import { copyLink } from "@/lib/forms-ui";

export const Route = createFileRoute("/_authenticated/formularios/")({
  head: () => ({
    meta: [
      { title: "Formularios — Rutica CRM" },
      { name: "description", content: "Crea formularios públicos para captar clientes y cotizaciones." },
      { property: "og:title", content: "Formularios — Rutica CRM" },
      { property: "og:description", content: "Crea formularios públicos para captar clientes y cotizaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormulariosPage,
});

function FormulariosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const [forms, subs] = await Promise.all([
        supabase.from("forms").select("*").order("created_at"),
        supabase.from("form_submissions").select("form_id, email_estado"),
      ]);
      if (forms.error) throw forms.error;
      return { forms: forms.data, subs: subs.data ?? [] };
    },
  });

  async function crear() {
    const t = titulo.trim();
    if (!t) return;
    const slug = `${slugify(t) || "formulario"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: f, error } = await supabase.from("forms").insert({ titulo: t, slug }).select("id").single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["forms"] });
    setOpen(false);
    setTitulo("");
    navigate({ to: "/formularios/$id", params: { id: f.id } });
  }

  const sinCorreo = (data?.subs ?? []).filter((s) => s.email_estado === "sin_configurar").length;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Formularios" description="Formularios públicos para captar clientes y cotizaciones." />
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nuevo formulario</Button>
      </div>

      {sinCorreo > 0 && (
        <div className="mb-6 flex gap-3 rounded-lg border border-border bg-muted p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p>
            {sinCorreo} respuesta(s) se guardaron pero no se envió el aviso por correo porque el envío de correos aún no está
            configurado. Las respuestas se pueden ver igual en cada formulario.
          </p>
        </div>
      )}

      {isLoading ? (
        <EmptyState message="Cargando formularios..." />
      ) : !data?.forms.length ? (
        <EmptyState message="Aún no hay formularios." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.forms.map((f) => {
            const n = data.subs.filter((s) => s.form_id === f.id).length;
            return (
              <div key={f.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link to="/formularios/$id" params={{ id: f.id }} className="font-semibold text-foreground hover:underline">
                    {f.titulo}
                  </Link>
                  <Badge variant={f.activo ? "default" : "secondary"}>{f.activo ? "Activo" : "Inactivo"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {n} respuesta(s){f.crea_cliente && " · Crea clientes potenciales"}
                </p>
                <p className="mt-2 truncate font-mono text-xs text-muted-foreground">/f/{f.slug}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(f.slug)}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Abrir</a>
                  </Button>
                  <Button size="sm" asChild><Link to="/formularios/$id" params={{ id: f.id }}>Editar</Link></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo formulario</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={!titulo.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
