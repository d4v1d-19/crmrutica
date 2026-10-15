import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bed, Car, Pencil, Plus, Ship, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { Tables } from "@/integrations/supabase/types";
import { formatMonto, MONEDAS } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/paquetes")({
  head: () => ({
    meta: [
      { title: "Catálogo de paquetes — Rutica CRM" },
      { name: "description", content: "Tours y paquetes a Corcovado, Sirena y más." },
      { property: "og:title", content: "Catálogo de paquetes — Rutica CRM" },
      { property: "og:description", content: "Tours y paquetes a Corcovado, Sirena y más." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaquetesPage,
});

type Pkg = Tables<"packages"> & { package_variables: Tables<"package_variables">[] };
const UNIDADES = [
  { value: "c/u", label: "c/u (por persona)" },
  { value: "total", label: "Total (monto fijo)" },
] as const;

const int = z.coerce.number().int("Entero").min(0, "Mínimo 0");
const money = z.coerce.number().min(0, "Mínimo 0").max(100_000_000);
const unidad = z.enum(["c/u", "total"]);
const schema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(200),
  dias: int,
  noches: int,
  incluye_hospedaje: z.boolean(),
  incluye_desayuno: z.boolean(),
  incluye_cena: z.boolean(),
  desayunos_por_persona: int,
  meriendas_por_persona: int,
  cenas_por_persona: int,
  transporte_4x4: z.boolean(),
  precio_4x4: money,
  unidad_4x4: unidad,
  transporte_barco: z.boolean(),
  precio_barco: money,
  unidad_barco: unidad,
  moneda: z.enum(MONEDAS),
  variables: z.array(
    z.object({
      nombre: z.string().trim().min(1, "Obligatorio").max(200),
      descripcion: z.string().trim().max(500).optional(),
      monto: money,
      unidad,
    }),
  ),
});
type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

