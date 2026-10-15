import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const CANALES = ["WhatsApp", "Correo electrónico", "Redes sociales", "Llamada telefónica", "Otro"] as const;

export default defineTool({
  name: "create_client",
  title: "Crear cliente",
  description:
    "Crea un cliente en Rutica CRM. El canal es obligatorio (por defecto 'Otro'); 'Formulario' no está permitido. El agente asignado es el usuario que llama.",
  inputSchema: {
    name: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    company: z.string().trim().optional(),
    canal: z.enum(CANALES).default("Otro"),
    estado: z.enum(["potencial", "oficial"]).optional(),
    medida_interes: z.enum(["frio", "tibio", "caliente"]).optional(),
    pais: z.string().trim().optional(),
    dni: z.string().trim().regex(/^[0-9-]+$/, "Solo números y guiones").optional(),
    notas: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...input, canal: input.canal ?? "Otro", user_id: userId, agente_id: userId })
      .select();
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { client: data?.[0] } };
  },
});
