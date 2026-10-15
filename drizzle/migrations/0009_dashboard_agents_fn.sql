CREATE OR REPLACE FUNCTION public.dashboard_agents()
RETURNS TABLE(id uuid, nombre text, email text, comision_porcentaje numeric, activo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.nombre, p.email, p.comision_porcentaje, p.activo FROM public.profiles p
  WHERE public.is_active_user(auth.uid())
    AND (public.has_role(auth.uid(), 'admin')
         OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND up.permiso = 'dashboard.general.agentes')
         OR p.id = auth.uid())
  ORDER BY p.nombre
$$;
REVOKE EXECUTE ON FUNCTION public.dashboard_agents() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.dashboard_agents() TO authenticated;