function defaults(p: Pkg | null): Values {
  return {
    titulo: p?.titulo ?? "",
    dias: p?.dias ?? 1,
    noches: p?.noches ?? 0,
    incluye_hospedaje: p?.incluye_hospedaje ?? false,
    incluye_desayuno: p?.incluye_desayuno ?? false,
    incluye_cena: p?.incluye_cena ?? false,
    desayunos_por_persona: p?.desayunos_por_persona ?? 0,
    meriendas_por_persona: p?.meriendas_por_persona ?? 0,
    cenas_por_persona: p?.cenas_por_persona ?? 0,
    transporte_4x4: p?.transporte_4x4 ?? false,
    precio_4x4: Number(p?.precio_4x4 ?? 0),
    unidad_4x4: (p?.unidad_4x4 ?? "c/u") as "c/u",
    transporte_barco: p?.transporte_barco ?? false,
    precio_barco: Number(p?.precio_barco ?? 0),
    unidad_barco: (p?.unidad_barco ?? "c/u") as "c/u",
    moneda: (p?.moneda ?? "USD") as "USD",
    variables: (p?.package_variables ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((v) => ({ nombre: v.nombre, descripcion: v.descripcion ?? "", monto: Number(v.monto), unidad: v.unidad as "c/u" })),
  };
}

async function load() {
  const { data: u } = await supabase.auth.getUser();
  const [pk, roles] = await Promise.all([
    supabase.from("packages").select("*, package_variables(*)").order("created_at"),
    supabase.from("user_roles").select("role").eq("user_id", u.user?.id ?? ""),
  ]);
  if (pk.error) throw pk.error;
  return { packages: pk.data as Pkg[], isAdmin: (roles.data ?? []).some((r) => r.role === "admin") };
}

function PaquetesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["packages"], queryFn: load });
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Pkg | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["packages"] });

  async function eliminar() {
    if (!toDelete) return;
    const { error, count } = await supabase.from("packages").delete({ count: "exact" }).eq("id", toDelete.id);
    setToDelete(null);
    if (error || !count) { toast.error(error?.message ?? "Solo un administrador puede eliminar paquetes"); return; }
    toast.success("Paquete eliminado");
    refresh();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Catálogo de paquetes" description="Tours y paquetes a Corcovado, Sirena y más." />
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nuevo paquete</Button>
      </div>

      {isLoading ? (
        <EmptyState message="Cargando paquetes..." />
      ) : !data?.packages.length ? (
        <EmptyState message="Aún no hay paquetes en el catálogo." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.packages.map((p) => {
            const comidas = [
              p.desayunos_por_persona && `${p.desayunos_por_persona} desayuno(s)`,
              p.meriendas_por_persona && `${p.meriendas_por_persona} merienda(s)`,
              p.cenas_por_persona && `${p.cenas_por_persona} cena(s)`,
            ].filter(Boolean);
            return (
              <article key={p.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-foreground">{p.titulo}</h2>
                  <Badge variant="secondary">{p.moneda}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.dias} día(s) · {p.noches} noche(s)
                </p>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  <li className="flex gap-2"><Bed className="h-4 w-4 text-muted-foreground" />{p.incluye_hospedaje ? `Hospedaje ${p.noches} noche(s)` : "Sin hospedaje"}</li>
                  <li className="flex gap-2">
                    <Utensils className="h-4 w-4 text-muted-foreground" />
                    {comidas.length ? `${comidas.join(", ")} por persona` : "Sin alimentación"}
                  </li>
                  {p.transporte_4x4 && (
                    <li className="flex gap-2"><Car className="h-4 w-4 text-muted-foreground" />4x4: {formatMonto(p.precio_4x4, p.moneda)} {p.unidad_4x4}</li>
                  )}
                  {p.transporte_barco && (
                    <li className="flex gap-2"><Ship className="h-4 w-4 text-muted-foreground" />Barco: {formatMonto(p.precio_barco, p.moneda)} {p.unidad_barco}</li>
                  )}
                  {!p.transporte_4x4 && !p.transporte_barco && <li className="flex gap-2"><Car className="h-4 w-4 text-muted-foreground" />Sin transporte</li>}
                </ul>
                {p.package_variables.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Variables extra</p>
                    {p.package_variables.map((v) => (
                      <p key={v.id} className="text-sm text-foreground">
                        {v.nombre}: {formatMonto(v.monto, p.moneda)} {v.unidad}
                        {v.descripcion && <span className="text-muted-foreground"> — {v.descripcion}</span>}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                  <Button size="sm" variant="outline" disabled={!data.isAdmin} onClick={() => setToDelete(p)} title={data.isAdmin ? undefined : "Solo un administrador puede eliminar"}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PackageDialog open={open} onOpenChange={setOpen} pkg={editing} onSaved={refresh} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{toDelete?.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar este paquete lo quitará del catálogo junto con sus variables extra, y ya no se podrá usar en nuevas cotizaciones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PackageDialog({ open, onOpenChange, pkg, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; pkg: Pkg | null; onSaved: () => void }) {
  const form = useForm<Values, unknown, Parsed>({ resolver: zodResolver(schema), defaultValues: defaults(pkg) });
  const vars = useFieldArray({ control: form.control, name: "variables" });
  useEffect(() => { if (open) form.reset(defaults(pkg)); }, [open, pkg, form]);
  const w4 = form.watch("transporte_4x4");
  const wb = form.watch("transporte_barco");

  async function onSubmit(v: Parsed) {
    const { variables, ...row } = v;
    let id = pkg?.id;
    if (pkg) {
      const { error } = await supabase.from("packages").update(row).eq("id", pkg.id);
      if (error) { toast.error(error.message); return; }
      const { error: de } = await supabase.from("package_variables").delete().eq("package_id", pkg.id);
      if (de) { toast.error(de.message); return; }
    } else {
      const { data, error } = await supabase.from("packages").insert(row).select("id").single();
      if (error) { toast.error(error.message); return; }
      id = data.id;
    }
    if (variables.length) {
      const { error } = await supabase.from("package_variables").insert(
        variables.map((x, i) => ({ package_id: id!, nombre: x.nombre, descripcion: x.descripcion || null, monto: x.monto, unidad: x.unidad, orden: i + 1 })),
      );
      if (error) { toast.error(error.message); return; }
    }
    toast.success(pkg ? "Paquete actualizado" : "Paquete creado");
    onOpenChange(false);
    onSaved();
  }

  const num = (name: Path<Values>, label: string, step = "1") => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input type="number" min={0} step={step} {...field} value={field.value as number} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
  const sw = (name: Path<Values>, label: string) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex items-center gap-3 space-y-0">
        <FormControl><Switch checked={field.value as boolean} onCheckedChange={field.onChange} /></FormControl>
        <FormLabel className="font-normal">{label}</FormLabel>
      </FormItem>
    )} />
  );
  const unidadSel = (name: Path<Values>, label = "Unidad") => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={field.value as string} onValueChange={field.onChange}>
          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>{UNIDADES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
        </Select>
      </FormItem>
    )} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{pkg ? "Editar paquete" : "Nuevo paquete"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <FormField control={form.control} name="titulo" render={({ field }) => (
                  <FormItem><FormLabel>Título *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              {num("dias", "Días")}
              {num("noches", "Noches")}
              <FormField control={form.control} name="moneda" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <fieldset className="space-y-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">Incluye</legend>
              <div className="flex flex-wrap gap-6">
                {sw("incluye_hospedaje", "Hospedaje")}
                {sw("incluye_desayuno", "Desayuno")}
                {sw("incluye_cena", "Cena")}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {num("desayunos_por_persona", "Desayunos por persona")}
                {num("meriendas_por_persona", "Meriendas por persona")}
                {num("cenas_por_persona", "Cenas por persona")}
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">Transporte</legend>
              {sw("transporte_4x4", "Transporte 4x4")}
              {w4 && <div className="grid gap-4 sm:grid-cols-2">{num("precio_4x4", "Precio 4x4", "0.01")}{unidadSel("unidad_4x4")}</div>}
              {sw("transporte_barco", "Transporte en barco")}
              {wb && <div className="grid gap-4 sm:grid-cols-2">{num("precio_barco", "Precio barco", "0.01")}{unidadSel("unidad_barco")}</div>}
            </fieldset>

            <fieldset className="space-y-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">Variables extra</legend>
              {vars.fields.map((v, i) => (
                <div key={v.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_120px_160px_auto] sm:items-end">
                  <FormField control={form.control} name={`variables.${i}.nombre`} render={({ field }) => (
                    <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`variables.${i}.descripcion`} render={({ field }) => (
                    <FormItem><FormLabel>Descripción</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                  )} />
                  {num(`variables.${i}.monto`, "Monto", "0.01")}
                  {unidadSel(`variables.${i}.unidad`)}
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar variable" onClick={() => vars.remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => vars.append({ nombre: "", descripcion: "", monto: 0, unidad: "c/u" })}>
                <Plus className="mr-2 h-4 w-4" /> Agregar variable
              </Button>
              <p className="text-xs text-muted-foreground">"c/u" se multiplica por la cantidad de personas; "Total" es un monto fijo.</p>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
