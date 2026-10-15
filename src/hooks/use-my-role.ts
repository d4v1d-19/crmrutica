import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { userId: null as string | null, isAdmin: false };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { userId: u.user.id as string | null, isAdmin: (data ?? []).some((r) => r.role === "admin") };
    },
    staleTime: 60_000,
  });
}
