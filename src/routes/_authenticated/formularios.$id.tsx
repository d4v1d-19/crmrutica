import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calculator, ChevronDown, Copy, ExternalLink, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import {
  CLIENT_MAP_OPTIONS,
  FIELD_TYPES,
  displayValue,
  optionItems,
  renderTemplate,
  sampleValue,
  slugify,
  toVariable,
  type FieldDef,
  type FieldType,
} from "@/lib/forms";
import { EMAIL_ESTADOS, copyLink } from "@/lib/forms-ui";
import { formatFecha } from "@/lib/clientes";

export const Route = createFileRoute("/_authenticated/formularios/$id")({
  head: () => ({
    meta: [
      { title: "Editar formulario — Rutica CRM" },
      { name: "description", content: "Constructor de formularios de Rutica CRM." },
      { property: "og:title", content: "Editar formulario — Rutica CRM" },
      { property: "og:description", content: "Constructor de formularios de Rutica CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormEditor,
});

const NONE = "__none";
type EditField = FieldDef & { key: string };

async function load(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const [form, fields, subs, roles] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).single(),
    supabase.from("form_fields").select("*").eq("form_id", id).order("orden"),
    supabase.from("form_submissions").select("*, clients(id, name, codigo)").eq("form_id", id).order("created_at", { ascending: false }).limit(500),
    supabase.from("user_roles").select("role").eq("user_id", u.user?.id ?? ""),
  ]);
  if (form.error) throw form.error;
  return {
    form: form.data,
    fields: (fields.data ?? []) as unknown as FieldDef[],
    subs: subs.data ?? [],
    isAdmin: (roles.data ?? []).some((r) => r.role === "admin"),
  };
}

function FormEditor() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["form", id], queryFn: () => load(id) });
  if (isLoading || !data) return <EmptyState message="Cargando formulario..." />;
  return <Editor key={id} initial={data} />;
}

