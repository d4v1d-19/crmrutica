import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-my-role";
import { tienePermiso } from "@/lib/permisos";
import { hoyCR } from "@/lib/facturas";
import { formatMonto } from "@/lib/money";
import { MEDIDAS } from "@/lib/clientes";
import { comision, rangoPeriodo, resumenFacturas, type EstadoResumen, type InvoiceLite, type Montos, type Periodo } from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Rutica CRM" },
      { name: "description", content: "Resumen de facturas, clientes, cotizaciones y agentes de Rutica." },
      { property: "og:title", content: "Dashboard — Rutica CRM" },
      { property: "og:description", content: "Resumen de facturas, clientes, cotizaciones y agentes de Rutica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const dayCR = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date(iso));
const ESTADOS_F = [
  { k: "pendiente", label: "Pendientes", color: "var(--chart-4)" },
  { k: "pagada_parcialmente", label: "Pagadas parcialmente", color: "var(--chart-2)" },
  { k: "pagada", label: "Pagadas", color: "var(--chart-3)" },
  { k: "expirada", label: "Expiradas", color: "var(--destructive)" },
] as const;
const ESTADOS_Q = [
  { k: "no_enviada", label: "No enviadas", color: "var(--chart-4)" },
  { k: "enviada", label: "Enviadas", color: "var(--chart-2)" },
  { k: "enviada_retrasada", label: "Enviadas/retrasadas", color: "var(--chart-1)" },
] as const;

async function loadAll() {
  const [cl, inv, q, ag] = await Promise.all([
    supabase.from("clients").select("id, estado, medida_interes, agente_id, created_at"),
    supabase.from("invoices").select("id, total, moneda, fecha_vencimiento, agente_id, created_at, clients(agente_id), payments(monto, fecha)"),
    supabase.from("quotes_view").select("id, agente_id, estado_efectivo, created_at"),
    supabase.rpc("dashboard_agents"),
  ]);
  for (const r of [cl, inv, q]) if (r.error) throw r.error;
  const invoices: InvoiceLite[] = (inv.data ?? []).map((i) => ({
    id: i.id,
    total: Number(i.total),
    moneda: i.moneda,
    fecha_vencimiento: i.fecha_vencimiento,
    agente: i.agente_id ?? (i.clients as unknown as { agente_id: string | null } | null)?.agente_id ?? null,
    dia: dayCR(i.created_at),
    pagos: ((i.payments ?? []) as { monto: number; fecha: string }[]).map((p) => ({ monto: Number(p.monto), fecha: p.fecha })),
  }));
  return {
    clients: (cl.data ?? []).map((c) => ({ ...c, dia: dayCR(c.created_at) })),
    invoices,
    quotes: (q.data ?? []).map((x) => ({ agente: x.agente_id, estado: x.estado_efectivo ?? "", dia: dayCR(x.created_at ?? new Date().toISOString()) })),
    agents: ag.data ?? [],
  };
}
type Data = Awaited<ReturnType<typeof loadAll>>;

const montos = (m: Montos) => {
  const e = Object.entries(m).filter(([, v]) => v);
  return e.length ? e.map(([k, v]) => formatMonto(v, k)).join(" · ") : formatMonto(0, "USD");
};

function DashboardPage() {
  const { data: me } = useMyRole();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: loadAll });
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [offset, setOffset] = useState(0);
  const hoy = hoyCR();
  const rango = rangoPeriodo(periodo, offset, hoy);

  const can = (k: string) => !!me && tienePermiso(k, { isAdmin: me.isAdmin, permisos: me.permisos });
  const simple = { facturas: can("dashboard.simple.facturas"), potenciales: can("dashboard.simple.potenciales"), oficiales: can("dashboard.simple.oficiales") };
  const general = { potenciales: can("dashboard.general.potenciales"), oficiales: can("dashboard.general.oficiales"), facturas: can("dashboard.general.facturas"), agentes: can("dashboard.general.agentes") };
  const hasSimple = Object.values(simple).some(Boolean);
  const hasGeneral = Object.values(general).some(Boolean);

  const selector = (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-md border border-border p-0.5">
        {(["semana", "mes", "anio"] as Periodo[]).map((p) => (
          <Button key={p} size="sm" variant={periodo === p ? "default" : "ghost"} onClick={() => { setPeriodo(p); setOffset(0); }}>
            {p === "semana" ? "Semana" : p === "mes" ? "Mes" : "Año"}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" aria-label="Periodo anterior" onClick={() => setOffset((o) => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-44 text-center text-sm font-medium capitalize text-foreground">{rango.label}</span>
        <Button size="icon" variant="outline" aria-label="Periodo siguiente" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  if (!me || isLoading) return <><PageHeader title="Dashboard" /><EmptyState message="Cargando dashboard..." /></>;
  if (error || !data) return <><PageHeader title="Dashboard" /><EmptyState message="No se pudo cargar el dashboard." /></>;
  if (!hasSimple && !hasGeneral)
    return <><PageHeader title="Dashboard" /><EmptyState message="No tienes bloques del dashboard asignados. Pide acceso a un administrador." /></>;

  const props = { data, desde: rango.desde, hasta: rango.hasta, hoy, myId: me.userId! };
  return (
    <>
      <PageHeader title="Dashboard" description="Resumen de la operación por periodo." />
      {selector}
      {hasSimple && hasGeneral ? (
        <Tabs defaultValue="mi">
          <TabsList>
            <TabsTrigger value="mi">Mi dashboard</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>
          <TabsContent value="mi" className="mt-6"><Sencillo {...props} show={simple} /></TabsContent>
          <TabsContent value="general" className="mt-6"><General {...props} show={general} /></TabsContent>
        </Tabs>
      ) : hasSimple ? <Sencillo {...props} show={simple} /> : <General {...props} show={general} />}
    </>
  );
}

type P = { data: Data; desde: string; hasta: string; hoy: string; myId: string };
const enRango = (dia: string, p: { desde: string; hasta: string }) => dia >= p.desde && dia <= p.hasta;

function Kpi({ label, value, sub, sub2, swatch }: { label: string; value: string | number; sub?: string; sub2?: string[]; swatch?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {swatch && <span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: swatch }} />}{label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      {sub2?.map((t) => <p key={t} className="text-xs text-muted-foreground">{t}</p>)}
    </div>
  );
}

function Stacked({ title, parts }: { title: string; parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      {total === 0 ? <p className="py-3 text-sm text-muted-foreground">Sin datos en el periodo.</p> : (
        <div className="flex h-8 w-full overflow-hidden rounded-md border border-border">
          {parts.filter((p) => p.value > 0).map((p) => (
            <div key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }} className="h-full border-r border-border last:border-r-0" />
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => <span key={p.label} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />{p.label}: {p.value}</span>)}
      </div>
    </div>
  );
}

const saldo = (t: Montos, c: Montos): Montos => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round((v - (c[k] ?? 0)) * 100) / 100]));

