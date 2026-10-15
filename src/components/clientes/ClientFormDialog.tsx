import { useEffect, useMemo } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  CANALES_MANUALES,
  MEDIDAS,
  TIPOS_FACTURACION,
  billingRow,
  clientFormSchema,
  nullIfEmpty,
  paises,
  type ClientFormValues,
} from "@/lib/clientes";
import cr from "@/data/costa-rica.json";
import { SearchSelect } from "./SearchSelect";

type Client = Tables<"clients">;
type Billing = Tables<"client_billing">;
export type Agent = { id: string; nombre: string | null; email: string | null };
const division = cr as Record<string, Record<string, string[]>>;
const NONE = "__none";

function defaults(c: Client | null, b: Billing | null, me: string): ClientFormValues {
  return {
    name: c?.name ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    company: c?.company ?? "",
    pais: c?.pais ?? "",
    dni: c?.dni ?? "",
    notas: c?.notas ?? "",
    medida_interes: (c?.medida_interes ?? "") as ClientFormValues["medida_interes"],
    canal: (c?.canal ?? "WhatsApp") as ClientFormValues["canal"],
    agente_id: c?.agente_id ?? me,
    tipo_facturacion: (c?.tipo_facturacion ?? "no_necesita") as ClientFormValues["tipo_facturacion"],
    billing: {
      cedula: b?.cedula ?? "",
      nombre_comercial: b?.nombre_comercial ?? "",
      razon_social: b?.razon_social ?? "",
      actividad_economica: b?.actividad_economica ?? "",
      direccion_fiscal: b?.direccion_fiscal ?? "",
      telefono: b?.telefono ?? "",
      email: b?.email ?? "",
      provincia: b?.provincia ?? "",
      canton: b?.canton ?? "",
      distrito: b?.distrito ?? "",
      nombre_completo: b?.nombre_completo ?? "",
      empresa: b?.empresa ?? "",
    },
  };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  billing,
  agents,
  me,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client | null;
  billing: Billing | null;
  agents: Agent[];
  me: string;
  onSaved: () => void;
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaults(client, billing, me),
  });
  useEffect(() => {
    if (open) form.reset(defaults(client, billing, me));
  }, [open, client, billing, me, form]);

  const canalBloqueado = client?.canal === "Formulario";
  const tipo = form.watch("tipo_facturacion");
  const provincia = form.watch("billing.provincia");
  const canton = form.watch("billing.canton");
  const listaPaises = useMemo(() => paises(), []);

  async function onSubmit(v: ClientFormValues) {
    const row = {
      name: v.name.trim(),
      email: nullIfEmpty(v.email),
      phone: nullIfEmpty(v.phone),
      company: nullIfEmpty(v.company),
      pais: nullIfEmpty(v.pais),
      dni: nullIfEmpty(v.dni),
      notas: nullIfEmpty(v.notas),
      medida_interes: v.medida_interes || null,
      agente_id: nullIfEmpty(v.agente_id),
      tipo_facturacion: v.tipo_facturacion,
      ...(canalBloqueado ? {} : { canal: v.canal }),
    };
    let id = client?.id;
    if (client) {
      const { error } = await supabase.from("clients").update(row).eq("id", client.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...row, user_id: me })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      id = data.id;
    }
    if (v.tipo_facturacion === "no_necesita") {
      await supabase.from("client_billing").delete().eq("client_id", id!);
    } else {
      const { error } = await supabase.from("client_billing").upsert(billingRow(id!, v));
      if (error) { toast.error(error.message); return; }
    }
    toast.success(client ? "Cliente actualizado" : "Cliente creado");
    onOpenChange(false);
    onSaved();
  }

  const text = (name: Path<ClientFormValues>, label: string, type = "text") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} value={(field.value as string) ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? `Editar cliente ${client.codigo}` : "Agregar cliente"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {text("name", "Nombre *")}
              {text("email", "Correo electrónico", "email")}
              {text("phone", "Teléfono")}
              {text("company", "Empresa")}
              <FormField
                control={form.control}
                name="pais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <SearchSelect value={field.value} onChange={field.onChange} options={listaPaises} placeholder="Seleccionar país" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {text("dni", "Cédula o pasaporte")}
              <FormField
                control={form.control}
                name="canal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Canal *</FormLabel>
                    {canalBloqueado ? (
                      <Input value="Formulario" disabled />
                    ) : (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {CANALES_MANUALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medida_interes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medida de interés</FormLabel>
                    <Select value={field.value || NONE} onValueChange={(x) => field.onChange(x === NONE ? "" : x)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin clasificar</SelectItem>
                        {MEDIDAS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agente</FormLabel>
                    <Select value={field.value || NONE} onValueChange={(x) => field.onChange(x === NONE ? "" : x)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin agente</SelectItem>
                        {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre || a.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo_facturacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facturación</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TIPOS_FACTURACION.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )}
            />

            {tipo === "electronica" && (
              <fieldset className="space-y-4 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">Factura electrónica (Hacienda)</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("billing.cedula", "Cédula jurídica o física *")}
                  {text("billing.nombre_comercial", "Nombre comercial *")}
                  {text("billing.razon_social", "Razón social *")}
                  {text("billing.actividad_economica", "Actividad económica *")}
                  {text("billing.telefono", "Teléfono *")}
                  {text("billing.email", "Correo electrónico *", "email")}
                  <FormField
                    control={form.control}
                    name="billing.provincia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provincia *</FormLabel>
                        <SearchSelect
                          value={field.value}
                          options={Object.keys(division)}
                          onChange={(x) => {
                            field.onChange(x);
                            form.setValue("billing.canton", "");
                            form.setValue("billing.distrito", "");
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.canton"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantón *</FormLabel>
                        <SearchSelect
                          value={field.value}
                          disabled={!provincia}
                          options={provincia ? Object.keys(division[provincia] ?? {}) : []}
                          onChange={(x) => {
                            field.onChange(x);
                            form.setValue("billing.distrito", "");
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.distrito"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distrito *</FormLabel>
                        <SearchSelect
                          value={field.value}
                          disabled={!canton}
                          options={provincia && canton ? division[provincia]?.[canton] ?? [] : []}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {text("billing.direccion_fiscal", "Dirección fiscal *")}
              </fieldset>
            )}

            {tipo === "sencilla" && (
              <fieldset className="space-y-4 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">Factura sencilla</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("billing.nombre_completo", "Nombre completo *")}
                  {text("billing.empresa", "Empresa")}
                  {text("billing.telefono", "Teléfono")}
                  {text("billing.email", "Correo electrónico", "email")}
                </div>
                <p className="text-xs text-muted-foreground">Indica al menos teléfono o correo.</p>
              </fieldset>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
