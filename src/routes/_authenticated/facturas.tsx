import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatFecha } from "@/lib/clientes";
import { formatMonto } from "@/lib/money";
import { generarPdfCotizacion, type QuoteSnapshot } from "@/lib/pdf-cotizacion";
import { estadoFactura, hoyCR, METODOS_PAGO, saldo, type EstadoFactura } from "@/lib/facturas";

export const Route = createFileRoute("/_authenticated/facturas")({
  validateSearch: (s: Record<string, unknown>): { cliente?: string } =>
    typeof s["cliente"] === "string" && s["cliente"] ? { cliente: s["cliente"] } : {},
  head: () => ({
    meta: [
      { title: "Facturas — Rutica CRM" },
      { name: "description", content: "Facturas, abonos y estados de pago de clientes de Rutica." },
      { property: "og:title", content: "Facturas — Rutica CRM" },
      { property: "og:description", content: "Facturas, abonos y estados de pago de clientes de Rutica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturasPage,
});

const ESTADOS: { value: EstadoFactura; label: string; one: string; variant: "default" | "secondary" | "destructive" | "outline" }[] = [
  { value: "pendiente", label: "Pendientes", one: "Pendiente", variant: "outline" },
  { value: "pagada_parcialmente", label: "Pagadas parcialmente", one: "Pagada parcialmente", variant: "secondary" },
  { value: "pagada", label: "Pagadas", one: "Pagada", variant: "default" },
  { value: "expirada", label: "Expiradas", one: "Expirada", variant: "destructive" },
];
const ALL = "__all";
const fechaISO = (d: string) => formatFecha(`${d}T12:00:00-06:00`);
const metodoLabel = (m: string) => METODOS_PAGO.find((x) => x.value === m)?.label ?? m;

type Pago = { id: string; monto: number; fecha: string; metodo: string; nota: string | null; registrado_por_nombre: string | null; created_at: string };
type Billing = { nombre_completo: string | null; razon_social: string | null; empresa: string | null; cedula: string | null; telefono: string | null; email: string | null };
type Cli = { id: string; codigo: string; name: string; client_billing: Billing | Billing[] | null } | null;

async function load() {
  const [inv, company] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(id, codigo, name, client_billing(*)), payments(id, monto, fecha, metodo, nota, registrado_por_nombre, created_at)")
      .order("created_at", { ascending: false }),
    supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (inv.error) throw inv.error;
  const hoy = hoyCR();
  const invoices = inv.data.map((i) => {
    const pagos = ((i.payments ?? []) as unknown as Pago[]).slice().sort((a, b) => (a.fecha + a.created_at).localeCompare(b.fecha + b.created_at));
    const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
    return { ...i, cliente: i.clients as unknown as Cli, pagos, pagado, saldo: saldo(Number(i.total), pagado), estado: estadoFactura(Number(i.total), pagado, i.fecha_vencimiento, hoy) };
  });
  return { invoices, company: company.data };
}
type F = Awaited<ReturnType<typeof load>>["invoices"][number];

function FacturasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/facturas" });
  const { cliente: clienteId } = Route.useSearch();
  const { data, isLoading } = useQuery({ queryKey: ["invoices"], queryFn: load });
  const [f, setF] = useState({ desde: "", hasta: "", numero: "", cliente: "", estado: ALL });
  const [toDelete, setToDelete] = useState<F | null>(null);
  const [abonoId, setAbonoId] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["invoices"] });
  const abono = data?.invoices.find((i) => i.id === abonoId) ?? null;
  const detalle = data?.invoices.find((i) => i.id === detalleId) ?? null;
  const clienteFijo = clienteId ? data?.invoices.find((i) => i.client_id === clienteId)?.cliente : null;

  const filtered = useMemo(() => {
    const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date(iso));
    const q = f.cliente.toLowerCase();
    return (data?.invoices ?? []).filter((i) => {
      const d = day(i.created_at);
      return (
        (!clienteId || i.client_id === clienteId) &&
        (!f.desde || d >= f.desde) &&
        (!f.hasta || d <= f.hasta) &&
        (!f.numero || i.numero.toLowerCase().includes(f.numero.trim().toLowerCase())) &&
        (!q || (i.cliente?.name ?? "").toLowerCase().includes(q) || (i.cliente?.codigo ?? "").toLowerCase().includes(q)) &&
        (f.estado === ALL || i.estado === f.estado)
      );
    });
  }, [data, f, clienteId]);

  async function eliminar() {
    if (!toDelete) return;
    const { error, count } = await supabase.from("invoices").delete({ count: "exact" }).eq("id", toDelete.id);
    setToDelete(null);
    if (error || !count) { toast.error(error?.message ?? "Solo un administrador puede eliminar facturas"); return; }
    toast.success("Factura eliminada");
    refresh();
  }

  async function pdf(i: F) {
    const raw = i.cliente?.client_billing;
    const b = (Array.isArray(raw) ? raw[0] : raw) ?? null;
    const lineas = b
      ? [b.nombre_completo ?? b.razon_social, b.empresa && `Empresa: ${b.empresa}`, b.cedula && `Cédula: ${b.cedula}`, b.telefono && `Tel: ${b.telefono}`, b.email].filter(Boolean) as string[]
      : [];
    try {
      await generarPdfCotizacion({
        titulo: "Factura",
        numero: i.numero,
        cliente: i.cliente ? `${i.cliente.codigo} · ${i.cliente.name}` : "—",
        clienteLineas: lineas,
        creada: i.created_at,
        vence: i.fecha_vencimiento,
        rangoLabel: "Vencimiento",
        moneda: i.moneda,
        snapshot: (i.snapshot ?? {}) as QuoteSnapshot,
        empresa: data?.company ?? { nombre: "Rutica", correo: null, telefono: null, direccion: null, cedula_juridica: null, logo_url: null },
        nota: "Factura proforma.",
        archivo: `factura-${i.numero}.pdf`,
      });
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  }

  const tabla = (rows: F[]) =>
    rows.length === 0 ? (
      <p className="px-4 py-6 text-sm text-muted-foreground">Sin facturas.</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha agregada</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Pagado</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((i) => {
            const e = ESTADOS.find((x) => x.value === i.estado)!;
            const puedeAbonar = i.estado === "pendiente" || i.estado === "pagada_parcialmente";
            return (
              <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetalleId(i.id)}>
                <TableCell className="font-mono">{i.numero}</TableCell>
                <TableCell>{i.cliente ? `${i.cliente.codigo} · ${i.cliente.name}` : "—"}</TableCell>
                <TableCell>{formatFecha(i.created_at)}</TableCell>
                <TableCell className="text-right font-medium">{formatMonto(i.total, i.moneda)}</TableCell>
                <TableCell className="text-right">{formatMonto(i.pagado, i.moneda)}</TableCell>
                <TableCell className="text-right">{formatMonto(i.saldo, i.moneda)}</TableCell>
                <TableCell><Badge variant={e.variant}>{e.one}</Badge></TableCell>
                <TableCell onClick={(ev) => ev.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Acciones"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDetalleId(i.id)}>Ver detalle e historial</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => pdf(i)}>Generar PDF (proforma)</DropdownMenuItem>
                      {puedeAbonar && <DropdownMenuItem onSelect={() => setAbonoId(i.id)}>Cancelación de factura</DropdownMenuItem>}
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setToDelete(i)}>Eliminar</DropdownMenuItem>
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
      <PageHeader title="Facturas" description="Facturas de clientes oficiales, abonos y estados de pago." />
      {clienteId && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mostrando facturas de:</span>
          <Badge variant="secondary" className="gap-1">
            {clienteFijo ? `${clienteFijo.codigo} · ${clienteFijo.name}` : "cliente seleccionado"}
            <button aria-label="Quitar filtro de cliente" onClick={() => navigate({ search: {} })}><X className="h-3 w-3" /></button>
          </Badge>
        </div>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Número</Label><Input placeholder="FAC-0001" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></div>
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
        <EmptyState message="Cargando facturas..." />
      ) : !data?.invoices.length ? (
        <EmptyState message="Aún no hay facturas. Créalas desde la Calculadora o desde Cotizaciones." />
      ) : (
        <div className="space-y-6">
          {ESTADOS.filter((e) => f.estado === ALL || f.estado === e.value).map((e) => {
            const rows = filtered.filter((i) => i.estado === e.value);
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

      <AbonoDialog factura={abono} onClose={() => setAbonoId(null)} onSaved={refresh} />

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalleId(null)}>
        <DialogContent className="max-w-2xl">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle>Factura {detalle.numero}</DialogTitle>
                <DialogDescription>
                  {detalle.cliente ? `${detalle.cliente.codigo} · ${detalle.cliente.name}` : "—"} · Agregada {formatFecha(detalle.created_at)}
                  {detalle.fecha_vencimiento && ` · Vence ${fechaISO(detalle.fecha_vencimiento)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-border p-3"><p className="text-muted-foreground">Total</p><p className="font-semibold">{formatMonto(detalle.total, detalle.moneda)}</p></div>
                <div className="rounded-md border border-border p-3"><p className="text-muted-foreground">Pagado</p><p className="font-semibold">{formatMonto(detalle.pagado, detalle.moneda)}</p></div>
                <div className="rounded-md border border-border p-3"><p className="text-muted-foreground">Saldo</p><p className="font-semibold">{formatMonto(detalle.saldo, detalle.moneda)}</p></div>
              </div>
              <h3 className="mt-2 text-sm font-semibold">Historial de pagos</h3>
              {detalle.pagos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay abonos registrados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Registrado por</TableHead>
                      <TableHead className="text-right">Saldo restante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let acc = 0;
                      return detalle.pagos.map((p) => {
                        acc += Number(p.monto);
                        return (
                          <TableRow key={p.id}>
                            <TableCell>{fechaISO(p.fecha)}{p.nota && <p className="text-xs text-muted-foreground">{p.nota}</p>}</TableCell>
                            <TableCell className="text-right">{formatMonto(p.monto, detalle.moneda)}</TableCell>
                            <TableCell>{metodoLabel(p.metodo)}</TableCell>
                            <TableCell>{p.registrado_por_nombre ?? "—"}</TableCell>
                            <TableCell className="text-right">{formatMonto(saldo(Number(detalle.total), acc), detalle.moneda)}</TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => pdf(detalle)}>Generar PDF</Button>
                {(detalle.estado === "pendiente" || detalle.estado === "pagada_parcialmente") && (
                  <Button onClick={() => setAbonoId(detalle.id)}>Registrar abono</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la factura {toDelete?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta factura se le eliminará al cliente: {toDelete?.cliente?.name ?? ""}, tendrá que hacerla desde cero. El cliente seguirá siendo cliente oficial.
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

function AbonoDialog({ factura, onClose, onSaved }: { factura: F | null; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyCR());
  const [metodo, setMetodo] = useState("transferencia");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const n = Number(monto);
  const max = factura?.saldo ?? 0;
  const err = !monto ? null : !(n > 0) ? "El monto debe ser mayor a 0" : n > max + 1e-9 ? "El abono no puede exceder el saldo" : null;

  function close() { setMonto(""); setNota(""); setFecha(hoyCR()); onClose(); }

  async function guardar() {
    if (!factura || err || !(n > 0)) return;
    setSaving(true);
    const { error } = await supabase.from("payments").insert({ invoice_id: factura.id, monto: Math.round(n * 100) / 100, fecha, metodo, nota: nota || null });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(Math.abs(n - max) < 0.005 ? `Factura ${factura.numero} pagada por completo` : "Abono registrado");
    onSaved();
    close();
  }

  return (
    <Dialog open={!!factura} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelación de factura {factura?.numero}</DialogTitle>
          <DialogDescription>Saldo pendiente: {factura ? formatMonto(max, factura.moneda) : ""}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Monto ({factura?.moneda})</Label>
            <div className="flex gap-2">
              <Input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setMonto(String(max))}>Saldo total</Button>
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={metodo} onValueChange={setMetodo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METODOS_PAGO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Nota</Label><Textarea value={nota} onChange={(e) => setNota(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving || !!err || !(n > 0) || !fecha}>Registrar abono</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