function FacturasBlock({ r, extra }: { r: EstadoResumen; extra?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Facturas</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ESTADOS_F.map((e) => <Kpi key={e.k} label={e.label} value={r[e.k].cantidad} sub={`Total: ${montos(r[e.k].montos)}`} sub2={e.k === "pagada_parcialmente" && r[e.k].cantidad ? [`Cobrado: ${montos(r[e.k].cobrado)}`, `Saldo: ${montos(saldo(r[e.k].montos, r[e.k].cobrado))}`] : undefined} swatch={e.color} />)}
      </div>
      {extra}
      <Stacked title="Estado de facturas" parts={ESTADOS_F.map((e) => ({ label: e.label, value: r[e.k].cantidad, color: e.color }))} />
    </section>
  );
}

function PotencialesBlock({ rows }: { rows: { medida_interes: string | null }[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Clientes potenciales</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total" value={rows.length} />
        {MEDIDAS.map((m) => <Kpi key={m.value} label={m.label} swatch={m.color} value={rows.filter((c) => c.medida_interes === m.value).length} />)}
      </div>
      <Stacked title="Por medida de interés" parts={[
        ...MEDIDAS.map((m) => ({ label: m.label, value: rows.filter((c) => c.medida_interes === m.value).length, color: m.color })),
        { label: "Sin clasificar", value: rows.filter((c) => !c.medida_interes).length, color: "var(--muted)" },
      ]} />
    </section>
  );
}

function Sencillo({ data, desde, hasta, hoy, myId, show }: P & { show: { facturas: boolean; potenciales: boolean; oficiales: boolean } }) {
  const me = data.agents.find((a) => a.id === myId);
  const invs = data.invoices.filter((i) => i.agente === myId);
  const enPer = invs.filter((i) => enRango(i.dia, { desde, hasta }));
  const clients = data.clients.filter((c) => c.agente_id === myId && enRango(c.dia, { desde, hasta }));
  const pct = Number(me?.comision_porcentaje ?? 0);
  return (
    <div className="space-y-8">
      {show.facturas && (
        <FacturasBlock r={resumenFacturas(enPer, hoy)} extra={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label={`Mi comisión (${pct}%)`} value={montos(comision(invs, pct, desde, hasta))} sub="Sobre lo cobrado en el periodo" /></div>
        } />
      )}
      {show.potenciales && <PotencialesBlock rows={clients.filter((c) => c.estado === "potencial")} />}
      {show.oficiales && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Clientes oficiales</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Total" value={clients.filter((c) => c.estado === "oficial").length} /></div>
        </section>
      )}
    </div>
  );
}

