import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, Plus, Trash2, Unlock, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { SearchSelect } from "@/components/clientes/SearchSelect";
import { supabase } from "@/integrations/supabase/client";
import { formatFecha } from "@/lib/clientes";
import { formatMonto, MONEDAS } from "@/lib/money";
import {
  APLICA_OPCIONES,
  calcular,
  personas,
  personasValidas,
  prefillFromResponse,
  type CalcVars,
  type Extra,
  type Porcentaje,
  type Tarifas,
} from "@/lib/calculadora";

type Search = { respuesta?: string };

export const Route = createFileRoute("/_authenticated/calculadora")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["respuesta"] === "string" && /^[0-9a-f-]{36}$/.test(s["respuesta"]) ? { respuesta: s["respuesta"] } : {},
  head: () => ({
    meta: [
      { title: "Calculadora de precios — Rutica CRM" },
      { name: "description", content: "Calcula precios de tours y conviértelos en cotizaciones o facturas." },
      { property: "og:title", content: "Calculadora de precios — Rutica CRM" },
      { property: "og:description", content: "Calcula precios de tours y conviértelos en cotizaciones o facturas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalculadoraPage,
});

const TARIFA_CAMPOS = [
  { key: "entrada_nacional", label: "Entrada nacional por persona por día (+ IVA)" },
  { key: "entrada_extranjero", label: "Entrada extranjero por persona por día (+ IVA)" },
  { key: "hospedaje", label: "Hospedaje por persona por noche" },
  { key: "desayuno", label: "Desayuno por persona" },
  { key: "merienda", label: "Merienda/almuerzo por persona" },
  { key: "cena", label: "Cena por persona" },
] as const;

const NONE = "__none";
const uid = (): string => crypto.randomUUID();
const plus15 = () => {
  const d = new Date(Date.now() + 15 * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(d);
};
const EMPTY_VARS: CalcVars = {
  dias: 1, noches: 0, adultos: 1, mayores: 0, ninos: 0, nacionales: 0, extranjeros: 1,
  hospedaje: true, t4x4: false, precio4x4: 0, barco: false, precioBarco: 0, comidasPaquete: null, extras: [],
};

async function load() {
  const { data: u } = await supabase.auth.getUser();
  const [settings, pcts, pkgs, clients, fields] = await Promise.all([
    supabase.from("price_settings").select("*").eq("id", 1).single(),
    supabase.from("percentages").select("*").order("created_at"),
    supabase.from("packages").select("*, package_variables(*)").order("titulo"),
    supabase.from("clients").select("id, codigo, name, estado").order("codigo"),
    supabase.from("form_fields").select("form_id").eq("variable", "total_personas"),
  ]);
  if (settings.error) throw settings.error;
  const formIds = [...new Set((fields.data ?? []).map((f) => f.form_id))];
  const subs = formIds.length
    ? await supabase
        .from("form_submissions")
        .select("id, data, created_at, client_id, clients(codigo, name)")
        .in("form_id", formIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  return {
    me: u.user!.id,
    settings: settings.data,
    percentages: pcts.data ?? [],
    packages: pkgs.data ?? [],
    clients: clients.data ?? [],
    responses: subs.data ?? [],
  };
}

function CalculadoraPage() {
  const { data, isLoading } = useQuery({ queryKey: ["calculadora"], queryFn: load });
  if (isLoading || !data) return <EmptyState message="Cargando calculadora..." />;
  return <Calculadora data={data} />;
}

function Num({ label, value, onChange, step = 1, disabled }: { label: string; value: number; onChange: (n: number) => void; step?: number; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step={step}
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? (step === 1 ? Math.trunc(n) : n) : 0);
        }}
      />
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Calculadora({ data }: { data: Awaited<ReturnType<typeof load>> }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { respuesta } = Route.useSearch();
  const s = data.settings;
  const toTarifas = (): Tarifas => ({
    moneda: s.moneda,
    entrada_nacional: Number(s.entrada_nacional),
    entrada_extranjero: Number(s.entrada_extranjero),
    hospedaje: Number(s.hospedaje),
    desayuno: Number(s.desayuno),
    merienda: Number(s.merienda),
    cena: Number(s.cena),
  });
  const [tarifas, setTarifas] = useState<Tarifas>(toTarifas);
  const [unlocked, setUnlocked] = useState(false);
  const [v, setV] = useState<CalcVars>(EMPTY_VARS);
  const [paqueteId, setPaqueteId] = useState<string>(NONE);
  const [respuestaId, setRespuestaId] = useState<string>(NONE);
  const [aplicados, setAplicados] = useState<Porcentaje[]>(() =>
    data.percentages.filter((p) => p.aplicar_por_defecto).map((p) => ({ id: p.id, nombre: p.nombre, porcion: Number(p.porcion), aplica_a: p.aplica_a })),
  );
  const [nuevoPct, setNuevoPct] = useState({ nombre: "", porcion: "", aplica_a: [] as string[], guardar: "no" });
  const [delPct, setDelPct] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [vence, setVence] = useState(plus15);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<CalcVars>) => setV((x) => ({ ...x, ...patch }));
  const r = useMemo(() => calcular(tarifas, v, aplicados), [tarifas, v, aplicados]);
  const valid = personasValidas(v) && personas(v) > 0;
  const fmt = (n: number) => formatMonto(n, tarifas.moneda);

  function cargarPaquete(id: string) {
    setPaqueteId(id);
    const p = data.packages.find((x) => x.id === id);
    if (!p) { set({ comidasPaquete: null }); return; }
    set({
      dias: p.dias,
      noches: p.noches,
      hospedaje: p.incluye_hospedaje,
      comidasPaquete: { desayunos: p.desayunos_por_persona, meriendas: p.meriendas_por_persona, cenas: p.cenas_por_persona },
      t4x4: p.transporte_4x4,
      precio4x4: Number(p.precio_4x4),
      barco: p.transporte_barco,
      precioBarco: Number(p.precio_barco),
      extras: [
        // Package transport priced as a fixed total becomes a fixed extra so the per-person line stays correct.
        ...(p.transporte_4x4 && p.unidad_4x4 === "total" ? [{ id: uid(), nombre: "Transporte 4x4 (total)", monto: Number(p.precio_4x4), unidad: "total" as const }] : []),
        ...(p.transporte_barco && p.unidad_barco === "total" ? [{ id: uid(), nombre: "Transporte barco (total)", monto: Number(p.precio_barco), unidad: "total" as const }] : []),
        ...p.package_variables
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((x) => ({ id: uid(), nombre: x.nombre, descripcion: x.descripcion ?? "", monto: Number(x.monto), unidad: x.unidad as Extra["unidad"] })),
      ],
    });
    if (p.unidad_4x4 === "total") set({ t4x4: false });
    if (p.unidad_barco === "total") set({ barco: false });
    toast.success(`Campos llenados con "${p.titulo}"`);
  }

  function cargarRespuesta(id: string) {
    setRespuestaId(id);
    const resp = data.responses.find((x) => x.id === id);
    if (!resp) return;
    set(prefillFromResponse((resp.data ?? {}) as Record<string, unknown>));
    if (resp.client_id) setClientId(resp.client_id);
    toast.success("Cantidades cargadas desde la respuesta");
  }

  useEffect(() => {
    if (respuesta && data.responses.some((x) => x.id === respuesta)) cargarRespuesta(respuesta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuesta]);

  async function guardarTarifas() {
    const { error } = await supabase.from("price_settings").update({ ...tarifas }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarifas guardadas");
    setUnlocked(false);
    qc.invalidateQueries({ queryKey: ["calculadora"] });
  }

  async function agregarPorcentaje() {
    const porcion = Number(nuevoPct.porcion.replace(",", "."));
    if (!nuevoPct.nombre.trim() || !Number.isFinite(porcion) || porcion < 0 || porcion > 10 || !nuevoPct.aplica_a.length) {
      toast.error("Completa nombre, porción decimal (ej. 0.13) y a qué se aplica");
      return;
    }
    let id = uid();
    if (nuevoPct.guardar === "si") {
      const { data: row, error } = await supabase
        .from("percentages")
        .insert({ nombre: nuevoPct.nombre.trim(), porcion, aplica_a: nuevoPct.aplica_a })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      id = row.id;
      qc.invalidateQueries({ queryKey: ["calculadora"] });
    }
    setAplicados((a) => [...a, { id, nombre: nuevoPct.nombre.trim(), porcion, aplica_a: nuevoPct.aplica_a }]);
    setNuevoPct({ nombre: "", porcion: "", aplica_a: [], guardar: "no" });
  }

  async function borrarPorcentaje() {
    if (!delPct) return;
    const { error } = await supabase.from("percentages").delete().eq("id", delPct);
    setDelPct(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Porcentaje eliminado");
    qc.invalidateQueries({ queryKey: ["calculadora"] });
  }

  const client = data.clients.find((c) => c.id === clientId);
  const clientLabel = (c: { codigo: string; name: string; estado: string }) => `${c.codigo} · ${c.name} (${c.estado})`;
  const snapshot = () => ({
    generado: new Date().toISOString(),
    tarifas,
    variables: v,
    paquete: data.packages.find((p) => p.id === paqueteId)?.titulo ?? null,
    respuesta_id: respuestaId === NONE ? null : respuestaId,
    porcentajes: r.porcentajes,
    desglose: r.lineas,
    personas: r.personas,
    subtotal: r.subtotal,
    total: r.total,
  });

  async function convertir(tipo: "quote" | "invoice") {
    if (!client || !valid) return;
    setBusy(true);
    try {
      const base = { client_id: client.id, agente_id: data.me, moneda: tarifas.moneda, snapshot: snapshot() as never, total: r.total, fecha_vencimiento: vence || null };
      if (tipo === "quote") {
        const { error } = await supabase.from("quotes").insert(base);
        if (error) throw error;
        toast.success(`Cotización creada para ${client.name}`);
        navigate({ to: "/cotizaciones" });
      } else {
        const { data: inv, error } = await supabase.from("invoices").insert(base).select("numero").single();
        if (error) throw error;
        toast.success(`Factura ${inv.numero} creada para ${client.name}`);
        navigate({ to: "/facturas" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo convertir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Calculadora de precios" description="Calcula precios de tours y conviértelos en cotizaciones o facturas." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card
            title="Tarifas base"
            action={
              unlocked ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setTarifas(toTarifas()); setUnlocked(false); }}>Cancelar</Button>
                  <Button size="sm" onClick={guardarTarifas}>Guardar</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setUnlocked(true)}><Unlock className="mr-2 h-4 w-4" /> Alterar variables</Button>
              )
            }
          >
            {unlocked && (
              <div className="mb-4 flex gap-2 rounded-md border border-border bg-muted p-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                Estos campos deben ser fieles a los precios brindados por el ADI
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Select value={tarifas.moneda} disabled={!unlocked} onValueChange={(m) => setTarifas({ ...tarifas, moneda: m })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {TARIFA_CAMPOS.map((c) => (
                <Num key={c.key} label={c.label} step={0.01} disabled={!unlocked} value={tarifas[c.key]} onChange={(n) => setTarifas({ ...tarifas, [c.key]: n })} />
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              {!unlocked && <Lock className="h-3 w-3" />}
              Última modificación: {formatFecha(s.updated_at)}{s.updated_by_nombre ? ` por ${s.updated_by_nombre}` : ""}
            </p>
          </Card>

          <Card title="Variables de la cotización">
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Llenar campos con paquete existente</Label>
                <Select value={paqueteId} onValueChange={cargarPaquete}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ninguno</SelectItem>
                    {data.packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cargar desde respuesta de formulario</Label>
                <Select value={respuestaId} onValueChange={cargarRespuesta}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ninguna</SelectItem>
                    {data.responses.map((x) => {
                      const c = x.clients as { codigo: string; name: string } | null;
                      const d = (x.data ?? {}) as Record<string, unknown>;
                      return (
                        <SelectItem key={x.id} value={x.id}>
                          {formatFecha(x.created_at)} · {c ? c.name : String(d["email"] ?? "Sin cliente")} · {String(d["total_personas"] ?? "?")} pers.
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {v.comidasPaquete && (
              <p className="mb-4 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Comidas por persona del paquete: {v.comidasPaquete.desayunos} desayuno(s), {v.comidasPaquete.meriendas} merienda(s), {v.comidasPaquete.cenas} cena(s)
                <button type="button" className="underline" onClick={() => { set({ comidasPaquete: null }); setPaqueteId(NONE); }}>Usar días/noches</button>
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-4">
              <Num label="Días" value={v.dias} onChange={(n) => set({ dias: n })} />
              <Num label="Noches" value={v.noches} onChange={(n) => set({ noches: n })} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Num label="Adultos (12 a 65 años)" value={v.adultos} onChange={(n) => set({ adultos: n })} />
              <Num label="Adultos mayores (> 65)" value={v.mayores} onChange={(n) => set({ mayores: n })} />
              <Num label="Niños (≤ 11)" value={v.ninos} onChange={(n) => set({ ninos: n })} />
              <Num label="Nacionales" value={v.nacionales} onChange={(n) => set({ nacionales: n })} />
              <Num label="Extranjeros" value={v.extranjeros} onChange={(n) => set({ extranjeros: n })} />
            </div>
            {!personasValidas(v) && (
              <p className="mt-3 text-sm text-destructive">
                Nacionales + extranjeros ({v.nacionales + v.extranjeros}) debe ser igual a adultos + adultos mayores + niños ({personas(v)}).
              </p>
            )}
            <div className="mt-5 space-y-3">
              <label className="flex items-center gap-3 text-sm"><Switch checked={v.hospedaje} onCheckedChange={(c) => set({ hospedaje: c })} /> Incluir hospedaje</label>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-3 text-sm"><Checkbox checked={v.t4x4} onCheckedChange={(c) => set({ t4x4: c === true })} /> Transporte 4x4 (por persona)</label>
                {v.t4x4 && <div className="w-40"><Num label="Precio por persona" step={0.01} value={v.precio4x4} onChange={(n) => set({ precio4x4: n })} /></div>}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-3 text-sm"><Checkbox checked={v.barco} onCheckedChange={(c) => set({ barco: c === true })} /> Transporte barco (por persona)</label>
                {v.barco && <div className="w-40"><Num label="Precio por persona" step={0.01} value={v.precioBarco} onChange={(n) => set({ precioBarco: n })} /></div>}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {v.extras.map((e) => (
                <div key={e.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_110px_150px_auto] sm:items-end">
                  <div className="space-y-1.5"><Label className="text-xs">Nombre</Label><Input maxLength={200} value={e.nombre} onChange={(ev) => set({ extras: v.extras.map((x) => (x.id === e.id ? { ...x, nombre: ev.target.value } : x)) })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Descripción</Label><Input maxLength={500} value={e.descripcion ?? ""} onChange={(ev) => set({ extras: v.extras.map((x) => (x.id === e.id ? { ...x, descripcion: ev.target.value } : x)) })} /></div>
                  <Num label="Monto" step={0.01} value={e.monto} onChange={(n) => set({ extras: v.extras.map((x) => (x.id === e.id ? { ...x, monto: n } : x)) })} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unidad</Label>
                    <Select value={e.unidad} onValueChange={(u) => set({ extras: v.extras.map((x) => (x.id === e.id ? { ...x, unidad: u as Extra["unidad"] } : x)) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="c/u">c/u (por persona)</SelectItem><SelectItem value="total">Total (fijo)</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Quitar variable" onClick={() => set({ extras: v.extras.filter((x) => x.id !== e.id) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => set({ extras: [...v.extras, { id: uid(), nombre: "", descripcion: "", monto: 0, unidad: "c/u" }] })}>
                <Plus className="mr-2 h-4 w-4" /> Agregar otra variable
              </Button>
            </div>
          </Card>

          <Card title="Porcentajes">
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs">Agregar porcentaje existente</Label>
              <div className="space-y-2">
                {data.percentages.length === 0 && <p className="text-sm text-muted-foreground">No hay porcentajes guardados.</p>}
                {data.percentages.map((p) => {
                  const on = aplicados.some((a) => a.id === p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <span>
                        {p.nombre} ({Number(p.porcion)}) · {p.aplica_a.map((k) => APLICA_OPCIONES.find((o) => o.key === k)?.label ?? k).join(", ")}
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant={on ? "secondary" : "outline"} disabled={on}
                          onClick={() => setAplicados((a) => [...a, { id: p.id, nombre: p.nombre, porcion: Number(p.porcion), aplica_a: p.aplica_a }])}>
                          {on ? "Agregado" : "Agregar"}
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Borrar porcentaje guardado" onClick={() => setDelPct(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3 rounded-md border border-border p-4">
              <p className="text-sm font-medium">Nuevo porcentaje</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs">Nombre (ej. IVA)</Label><Input maxLength={100} value={nuevoPct.nombre} onChange={(e) => setNuevoPct({ ...nuevoPct, nombre: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Porción decimal (ej. 0.13)</Label><Input inputMode="decimal" value={nuevoPct.porcion} onChange={(e) => setNuevoPct({ ...nuevoPct, porcion: e.target.value })} /></div>
              </div>
              <div>
                <Label className="text-xs">Se aplica a</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {APLICA_OPCIONES.map((o) => (
                    <label key={o.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={nuevoPct.aplica_a.includes(o.key)}
                        onCheckedChange={(c) =>
                          setNuevoPct({ ...nuevoPct, aplica_a: c ? [...nuevoPct.aplica_a, o.key] : nuevoPct.aplica_a.filter((k) => k !== o.key) })
                        }
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-sm">
                  ¿Guardar porcentaje para futuros cálculos?
                  <RadioGroup value={nuevoPct.guardar} onValueChange={(g) => setNuevoPct({ ...nuevoPct, guardar: g })} className="flex gap-4">
                    <label className="flex items-center gap-2"><RadioGroupItem value="si" /> Sí</label>
                    <label className="flex items-center gap-2"><RadioGroupItem value="no" /> No</label>
                  </RadioGroup>
                </div>
                <Button size="sm" onClick={agregarPorcentaje}>Agregar porcentaje</Button>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card title="Desglose">
            <div className="space-y-2 text-sm">
              {r.lineas.map((l) => (
                <div key={l.key} className="flex justify-between gap-3">
                  <div><p className="text-foreground">{l.label}</p><p className="text-xs text-muted-foreground">{l.detalle}</p></div>
                  <span className="whitespace-nowrap font-medium text-foreground">{fmt(l.monto)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Subtotal</span><span>{fmt(r.subtotal)}</span></div>
              {r.porcentajes.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1">
                    <button type="button" aria-label={`Quitar ${p.nombre}`} onClick={() => setAplicados((a) => a.filter((x) => x.id !== p.id))}><X className="h-3 w-3 text-muted-foreground" /></button>
                    {p.nombre} ({(p.porcion * 100).toFixed(2).replace(/\.?0+$/, "")}% de {fmt(p.base)})
                  </span>
                  <span className="whitespace-nowrap">{fmt(p.monto)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground"><span>Total</span><span>{fmt(r.total)}</span></div>
              <p className="text-xs text-muted-foreground">{r.personas} persona(s)</p>
            </div>
          </Card>

          <Card title="Convertir">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <SearchSelect
                  value={client ? clientLabel(client) : ""}
                  options={data.clients.map(clientLabel)}
                  placeholder="Buscar cliente"
                  onChange={(lbl) => setClientId(data.clients.find((c) => clientLabel(c) === lbl)?.id ?? "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de vencimiento</Label>
                <Input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
              </div>
              {!valid && <p className="text-xs text-destructive">Corrige la cantidad de personas para poder convertir.</p>}
              <Button className="w-full" disabled={!valid || !client || busy} onClick={() => convertir("quote")}>Convertir en cotización</Button>
              <Button className="w-full" variant="outline" disabled={!valid || !client || client.estado !== "oficial" || busy} onClick={() => convertir("invoice")}>
                Convertir en factura
              </Button>
              {client && client.estado !== "oficial" && <p className="text-xs text-muted-foreground">Solo los clientes oficiales pueden recibir facturas.</p>}
            </div>
          </Card>
        </aside>
      </div>

      <AlertDialog open={!!delPct} onOpenChange={(o) => !o && setDelPct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este porcentaje guardado?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no aparecerá para futuros cálculos. Las cotizaciones y facturas ya emitidas conservan el porcentaje con el que se crearon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrarPorcentaje} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
