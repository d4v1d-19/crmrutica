import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_client",
  title: "Create client",
  description: "Create a new CRM client for the signed-in user.",
  inputSchema: {
    name: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    company: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false },
  handler: async ({ name, email, phone, company }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("clients")
      .insert({ user_id: ctx.getUserId(), name, email, phone, company })
      .select();
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { client: data?.[0] } };
  },
});
