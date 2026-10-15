import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ClientFormDialog, type Agent } from "@/components/clientes/ClientFormDialog";
import { CANALES, DELETE_CLIENT_TEXT, MEDIDAS, formatFecha } from "@/lib/clientes";

type Client = Tables<"clients">;
type Billing = Tables<"client_billing">;
const ALL = "__all";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Rutica CRM" },
      { name: "description", content: "Administra los clientes potenciales y oficiales de Rutica." },
      { property: "og:title", content: "Clientes — Rutica CRM" },
      { property: "og:description", content: "Administra los clientes potenciales y oficiales de Rutica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientesPage,
});

async function loadData() {
  const { data: u } = await supabase.auth.getUser();
  const me = u.user!.id;
  const [clients, billing, agents, roles] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("client_billing").select("*"),
    supabase.rpc("list_active_agents"),
    supabase.from("user_roles").select("role").eq("user_id", me),
  ]);
  if (clients.error) throw clients.error;
  return {
    me,
    clients: clients.data,
    billing: billing.data ?? [],
    agents: (agents.data ?? []) as Agent[],
    isAdmin: (roles.data ?? []).some((r) => r.role === "admin"),
  };
}

function ClientesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["clientes"], queryFn: loadData });
  const [f, setF] = useState({ numero: "", nombre: "", medida: ALL, canal: ALL, empresa: "", agente: ALL });
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Client | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["clientes"] });
  const agentName = (id: string | null) => {
    const a = data?.agents.find((x) => x.id === id);
    return a ? a.nombre || a.email : "—";
  };

  const filtered = useMemo(() => {
    const n = f.numero.trim().toLowerCase();
    return (data?.clients ?? []).filter(
      (c) =>
        (!n || c.codigo.toLowerCase().includes(n) || (c.phone ?? "").replace(/\D/g, "").includes(n.replace(/\D/g, "") || "\u0000")) &&
        (!f.nombre || c.name.toLowerCase().includes(f.nombre.toLowerCase())) &&
        (f.medida === ALL || (f.medida === "none" ? !c.medida_interes : c.medida_interes === f.medida)) &&
        (f.canal === ALL || c.canal === f.canal) &&
        (!f.empresa || (c.company ?? "").toLowerCase().includes(f.empresa.toLowerCase())) &&
        (f.agente === ALL || c.agente_id === f.agente),
    );
  }, [data, f]);

  const potenciales = filtered.filter((c) => c.estado === "potencial");
  const oficiales = filtered.filter((c) => c.estado === "oficial");

  async function convertir(c: Client) {
    const { error } = await supabase.from("clients").update({ estado: "oficial" }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(`${c.name} ahora es cliente oficial`);
    refresh();
  }
  async function eliminar() {
    if (!toDelete) return;
    const { error, count } = await supabase.from("clients").delete({ count: "exact" }).eq("id", toDelete.id);
    setToDelete(null);
    if (error || !count) return toast.error(error?.message ?? "Solo un administrador puede eliminar clientes");
    toast.success("Cliente eliminado");
    refresh();
  }

  const table = (rows: Client[]) =>
    rows.length === 0 ? (
      <p className="px-4 py-6 text-sm text-muted-foreground">Sin clientes.</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Agente</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.phone || "—"}</TableCell>
              <TableCell>{c.company || "—"}</TableCell>
              <TableCell>{c.canal}</TableCell>
              <TableCell>{agentName(c.agente_id)}</TableCell>
              <TableCell>{formatFecha(c.created_at)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Acciones">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => { setEditing(c); setFormOpen(true); }}>Editar</DropdownMenuItem>
                    {c.estado === "potencial" ? (
                      <DropdownMenuItem onSelect={() => convertir(c)}>Convertir en cliente oficial</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => navigate({ to: "/facturas" })}>Ver facturas</DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      disabled={!data?.isAdmin}
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setToDelete(c)}
                    >
                      Eliminar{!data?.isAdmin && " (solo admin)"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

  const secciones = [
    ...MEDIDAS.map((m) => ({ key: m.value, label: m.label, color: m.color, rows: potenciales.filter((c) => c.medida_interes === m.value) })),
    { key: "none", label: "Sin clasificar", color: undefined, rows: potenciales.filter((c) => !c.medida_interes) },
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Clientes" description="Administra los clientes potenciales y oficiales de Rutica." />
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Agregar cliente
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input placeholder="Código o teléfono" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        <Input placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <Select value={f.medida} onValueChange={(v) => setF({ ...f, medida: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda medida de interés</SelectItem>
            {MEDIDAS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            <SelectItem value="none">Sin clasificar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={f.canal} onValueChange={(v) => setF({ ...f, canal: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todo canal</SelectItem>
            {CANALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Empresa" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} />
        <Select value={f.agente} onValueChange={(v) => setF({ ...f, agente: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todo agente</SelectItem>
            {(data?.agents ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre || a.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <EmptyState message="Cargando clientes..." />
      ) : (
        <Tabs defaultValue="potencial">
          <TabsList>
            <TabsTrigger value="potencial">Clientes potenciales ({potenciales.length})</TabsTrigger>
            <TabsTrigger value="oficial">Clientes oficiales ({oficiales.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="potencial" className="space-y-6">
            {secciones.map((s) => (
              <section key={s.key} className="overflow-hidden rounded-lg border border-border">
                <h2
                  className="flex items-center justify-between bg-muted px-4 py-2 text-sm font-semibold text-foreground"
                  style={s.color ? { background: s.color, color: "#1f2937" } : undefined}
                >
                  {s.label} <span className="font-normal">{s.rows.length}</span>
                </h2>
                {table(s.rows)}
              </section>
            ))}
          </TabsContent>
          <TabsContent value="oficial">
            <div className="overflow-hidden rounded-lg border border-border">{table(oficiales)}</div>
          </TabsContent>
        </Tabs>
      )}

      {data && (
        <ClientFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          client={editing}
          billing={editing ? (data.billing.find((b: Billing) => b.client_id === editing.id) ?? null) : null}
          agents={data.agents}
          me={data.me}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>{DELETE_CLIENT_TEXT}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
