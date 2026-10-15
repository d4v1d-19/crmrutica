import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { userId: null as string | null, isAdmin: false, permisos: [] as string[] };
      const [r, p] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("user_permissions").select("permiso").eq("user_id", u.user.id),
      ]);
      return {
        userId: u.user.id as string | null,
        isAdmin: (r.data ?? []).some((x) => x.role === "admin"),
        permisos: (p.data ?? []).map((x) => x.permiso),
      };
    },
    staleTime: 60_000,
  });
}
