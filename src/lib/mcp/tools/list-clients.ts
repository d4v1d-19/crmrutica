import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "Listar clientes",
  description: "Lista clientes de Rutica CRM (máx. 100), con filtros opcionales por estado, medida de interés y canal.",
  inputSchema: {
    estado: z.enum(["potencial", "oficial"]).optional(),
    medida_interes: z.enum(["frio", "tibio", "caliente"]).optional(),
    canal: z
      .enum(["WhatsApp", "Correo electrónico", "Redes sociales", "Llamada telefónica", "Formulario", "Otro"])
      .optional(),
  },
  annotations: { readOnlyHint: true },
  handler: async ({ estado, medida_interes, canal }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("clients")
      .select("id, codigo, name, email, phone, company, estado, medida_interes, canal, pais, agente_id, tipo_facturacion, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (estado) q = q.eq("estado", estado);
    if (medida_interes) q = q.eq("medida_interes", medida_interes);
    if (canal) q = q.eq("canal", canal);
    const { data, error } = await q;
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { clients: data } };
  },
});
