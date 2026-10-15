import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  cleanData,
  renderTemplate,
  validateSubmission,
  type FieldDef,
  type FormData,
  type Validacion,
} from "./forms";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const slugSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: form } = await sb
      .from("forms")
      .select("id, titulo, slug, descripcion, activo, validaciones")
      .eq("slug", data.slug)
      .eq("activo", true)
      .maybeSingle();
    if (!form) return null;
    const { data: fields } = await sb
      .from("form_fields")
      .select("id, form_id, orden, etiqueta, variable, tipo, obligatorio, opciones, regla_condicional")
      .eq("form_id", form.id)
      .order("orden");
    return {
      id: form.id,
      titulo: form.titulo,
      slug: form.slug,
      descripcion: form.descripcion,
      validaciones: (form.validaciones ?? []) as unknown as Validacion[],
      fields: (fields ?? []) as unknown as FieldDef[],
    };
  });

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null);

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return { estado: "sin_configurar" as const };
  const from = process.env["RESEND_FROM"] || "Rutica CRM <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend failed [${res.status}]: ${body}`);
    return { estado: "error" as const, error: `[${res.status}] ${body.slice(0, 300)}` };
  }
  return { estado: "enviado" as const };
}

export const submitForm = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; data: Record<string, unknown> }) =>
    z.object({ slug: slugSchema, data: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data: input }) => {
    if (JSON.stringify(input.data).length > 50_000) return { ok: false as const, error: "Respuesta demasiado grande" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: form } = await supabaseAdmin
      .from("forms")
      .select("*")
      .eq("slug", input.slug)
      .eq("activo", true)
      .maybeSingle();
    if (!form) return { ok: false as const, error: "Este formulario no está disponible" };
    const { data: rawFields } = await supabaseAdmin.from("form_fields").select("*").eq("form_id", form.id).order("orden");
    const fields = (rawFields ?? []) as unknown as FieldDef[];
    const errors = validateSubmission(fields, input.data as FormData);
    if (Object.keys(errors).length) return { ok: false as const, error: "Revisa los campos marcados", errors };
    const data = cleanData(fields, input.data as FormData);

    // Mapped client values
    const mapped: Record<string, unknown> = {};
    for (const f of fields) if (f.mapea_a_campo_cliente && f.variable in data) mapped[f.mapea_a_campo_cliente] = data[f.variable];
    const email = str(mapped["email"]);

    let clientId: string | null = null;
    if (form.crea_cliente) {
      let owner = form.created_by;
      if (!owner) {
        const { data: admin } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
        owner = admin?.user_id ?? null;
      }
      if (owner) {
        const tipo = ["sencilla", "electronica"].includes(String(mapped["tipo_facturacion"]))
          ? String(mapped["tipo_facturacion"])
          : "no_necesita";
        const medida = ["frio", "tibio", "caliente"].includes(String(mapped["medida_interes"])) ? String(mapped["medida_interes"]) : null;
        const dni = str(mapped["dni"]);
        const { data: client, error } = await supabaseAdmin
          .from("clients")
          .insert({
            user_id: owner,
            name: str(mapped["name"]) ?? email ?? "Sin nombre",
            email,
            phone: str(mapped["phone"]),
            company: str(mapped["company"]),
            pais: str(mapped["pais"]),
            dni: dni && /^[0-9-]+$/.test(dni) ? dni : null,
            notas: str(mapped["notas"]),
            medida_interes: medida,
            canal: "Formulario",
            estado: "potencial",
            tipo_facturacion: tipo,
          })
          .select("id, name, phone, email")
          .single();
        if (error) console.error("create client from form failed", error.message);
        if (client) {
          clientId = client.id;
          const b = mapped["billing"] as Record<string, unknown> | undefined;
          if (tipo === "electronica" && b) {
            await supabaseAdmin.from("client_billing").insert({
              client_id: client.id,
              tipo: "electronica",
              cedula: str(b["cedula"]),
              nombre_comercial: str(b["nombre_comercial"]),
              razon_social: str(b["razon_social"]),
              actividad_economica: str(b["actividad_economica"]),
              direccion_fiscal: str(b["direccion_fiscal"]),
              telefono: str(b["telefono"]),
              email: str(b["email"]),
              provincia: str(b["provincia"]),
              canton: str(b["canton"]),
              distrito: str(b["distrito"]),
            });
          } else if (tipo === "sencilla" && (client.phone || client.email)) {
            await supabaseAdmin.from("client_billing").insert({
              client_id: client.id,
              tipo: "sencilla",
              nombre_completo: client.name,
              telefono: client.phone,
              email: client.email,
            });
          }
        }
      }
    } else if (email) {
      const { data: existing } = await supabaseAdmin
        .from("clients")
        .select("id")
        .ilike("email", email.replace(/[%_]/g, ""))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      clientId = existing?.id ?? null;
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("form_submissions")
      .insert({ form_id: form.id, data: data as never, client_id: clientId })
      .select("id")
      .single();
    if (subErr || !sub) {
      console.error("submission insert failed", subErr?.message);
      return { ok: false as const, error: "No se pudo guardar la respuesta. Intenta de nuevo." };
    }

    let estado: "enviado" | "sin_configurar" | "sin_destinatario" | "error" = "sin_destinatario";
    let emailError: string | null = null;
    if (form.email_notificacion) {
      const tpl = form.plantilla_correo?.trim() || fields.map((f) => `${f.etiqueta}: {{${f.variable}}}`).join("\n");
      const text = renderTemplate(tpl, fields, data, { formulario: form.titulo });
      try {
        const r = await sendEmail(form.email_notificacion, `Nueva respuesta: ${form.titulo}`, text);
        estado = r.estado;
        emailError = "error" in r ? (r.error ?? null) : null;
      } catch (e) {
        estado = "error";
        emailError = e instanceof Error ? e.message : "Error desconocido";
      }
    }
    await supabaseAdmin.from("form_submissions").update({ email_estado: estado, email_error: emailError }).eq("id", sub.id);
    return { ok: true as const };
  });