function Editor({ initial }: { initial: Awaited<ReturnType<typeof load>> }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { form, subs, isAdmin } = initial;
  const [fields, setFields] = useState<EditField[]>(() => initial.fields.map((f) => ({ ...f, key: f.id ?? crypto.randomUUID() })));
  const [cfg, setCfg] = useState({
    titulo: form.titulo,
    slug: form.slug,
    descripcion: form.descripcion ?? "",
    email_notificacion: form.email_notificacion ?? "",
    plantilla_correo: form.plantilla_correo ?? "",
    crea_cliente: form.crea_cliente,
    activo: form.activo,
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [delField, setDelField] = useState<string | null>(null);
  const [delForm, setDelForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: string, patch: Partial<FieldDef>) =>
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  function addField() {
    const n = fields.length + 1;
    let v = `campo_${n}`;
    while (fields.some((f) => f.variable === v)) v += "_";
    setFields((fs) => [
      ...fs,
      { key: crypto.randomUUID(), orden: n, etiqueta: `Campo ${n}`, variable: v, tipo: "text", obligatorio: false, opciones: null, regla_condicional: null, mapea_a_campo_cliente: null },
    ]);
  }

  function onDrop(to: number) {
    if (dragIdx === null || dragIdx === to) return;
    setFields((fs) => {
      const next = [...fs];
      const [m] = next.splice(dragIdx, 1);
      next.splice(to, 0, m!);
      return next;
    });
    setDragIdx(null);
  }

  async function save() {
    const vars = fields.map((f) => f.variable.trim());
    if (vars.some((v) => !/^[a-z0-9_]+$/.test(v))) { toast.error("Las variables solo pueden tener minúsculas, números y _"); return; }
    if (new Set(vars).size !== vars.length) { toast.error("Cada variable debe ser única dentro del formulario"); return; }
    if (fields.some((f) => !f.etiqueta.trim())) { toast.error("Todos los campos necesitan etiqueta"); return; }
    const slug = slugify(cfg.slug);
    if (!slug) { toast.error("El link necesita un nombre válido"); return; }
    if (!cfg.titulo.trim()) { toast.error("El título es obligatorio"); return; }
    if (cfg.email_notificacion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email_notificacion)) { toast.error("Correo de aviso inválido"); return; }
    setSaving(true);
    try {
      const { error: fe } = await supabase
        .from("forms")
        .update({
          titulo: cfg.titulo.trim(),
          slug,
          descripcion: cfg.descripcion.trim() || null,
          email_notificacion: cfg.email_notificacion.trim() || null,
          plantilla_correo: cfg.plantilla_correo || null,
          crea_cliente: cfg.crea_cliente,
          activo: cfg.activo,
        })
        .eq("id", form.id);
      if (fe) throw new Error(fe.message.includes("forms_slug_key") ? "Ese link ya lo usa otro formulario" : fe.message);
      const keep = fields.filter((f) => f.id).map((f) => f.id!);
      const removed = initial.fields.filter((f) => f.id && !keep.includes(f.id)).map((f) => f.id!);
      if (removed.length) {
        const { error } = await supabase.from("form_fields").delete().in("id", removed);
        if (error) throw error;
      }
      // Temporarily move variables to avoid unique clashes when swapping names
      for (const f of fields.filter((x) => x.id)) {
        await supabase.from("form_fields").update({ variable: `tmp_${f.id!.slice(0, 8)}` }).eq("id", f.id!);
      }
      const rows = fields.map((f, i) => ({
        ...(f.id ? { id: f.id } : {}),
        form_id: form.id,
        orden: i + 1,
        etiqueta: f.etiqueta.trim(),
        variable: f.variable.trim(),
        tipo: f.tipo,
        obligatorio: f.obligatorio,
        opciones: (f.opciones ?? null) as never,
        regla_condicional: (f.regla_condicional?.campo ? f.regla_condicional : null) as never,
        mapea_a_campo_cliente: f.mapea_a_campo_cliente || null,
      }));
      const { error: ue } = await supabase.from("form_fields").upsert(rows);
      if (ue) throw ue;
      toast.success("Formulario guardado");
      await qc.invalidateQueries({ queryKey: ["form", form.id] });
      qc.invalidateQueries({ queryKey: ["forms"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm() {
    const { error, count } = await supabase.from("forms").delete({ count: "exact" }).eq("id", form.id);
    if (error || !count) { toast.error(error?.message ?? "Solo un administrador puede eliminar formularios"); return; }
    toast.success("Formulario eliminado");
    qc.invalidateQueries({ queryKey: ["forms"] });
    navigate({ to: "/formularios" });
  }

  const hasCalc = initial.fields.some((f) => f.variable === "total_personas");

  return (
    <>
      <Link to="/formularios" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Formularios
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={cfg.titulo || "Formulario"} description={`Link público: /f/${form.slug}`} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copyLink(form.slug)}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button>
          <Button variant="outline" asChild>
            <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Abrir</a>
          </Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
      </div>

      <Tabs defaultValue="campos">
        <TabsList>
          <TabsTrigger value="campos">Campos</TabsTrigger>
          <TabsTrigger value="config">Configuración y correo</TabsTrigger>
          <TabsTrigger value="respuestas">Respuestas ({subs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="campos" className="space-y-3">
          {fields.map((f, i) => (
            <div
              key={f.key}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className={`rounded-lg border bg-card ${dragIdx === i ? "border-primary opacity-60" : "border-border"}`}
            >
              <Collapsible>
                <div className="flex items-center gap-3 p-3">
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" aria-label="Arrastrar para reordenar" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {f.etiqueta} {f.obligatorio && <span className="text-destructive">*</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {FIELD_TYPES.find((t) => t.value === f.tipo)?.label} · {`{{${f.variable}}}`}
                      {f.regla_condicional?.campo && ` · condicional`}
                      {f.mapea_a_campo_cliente && ` · → ${CLIENT_MAP_OPTIONS.find((o) => o.value === f.mapea_a_campo_cliente)?.label}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Obligatorio</Label>
                    <Switch checked={f.obligatorio} onCheckedChange={(c) => update(f.key, { obligatorio: c })} />
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Editar campo"><ChevronDown className="h-4 w-4" /></Button>
                  </CollapsibleTrigger>
                  <Button variant="ghost" size="icon" aria-label="Eliminar campo" onClick={() => setDelField(f.key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CollapsibleContent>
                  <FieldEditor field={f} all={fields} onChange={(p) => update(f.key, p)} />
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
          <Button variant="outline" onClick={addField}><Plus className="mr-2 h-4 w-4" /> Agregar campo</Button>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input maxLength={120} value={cfg.titulo} onChange={(e) => setCfg({ ...cfg, titulo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Link público (/f/…)</Label>
              <Input maxLength={60} value={cfg.slug} onChange={(e) => setCfg({ ...cfg, slug: e.target.value.toLowerCase() })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea rows={2} maxLength={1000} value={cfg.descripcion} onChange={(e) => setCfg({ ...cfg, descripcion: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Correo al que llegan las respuestas</Label>
              <Input type="email" maxLength={255} value={cfg.email_notificacion} onChange={(e) => setCfg({ ...cfg, email_notificacion: e.target.value })} />
            </div>
            <div className="flex flex-col justify-end gap-3">
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={cfg.activo} onCheckedChange={(c) => setCfg({ ...cfg, activo: c })} /> Formulario activo
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={cfg.crea_cliente} onCheckedChange={(c) => setCfg({ ...cfg, crea_cliente: c })} /> Cada envío crea un cliente potencial
              </label>
            </div>
          </div>
          <TemplateEditor
            value={cfg.plantilla_correo}
            onChange={(v) => setCfg({ ...cfg, plantilla_correo: v })}
            fields={fields}
            titulo={cfg.titulo}
          />
          {isAdmin && (
            <div className="border-t border-border pt-6">
              <Button variant="destructive" onClick={() => setDelForm(true)}>Eliminar formulario</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="respuestas">
          <Respuestas subs={subs} fields={initial.fields} hasCalc={hasCalc} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!delField} onOpenChange={(o) => !o && setDelField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este campo?</AlertDialogTitle>
            <AlertDialogDescription>
              El campo se quitará del formulario al guardar los cambios. Las respuestas anteriores conservan el valor que ya tenían.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setFields((fs) => fs.filter((f) => f.key !== delField)); setDelField(null); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delForm} onOpenChange={setDelForm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este formulario?</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar este formulario eliminará también todas sus respuestas y su link público dejará de funcionar. Los clientes que
              ya se crearon desde él se conservan. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteForm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FieldEditor({ field: f, all, onChange }: { field: EditField; all: EditField[]; onChange: (p: Partial<FieldDef>) => void }) {
  const hasItems = f.tipo === "dropdown";
  const [itemsText, setItemsText] = useState(() => (f.opciones?.items ?? []).map((o) => `${o.label} | ${o.value}`).join("\n"));
  const parents = all.filter((x) => x.key !== f.key && ["dropdown", "si_no", "checkbox"].includes(x.tipo));
  const parent = all.find((x) => x.variable === f.regla_condicional?.campo);
  const parentValues = parent
    ? parent.tipo === "checkbox"
      ? [{ label: "Marcado", value: "true" }, { label: "No marcado", value: "false" }]
      : optionItems(parent)
    : [];
  const opts = f.opciones ?? {};

  function parseItems(t: string) {
    setItemsText(t);
    const items = t
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, value] = l.split("|").map((s) => s.trim());
        return { label: label!, value: value || toVariable(label!) };
      });
    onChange({ opciones: { ...opts, items } });
  }

  return (
    <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Etiqueta</Label>
        <Input maxLength={200} value={f.etiqueta} onChange={(e) => onChange({ etiqueta: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Variable (única)</Label>
        <Input maxLength={40} value={f.variable} onChange={(e) => onChange({ variable: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={f.tipo} onValueChange={(v) => onChange({ tipo: v as FieldType })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Llena el campo del cliente</Label>
        <Select value={f.mapea_a_campo_cliente || NONE} onValueChange={(v) => onChange({ mapea_a_campo_cliente: v === NONE ? null : v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Ninguno</SelectItem>
            {CLIENT_MAP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {hasItems && (
        <div className="space-y-2 sm:col-span-2">
          <Label>Opciones (una por línea, "Etiqueta | valor")</Label>
          <Textarea rows={4} value={itemsText} onChange={(e) => parseItems(e.target.value)} />
          <div className="space-y-2">
            <Label>Opción por defecto</Label>
            <Select value={opts.defecto || NONE} onValueChange={(v) => onChange({ opciones: { ...opts, defecto: v === NONE ? "" : v } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ninguna</SelectItem>
                {(opts.items ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {(f.tipo === "number" || f.tipo === "number_stepper") && (
        <>
          <div className="space-y-2">
            <Label>Mínimo</Label>
            <Input type="number" value={opts.min ?? ""} onChange={(e) => onChange({ opciones: { ...opts, ...(e.target.value === "" ? { min: undefined } : { min: Number(e.target.value) }) } as never })} />
          </div>
          <div className="space-y-2">
            <Label>Máximo</Label>
            <Input type="number" value={opts.max ?? ""} onChange={(e) => onChange({ opciones: { ...opts, ...(e.target.value === "" ? { max: undefined } : { max: Number(e.target.value) }) } as never })} />
          </div>
        </>
      )}
      {(f.tipo === "text" || f.tipo === "telefono") && (
        <div className="space-y-2 sm:col-span-2">
          <Label>Texto de ayuda</Label>
          <Input maxLength={200} value={opts.ayuda ?? ""} onChange={(e) => onChange({ opciones: { ...opts, ayuda: e.target.value } })} />
        </div>
      )}
      <div className="space-y-2 sm:col-span-2">
        <Label>Mostrar solo si…</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={f.regla_condicional?.campo || NONE}
            onValueChange={(v) => onChange({ regla_condicional: v === NONE ? null : { campo: v, valor: "" } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Siempre visible</SelectItem>
              {parents.map((p) => <SelectItem key={p.key} value={p.variable}>{p.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
          {f.regla_condicional?.campo && (
            <Select
              value={f.regla_condicional.valor || undefined}
              onValueChange={(v) => onChange({ regla_condicional: { campo: f.regla_condicional!.campo, valor: v } })}
            >
              <SelectTrigger><SelectValue placeholder="= valor" /></SelectTrigger>
              <SelectContent>{parentValues.map((o) => <SelectItem key={o.value} value={o.value}>= {o.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({ value, onChange, fields, titulo }: { value: string; onChange: (v: string) => void; fields: FieldDef[]; titulo: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(!!value);
  const sample = useMemo(() => {
    const d: Record<string, unknown> = {};
    const fake = fields.map((f) => ({ ...f, tipo: "text" as const, opciones: null }));
    fields.forEach((f) => (d[f.variable] = sampleValue(f)));
    return { d, fake };
  }, [fields]);
  const vars = ["formulario", ...fields.map((f) => f.variable)];

  function insert(v: string) {
    const el = ref.current;
    const token = `{{${v}}}`;
    if (!el) return onChange(value + token);
    const s = el.selectionStart, e = el.selectionEnd;
    onChange(value.slice(0, s) + token + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  }
  const tpl = value || fields.map((f) => `${f.etiqueta}: {{${f.variable}}}`).join("\n");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-sm font-medium">
        Opciones avanzadas: plantilla del correo
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {vars.map((v) => (
              <button key={v} type="button" onClick={() => insert(v)} className="rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs text-foreground hover:bg-accent">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
          <Textarea ref={ref} rows={12} maxLength={10000} value={value} placeholder={tpl} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
          <p className="text-xs text-muted-foreground">Si la dejas vacía se envían todos los campos.</p>
        </div>
        <div className="space-y-2">
          <Label>Vista previa (datos de ejemplo)</Label>
          <div className="min-h-64 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground">
            <p className="mb-3 border-b border-border pb-2 text-xs text-muted-foreground">Asunto: Nueva respuesta: {titulo}</p>
            {renderTemplate(tpl, sample.fake, sample.d, { formulario: titulo })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type Sub = Awaited<ReturnType<typeof load>>["subs"][number];
function Respuestas({ subs, fields, hasCalc }: { subs: Sub[]; fields: FieldDef[]; hasCalc: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(null), [subs]);
  if (!subs.length) return <EmptyState message="Aún no hay respuestas." />;
  const first = fields.slice(0, 3);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            {first.map((f) => <TableHead key={f.variable}>{f.etiqueta}</TableHead>)}
            <TableHead>Cliente</TableHead>
            <TableHead>Aviso</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {subs.map((s) => {
            const d = (s.data ?? {}) as Record<string, unknown>;
            const c = s.clients as { id: string; name: string; codigo: string } | null;
            return (
              <Fragment key={s.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <TableCell>{formatFecha(s.created_at)}</TableCell>
                  {first.map((f) => <TableCell key={f.variable} className="max-w-48 truncate">{displayValue(f, d[f.variable]) || "—"}</TableCell>)}
                  <TableCell>{c ? `${c.codigo} · ${c.name}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.email_estado === "enviado" ? "default" : "secondary"} title={s.email_error ?? undefined}>
                      {EMAIL_ESTADOS[s.email_estado] ?? s.email_estado}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {hasCalc && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/calculadora" search={{ respuesta: s.id }}><Calculator className="mr-2 h-4 w-4" /> Calculadora</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {open === s.id && (
                  <TableRow>
                    <TableCell colSpan={first.length + 4} className="bg-muted/40">
                      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        {Object.keys(d).map((k) => {
                          const f = fields.find((x) => x.variable === k);
                          return (
                            <div key={k}>
                              <dt className="text-xs text-muted-foreground">{f?.etiqueta ?? k}</dt>
                              <dd className="whitespace-pre-wrap text-sm text-foreground">{displayValue(f, d[k]) || "—"}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
