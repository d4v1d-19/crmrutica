import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { formatFecha } from "@/lib/clientes";
import { formatMonto } from "@/lib/money";
import { generarPdfCotizacion, type QuoteSnapshot } from "@/lib/pdf-cotizacion";

export const Route = createFileRoute("/_authenticated/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones — Rutica CRM" },
      { name: "description", content: "Cotizaciones enviadas a clientes de Rutica." },
      { property: "og:title", content: "Cotizaciones — Rutica CRM" },
      { property: "og:description", content: "Cotizaciones enviadas a clientes de Rutica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CotizacionesPage,
});

const ESTADOS = [
  { value: "no_enviada", label: "No enviadas", one: "No enviada" },
  { value: "enviada", label: "Enviadas", one: "Enviada" },
  { value: "enviada_retrasada", label: "Enviadas/retrasadas", one: "Enviada/retrasada" },
  { value: "aprobada", label: "Aprobadas", one: "Aprobada" },
] as const;
const ALL = "__all";

async function load() {
  const [q, company] = await Promise.all([
    supabase.from("quotes_view").select("*, clients(id, codigo, name, estado)").order("created_at", { ascending: false }),
    supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (q.error) throw q.error;
  return { quotes: q.data, company: company.data };
}
type Q = Awaited<ReturnType<typeof load>>["quotes"][number];
type C = { id: string; codigo: string; name: string; estado: string } | null;

function CotizacionesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["quotes"], queryFn: load });
  const [f, setF] = useState({ desde: "", hasta: "", numero: "", cliente: "", estado: ALL });
  const [toDelete, setToDelete] = useState<Q | null>(null);
  const [toConvert, setToConvert] = useState<Q | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["quotes"] });
  const client = (q: Q) => q.clients as unknown as C;

  const filtered = useMemo(() => {
    const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date(iso));
    return (data?.quotes ?? []).filter((q) => {
      const d = day(q.created_at!);
      return (
        (!f.desde || d >= f.desde) &&
        (!f.hasta || d <= f.hasta) &&
        (!f.numero || String(q.numero) === f.numero.trim()) &&
        (!f.cliente || (client(q)?.name ?? "").toLowerCase().includes(f.cliente.toLowerCase()) || (client(q)?.codigo ?? "").toLowerCase().includes(f.cliente.toLowerCase())) &&
        (f.estado === ALL || q.estado_efectivo === f.estado)
      );
    });
  }, [data, f]);

  async function cambiarEstado(q: Q, estado: string) {
    const { error } = await supabase.from("quotes").update({ estado }).eq("id", q.id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    refresh();
  }

  async function eliminar() {
    if (!toDelete) return;
    const { error, count } = await supabase.from("quotes").delete({ count: "exact" }).eq("id", toDelete.id!);
    setToDelete(null);
    if (error || !count) { toast.error(error?.message ?? "Solo un administrador puede eliminar cotizaciones"); return; }
    toast.success("Cotización eliminada");
    refresh();
  }

  async function crearFactura(q: Q, convertirCliente: boolean) {
    const c = client(q);
    if (!c) return;
    if (convertirCliente) {
      const { error } = await supabase.from("clients").update({ estado: "oficial" }).eq("id", c.id);
      if (error) { toast.error(error.message); return; }
    }
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({ client_id: c.id, quote_id: q.id!, moneda: q.moneda!, snapshot: q.snapshot as never, total: q.total!, fecha_vencimiento: q.fecha_vencimiento })
      .select("numero")
      .single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("quotes").update({ estado: "aprobada" }).eq("id", q.id!);
    toast.success(`Factura ${inv.numero} creada${convertirCliente ? ` y ${c.name} ahora es cliente oficial` : ""}`);
    refresh();
  }

  function onConvertir(q: Q) {
    if (client(q)?.estado === "oficial") void crearFactura(q, false);
    else setToConvert(q);
  }

  async function pdf(q: Q) {
    const c = client(q);
    try {
      await generarPdfCotizacion({
        numero: q.numero!,
        cliente: c ? `${c.codigo} · ${c.name}` : "—",
        creada: q.created_at!,
        vence: q.fecha_vencimiento,
        moneda: q.moneda!,
        snapshot: (q.snapshot ?? {}) as QuoteSnapshot,
        empresa: data?.company ?? { nombre: "Rutica", correo: null, telefono: null, direccion: null, cedula_juridica: null, logo_url: null },
      });
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  }

  const tabla = (rows: Q[]) =>
    rows.length === 0 ? (
      <p className="px-4 py-6 text-sm text-muted-foreground">Sin cotizaciones.</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha agregada</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-52">Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((q) => {
            const c = client(q);
            return (
              <TableRow key={q.id}>
                <TableCell className="font-mono">{q.numero}</TableCell>
                <TableCell>{c ? `${c.codigo} · ${c.name}` : "—"}</TableCell>
                <TableCell>{formatFecha(q.created_at!)}</TableCell>
                <TableCell className="text-right font-medium">{formatMonto(q.total ?? 0, q.moneda ?? "USD")}</TableCell>
                <TableCell>
                  <Select value={q.estado_efectivo === "enviada_retrasada" ? "enviada" : q.estado!} onValueChange={(v) => cambiarEstado(q, v)}>
                    <SelectTrigger>
                      <SelectValue>{ESTADOS.find((e) => e.value === q.estado_efectivo)?.one}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_enviada">No enviada</SelectItem>
                      <SelectItem value="enviada">Enviada</SelectItem>
                      <SelectItem value="aprobada">Aprobada</SelectItem>
                    </SelectContent>
                  </Select>
                  {q.fecha_envio && <p className="mt-1 text-xs text-muted-foreground">Enviada el {formatFecha(`${q.fecha_envio}T12:00:00-06:00`)}</p>}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Acciones"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => pdf(q)}>Generar PDF (proforma)</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onConvertir(q)}>Convertir en factura</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setToDelete(q)}>Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );

  return (
    <>
      <PageHeader title="Cotizaciones" description="Cotizaciones creadas desde la calculadora de precios." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Número</Label><Input inputMode="numeric" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Cliente</Label><Input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={f.estado} onValueChange={(v) => setF({ ...f, estado: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.one}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <EmptyState message="Cargando cotizaciones..." />
      ) : !data?.quotes.length ? (
        <EmptyState message="Aún no hay cotizaciones. Créalas desde la Calculadora de precios." />
      ) : (
        <div className="space-y-6">
          {ESTADOS.filter((e) => f.estado === ALL || f.estado === e.value).map((e) => {
            const rows = filtered.filter((q) => q.estado_efectivo === e.value);
            return (
              <section key={e.value} className="overflow-hidden rounded-lg border border-border">
                <h2 className="flex justify-between bg-muted px-4 py-2 text-sm font-semibold text-foreground">
                  {e.label} <span className="font-normal">{rows.length}</span>
                </h2>
                {tabla(rows)}
              </section>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la cotización {toDelete?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta cotización se le eliminará al cliente: {toDelete ? client(toDelete)?.name : ""}, tendrá que hacerla desde cero
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toConvert} onOpenChange={(o) => !o && setToConvert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente potencial</AlertDialogTitle>
            <AlertDialogDescription>
              Para asignarle una factura oficial a un cliente potencial, primero debe convertirse en cliente oficial. ¿Desea convertirlo ahora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setToConvert(null); toast("El cliente no fue convertido a cliente oficial"); }}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const q = toConvert; setToConvert(null); if (q) void crearFactura(q, true); }}>Sí</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
