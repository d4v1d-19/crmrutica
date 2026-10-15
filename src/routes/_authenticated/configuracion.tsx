import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/CrmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-my-role";
import { PERMISOS } from "@/lib/permisos";

export const Route = createFileRoute("/_authenticated/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuraciones — Rutica CRM" },
      { name: "description", content: "Información de la empresa, usuarios y permisos de Rutica CRM." },
      { property: "og:title", content: "Configuraciones — Rutica CRM" },
      { property: "og:description", content: "Información de la empresa, usuarios y permisos de Rutica CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
  const { data: me, isLoading } = useMyRole();
  if (isLoading) return <EmptyState message="Cargando..." />;
  if (!me?.isAdmin)
    return (
      <>
        <PageHeader title="Configuraciones" />
        <EmptyState message="Esta sección solo está disponible para administradores." />
      </>
    );
  return (
    <>
      <PageHeader title="Configuraciones" description="Información de la empresa, usuarios y permisos." />
      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Información de la empresa</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios y permisos</TabsTrigger>
        </TabsList>
        <TabsContent value="empresa" className="mt-6"><EmpresaTab /></TabsContent>
        <TabsContent value="usuarios" className="mt-6"><UsuariosTab myId={me.userId} /></TabsContent>
      </Tabs>
    </>
  );
}

/* ---------------- Empresa ---------------- */

const req = (m: string) => z.string().trim().min(1, m);
const empresaSchema = z.object({
  nombre: req("El nombre es obligatorio"),
  direccion: req("La dirección es obligatoria"),
  correo: req("El correo es obligatorio").email("Correo inválido"),
  telefono: req("El teléfono es obligatorio"),
  cedula_juridica: z.string().trim().optional(),
  actividad_economica: z.string().trim().optional(),
});
type EmpresaForm = z.infer<typeof empresaSchema>;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

function EmpresaTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      let logoPreview: string | null = null;
      if (data?.logo_url) {
        if (/^https?:/.test(data.logo_url)) logoPreview = data.logo_url;
        else logoPreview = (await supabase.storage.from("company-assets").createSignedUrl(data.logo_url, 3600)).data?.signedUrl ?? null;
      }
      return { row: data, logoPreview };
    },
  });
  const form = useForm<EmpresaForm>({ resolver: zodResolver(empresaSchema) });
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    const r = data?.row;
    if (r) form.reset({ nombre: r.nombre ?? "", direccion: r.direccion ?? "", correo: r.correo ?? "", telefono: r.telefono ?? "", cedula_juridica: r.cedula_juridica ?? "", actividad_economica: r.actividad_economica ?? "" });
  }, [data, form]);

  async function onSubmit(v: EmpresaForm) {
    const { error } = await supabase
      .from("company_settings")
      .update({ ...v, cedula_juridica: v.cedula_juridica || null, actividad_economica: v.actividad_economica || null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Información de la empresa guardada");
    qc.invalidateQueries({ queryKey: ["company"] });
  }

  async function subirLogo(file: File) {
    if (!LOGO_TYPES.includes(file.type)) { toast.error("El logo debe ser PNG, JPG o SVG"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `logo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("company-assets").upload(path, file, { contentType: file.type });
    if (up.error) { setUploading(false); toast.error(up.error.message); return; }
    const old = data?.row?.logo_url;
    const { error } = await supabase.from("company_settings").update({ logo_url: path }).eq("id", 1);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    if (old && !/^https?:/.test(old)) void supabase.storage.from("company-assets").remove([old]);
    toast.success("Logo actualizado");
    qc.invalidateQueries({ queryKey: ["company"] });
  }

  async function quitarLogo() {
    const old = data?.row?.logo_url;
    const { error } = await supabase.from("company_settings").update({ logo_url: null }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    if (old && !/^https?:/.test(old)) void supabase.storage.from("company-assets").remove([old]);
    qc.invalidateQueries({ queryKey: ["company"] });
  }

  const err = form.formState.errors;
  const campo = (name: keyof EmpresaForm, label: string, opcional = false, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}{!opcional && " *"}</Label>
      <Input id={name} type={type} {...form.register(name)} />
      {opcional && <p className="text-xs text-muted-foreground">Aparece en las facturas solo si se agrega</p>}
      {err[name] && <p className="text-xs text-destructive">{err[name]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-5">
      <p className="text-sm text-muted-foreground">Estos datos aparecen en los PDF de cotizaciones y facturas.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("nombre", "Nombre")}
        {campo("telefono", "Teléfono")}
        {campo("correo", "Correo", false, "email")}
        {campo("direccion", "Dirección")}
        {campo("cedula_juridica", "Cédula jurídica", true)}
        {campo("actividad_economica", "Actividad económica", true)}
      </div>
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          {data?.logoPreview ? (
            <img src={data.logoPreview} alt="Logo de la empresa" className="h-16 max-w-40 rounded border border-border bg-card object-contain p-1" />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">Sin logo</div>
          )}
          <Input type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" disabled={uploading} className="max-w-xs"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirLogo(f); e.target.value = ""; }} />
          {data?.row?.logo_url && <Button type="button" variant="ghost" onClick={quitarLogo}>Quitar</Button>}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Aparece en las facturas solo si se agrega</p>
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>Guardar cambios</Button>
    </form>
  );
}

/* ---------------- Usuarios ---------------- */

async function loadUsuarios() {
  const [p, r, perm] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("user_permissions").select("user_id, permiso"),
  ]);
  if (p.error) throw p.error;
  return (p.data ?? []).map((u) => ({
    ...u,
    role: (r.data ?? []).some((x) => x.user_id === u.id && x.role === "admin") ? "admin" : "agente",
    permisos: (perm.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.permiso),
  }));
}
type U = Awaited<ReturnType<typeof loadUsuarios>>[number];

function UsuariosTab({ myId }: { myId: string | null }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["usuarios"], queryFn: loadUsuarios });
  const [permsId, setPermsId] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); qc.invalidateQueries({ queryKey: ["my-role"] }); };
  const link = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";

  async function cambiarRol(u: U, role: "admin" | "agente") {
    if (u.id === myId && role !== "admin") { toast.error("No puedes quitarte tu propio rol de administrador"); return; }
    const del = await supabase.from("user_roles").delete().eq("user_id", u.id);
    if (del.error) { toast.error(del.error.message); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role });
    if (error) { toast.error(error.message); return; }
    toast.success("Rol actualizado");
    refresh();
  }

  async function actualizar(u: U, patch: { comision_porcentaje?: number; activo?: boolean }) {
    if (u.id === myId && patch.activo === false) { toast.error("No puedes desactivar tu propio usuario"); return; }
    const { error } = await supabase.from("profiles").update(patch).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Usuario actualizado");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Agregar usuarios</p>
        <p className="mt-1 text-sm text-muted-foreground">Comparte este enlace para que el nuevo usuario se registre. Entrará como agente; luego puedes cambiar su rol aquí.</p>
        <div className="mt-3 flex max-w-xl gap-2">
          <Input readOnly value={link} />
          <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Enlace copiado"); }}>
            <Copy className="mr-2 h-4 w-4" />Copiar
          </Button>
        </div>
      </div>

      {isLoading ? <EmptyState message="Cargando usuarios..." /> : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-36">Rol</TableHead>
                <TableHead className="w-32">% comisión</TableHead>
                <TableHead className="w-20">Activo</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nombre ?? "—"}{u.id === myId && <span className="ml-1 text-xs text-muted-foreground">(tú)</span>}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => cambiarRol(u, v as "admin" | "agente")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agente">Agente</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" max="100" step="0.01" defaultValue={Number(u.comision_porcentaje)} key={`${u.id}-${u.comision_porcentaje}`}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!(n >= 0 && n <= 100)) { toast.error("La comisión debe estar entre 0 y 100"); e.target.value = String(u.comision_porcentaje); return; }
                        if (n !== Number(u.comision_porcentaje)) void actualizar(u, { comision_porcentaje: n });
                      }} />
                  </TableCell>
                  <TableCell><Switch checked={u.activo} onCheckedChange={(v) => actualizar(u, { activo: v })} aria-label="Activo" /></TableCell>
                  <TableCell><Button variant="outline" size="sm" onClick={() => setPermsId(u.id)}>Permisos</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PermisosDialog user={data?.find((u) => u.id === permsId) ?? null} onClose={() => setPermsId(null)} onSaved={refresh} />
    </div>
  );
}

function PermisosDialog({ user, onClose, onSaved }: { user: U | null; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (user) setSel(user.permisos); }, [user]);
  const isAdmin = user?.role === "admin";

  async function guardar() {
    if (!user) return;
    setSaving(true);
    const quitar = user.permisos.filter((p) => !sel.includes(p));
    const agregar = sel.filter((p) => !user.permisos.includes(p));
    if (quitar.length) {
      const { error } = await supabase.from("user_permissions").delete().eq("user_id", user.id).in("permiso", quitar);
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    if (agregar.length) {
      const { error } = await supabase.from("user_permissions").insert(agregar.map((permiso) => ({ user_id: user.id, permiso })));
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    setSaving(false);
    toast.success("Permisos guardados");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permisos de {user?.nombre ?? user?.email}</DialogTitle>
          <DialogDescription>{isAdmin ? "Los administradores tienen todos los permisos." : "Selecciona los bloques que este usuario puede ver."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {PERMISOS.map((g) => (
            <div key={g.grupo} className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{g.grupo}</p>
              {g.items.map((i) => (
                <label key={i.key} className="flex items-center gap-2 text-sm">
                  <Checkbox disabled={isAdmin} checked={isAdmin || sel.includes(i.key)}
                    onCheckedChange={(v) => setSel((s) => (v ? [...s, i.key] : s.filter((x) => x !== i.key)))} />
                  {i.label}
                </label>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {!isAdmin && <Button onClick={guardar} disabled={saving}>Guardar permisos</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