function General({ data, desde, hasta, hoy, show }: P & { show: { potenciales: boolean; oficiales: boolean; facturas: boolean; agentes: boolean } }) {
  const r = { desde, hasta };
  const invs = data.invoices.filter((i) => enRango(i.dia, r));
  const clients = data.clients.filter((c) => enRango(c.dia, r));
  const quotes = data.quotes.filter((q) => enRango(q.dia, r));
  const agentes = useMemo(() => data.agents.map((a) => {
    const ai = data.invoices.filter((i) => i.agente === a.id);
    const res = resumenFacturas(ai.filter((i) => enRango(i.dia, r)), hoy);
    const ac = clients.filter((c) => c.agente_id === a.id);
    const aq = quotes.filter((q) => q.agente === a.id);
    return {
      a, res, com: comision(ai, Number(a.comision_porcentaje), desde, hasta),
      pot: ac.filter((c) => c.estado === "potencial").length, ofi: ac.filter((c) => c.estado === "oficial").length,
      env: aq.filter((q) => q.estado === "enviada").length, noEnv: aq.filter((q) => q.estado === "no_enviada").length, ret: aq.filter((q) => q.estado === "enviada_retrasada").length,
    };
  }), [data, desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8">
      {show.potenciales && (
        <>
          <PotencialesBlock rows={clients.filter((c) => c.estado === "potencial")} />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Cotizaciones</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {ESTADOS_Q.map((e) => <Kpi key={e.k} label={e.label} swatch={e.color} value={quotes.filter((q) => q.estado === e.k).length} />)}
            </div>
            <Stacked title="Estado de cotizaciones" parts={ESTADOS_Q.map((e) => ({ label: e.label, value: quotes.filter((q) => q.estado === e.k).length, color: e.color }))} />
          </section>
        </>
      )}
      {show.oficiales && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Clientes oficiales</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Total" value={clients.filter((c) => c.estado === "oficial").length} /></div>
        </section>
      )}
      {show.facturas && <FacturasBlock r={resumenFacturas(invs, hoy)} />}
      {show.agentes && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Agentes</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Pagadas</TableHead>
                  <TableHead className="text-right">Parciales</TableHead>
                  <TableHead className="text-right">Pendientes</TableHead>
                  <TableHead className="text-right">Expiradas</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Potenciales</TableHead>
                  <TableHead className="text-right">Oficiales</TableHead>
                  <TableHead className="text-right">Cot. enviadas</TableHead>
                  <TableHead className="text-right">No enviadas</TableHead>
                  <TableHead className="text-right">Retrasadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentes.map((x) => (
                  <TableRow key={x.a.id}>
                    <TableCell className="font-medium">{x.a.nombre || x.a.email}{!x.a.activo && <span className="ml-1 text-xs text-muted-foreground">(inactivo)</span>}</TableCell>
                    <TableCell className="text-right">{x.res.pagada.cantidad}</TableCell>
                    <TableCell className="text-right">{x.res.pagada_parcialmente.cantidad}</TableCell>
                    <TableCell className="text-right">{x.res.pendiente.cantidad}</TableCell>
                    <TableCell className="text-right">{x.res.expirada.cantidad}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{montos(x.com)}</TableCell>
                    <TableCell className="text-right">{x.pot}</TableCell>
                    <TableCell className="text-right">{x.ofi}</TableCell>
                    <TableCell className="text-right">{x.env}</TableCell>
                    <TableCell className="text-right">{x.noEnv}</TableCell>
                    <TableCell className="text-right">{x.ret}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
