CREATE SEQUENCE IF NOT EXISTS public.clients_codigo_seq;
GRANT USAGE, SELECT ON SEQUENCE public.clients_codigo_seq TO authenticated, service_role;

ALTER TABLE public.clients
  ADD COLUMN codigo text NOT NULL DEFAULT ('CL-' || lpad(nextval('public.clients_codigo_seq')::text, 4, '0')),
  ADD COLUMN estado text NOT NULL DEFAULT 'potencial' CHECK (estado IN ('potencial','oficial')),
  ADD COLUMN pais text,
  ADD COLUMN dni text CHECK (dni IS NULL OR dni ~ '^[0-9-]+$'),
  ADD COLUMN notas text,
  ADD COLUMN medida_interes text CHECK (medida_interes IS NULL OR medida_interes IN ('frio','tibio','caliente')),
  ADD COLUMN canal text NOT NULL DEFAULT 'Otro' CHECK (canal IN ('WhatsApp','Correo electrónico','Redes sociales','Llamada telefónica','Formulario','Otro')),
  ADD COLUMN agente_id uuid,
  ADD COLUMN tipo_facturacion text NOT NULL DEFAULT 'no_necesita' CHECK (tipo_facturacion IN ('no_necesita','sencilla','electronica'));
ALTER TABLE public.clients ADD CONSTRAINT clients_codigo_key UNIQUE (codigo);
UPDATE public.clients SET agente_id = user_id WHERE agente_id IS NULL;

CREATE OR REPLACE FUNCTION public.clients_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.canal = 'Formulario' AND current_user NOT IN ('service_role','postgres','supabase_admin') THEN
      RAISE EXCEPTION 'El canal "Formulario" solo lo asigna el sistema';
    END IF;
    IF NEW.agente_id IS NULL THEN NEW.agente_id := COALESCE(auth.uid(), NEW.user_id); END IF;
  ELSE
    IF OLD.canal = 'Formulario' AND NEW.canal IS DISTINCT FROM OLD.canal THEN
      RAISE EXCEPTION 'El canal de un cliente que entró por formulario no se puede modificar';
    END IF;
    IF NEW.canal = 'Formulario' AND OLD.canal <> 'Formulario' THEN
      RAISE EXCEPTION 'El canal "Formulario" solo lo asigna el sistema';
    END IF;
    NEW.codigo := OLD.codigo;
    NEW.user_id := OLD.user_id;
  END IF;
  IF NEW.agente_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.agente_id IS DISTINCT FROM OLD.agente_id)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.agente_id AND activo) THEN
    RAISE EXCEPTION 'El agente asignado debe ser un usuario activo';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER clients_guard_trg BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_guard();

CREATE OR REPLACE FUNCTION public.list_active_agents()
RETURNS TABLE (id uuid, nombre text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nombre, p.email FROM public.profiles p
  WHERE p.activo AND public.is_active_user(auth.uid())
  ORDER BY p.nombre
$$;
REVOKE EXECUTE ON FUNCTION public.list_active_agents() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_active_agents() TO authenticated;

CREATE TABLE public.client_billing (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('sencilla','electronica')),
  cedula text,
  nombre_comercial text,
  razon_social text,
  actividad_economica text,
  direccion_fiscal text,
  provincia text,
  canton text,
  distrito text,
  nombre_completo text,
  empresa text,
  telefono text,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_billing_campos CHECK (
    (tipo = 'electronica' AND cedula IS NOT NULL AND nombre_comercial IS NOT NULL AND razon_social IS NOT NULL
      AND actividad_economica IS NOT NULL AND direccion_fiscal IS NOT NULL AND telefono IS NOT NULL
      AND email IS NOT NULL AND provincia IS NOT NULL AND canton IS NOT NULL AND distrito IS NOT NULL)
    OR (tipo = 'sencilla' AND nombre_completo IS NOT NULL AND (telefono IS NOT NULL OR email IS NOT NULL))
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_billing TO authenticated;
GRANT ALL ON public.client_billing TO service_role;
ALTER TABLE public.client_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activos leen facturación" ON public.client_billing FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY "Activos crean facturación" ON public.client_billing FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Activos editan facturación" ON public.client_billing FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Activos eliminan facturación" ON public.client_billing FOR DELETE TO authenticated
  USING (public.is_active_user(auth.uid()));