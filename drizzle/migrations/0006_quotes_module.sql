ALTER TABLE public.quotes ADD CONSTRAINT quotes_estado_check CHECK (estado IN ('no_enviada','enviada','enviada_retrasada','aprobada'));

CREATE OR REPLACE FUNCTION public.quotes_estado_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'enviada_retrasada' THEN NEW.estado := 'enviada'; END IF;
  IF NEW.estado = 'enviada' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'enviada') THEN
    NEW.fecha_envio := (now() AT TIME ZONE 'America/Costa_Rica')::date;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quotes_estado_stamp_trg BEFORE INSERT OR UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.quotes_estado_stamp();

CREATE VIEW public.quotes_view WITH (security_invoker = true) AS
SELECT q.*,
  row_number() OVER (ORDER BY q.created_at, q.id)::int AS numero,
  CASE WHEN q.estado = 'enviada' AND q.fecha_envio IS NOT NULL
        AND q.fecha_envio <= (now() AT TIME ZONE 'America/Costa_Rica')::date - 7
       THEN 'enviada_retrasada' ELSE q.estado END AS estado_efectivo
FROM public.quotes q;
GRANT SELECT ON public.quotes_view TO authenticated;
GRANT SELECT ON public.quotes_view TO service_role;

CREATE TABLE public.company_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre text NOT NULL DEFAULT 'Rutica',
  cedula_juridica text,
  actividad_economica text,
  direccion text,
  logo_url text,
  correo text,
  telefono text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee empresa" ON public.company_settings FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "Admin edita empresa" ON public.company_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.company_settings (id, nombre, direccion) VALUES (1, 'Rutica', 'Puerto Jiménez, Puntarenas, Costa Rica');