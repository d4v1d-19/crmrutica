import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldInput } from "@/components/forms/FieldInput";
import { getPublicForm, submitForm } from "@/lib/forms.functions";
import { initialData, isVisible, pendingConfirmations, validateSubmission, type FormData } from "@/lib/forms";

export const Route = createFileRoute("/f/$slug")({
  loader: async ({ params }) => {
    const form = await getPublicForm({ data: { slug: params.slug } });
    if (!form) throw notFound();
    return form;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.titulo} — Rutica` : "Formulario no disponible — Rutica";
    const d = loaderData?.descripcion || "Completa este formulario de Rutica, tours a Corcovado y Sirena.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="text-muted-foreground">Este formulario no existe o ya no está disponible.</p>
    </div>
  ),
  component: PublicForm,
});

function PublicForm() {
  const form = Route.useLoaderData();
  const [data, setData] = useState<FormData>(() => initialData(form.fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function send() {
    setConfirm(null);
    setSending(true);
    setServerError(null);
    try {
      const r = await submitForm({ data: { slug: form.slug, data } });
      if (r.ok) setDone(true);
      else {
        setServerError(r.error);
        if ("errors" in r && r.errors) setErrors(r.errors);
      }
    } catch {
      setServerError("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSubmission(form.fields, data);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setServerError("Revisa los campos marcados.");
      return;
    }
    const pend = pendingConfirmations(form.validaciones, form.fields, data);
    if (pend.length) setConfirm(pend);
    else void send();
  }

  if (done)
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">¡Gracias!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Recibimos tu respuesta. El equipo de Rutica te contactará pronto.</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8" noValidate>
        <header className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Rutica</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{form.titulo}</h1>
          {form.descripcion && <p className="mt-2 text-sm text-muted-foreground">{form.descripcion}</p>}
        </header>
        {form.fields
          .filter((f) => isVisible(f, data, form.fields))
          .map((f) => (
            <FieldInput
              key={f.variable}
              field={f}
              value={data[f.variable]}
              errors={errors}
              onChange={(v) => setData((d) => ({ ...d, [f.variable]: v }))}
            />
          ))}
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" disabled={sending} className="w-full">
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </form>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirma los datos</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.join(" ")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Corregir</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>Sí, es correcto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
