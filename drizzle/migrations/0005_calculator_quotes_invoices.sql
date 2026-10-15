CREATE TABLE public.price_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','CRC','EUR')),
  entrada_nacional numeric(12,2) NOT NULL DEFAULT 3.00 CHECK (entrada_nacional >= 0),
  entrada_extranjero numeric(12,2) NOT NULL DEFAULT 15.00 CHECK (entrada_extranjero >= 0),
  hospedaje numeric(12,2) NOT NULL DEFAULT 30.00 CHECK (hospedaje >= 0),
  desayuno numeric(12,2) NOT NULL DEFAULT 20.00 CHECK (desayuno >= 0),
  merienda numeric(12,2) NOT NULL DEFAULT 12.00 CHECK (merienda >= 0),
  cena numeric(12,2) NOT NULL DEFAULT 25.00 CHECK (cena >= 0),
  updated_by uuid,
  updated_by_nombre text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.price_settings TO authenticated;
GRANT ALL ON public.price_settings TO service_role;
ALTER TABLE public.price_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee tarifas" ON public.price_settings FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita tarifas" ON public.price_settings FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.price_settings_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_by_nombre := (SELECT COALESCE(nombre, email) FROM public.profiles WHERE id = auth.uid());
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER price_settings_stamp_trg BEFORE UPDATE ON public.price_settings FOR EACH ROW EXECUTE FUNCTION public.price_settings_stamp();
INSERT INTO public.price_settings (id) VALUES (1);

CREATE TABLE public.percentages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  porcion numeric(8,4) NOT NULL CHECK (porcion >= 0 AND porcion <= 10),
  aplica_a text[] NOT NULL DEFAULT ARRAY['subtotal'],
  aplicar_por_defecto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.percentages TO authenticated;
GRANT ALL ON public.percentages TO service_role;
ALTER TABLE public.percentages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee porcentajes" ON public.percentages FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea porcentajes" ON public.percentages FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita porcentajes" ON public.percentages FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM elimina porcentajes" ON public.percentages FOR DELETE TO authenticated USING (public.is_active_user(auth.uid()));
INSERT INTO public.percentages (nombre, porcion, aplica_a, aplicar_por_defecto) VALUES ('IVA', 0.13, ARRAY['entradas_nacionales','entradas_extranjeros'], true);

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agente_id uuid DEFAULT auth.uid(),
  estado text NOT NULL DEFAULT 'no_enviada',
  fecha_envio date,
  fecha_vencimiento date,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','CRC','EUR')),
  snapshot jsonb NOT NULL,
  total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee cotizaciones" ON public.quotes FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea cotizaciones" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita cotizaciones" ON public.quotes FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Admin elimina cotizaciones" ON public.quotes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE SEQUENCE public.invoices_numero_seq;
GRANT USAGE, SELECT ON SEQUENCE public.invoices_numero_seq TO authenticated, service_role;
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT ('FAC-' || lpad(nextval('public.invoices_numero_seq')::text, 4, '0')),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agente_id uuid DEFAULT auth.uid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','CRC','EUR')),
  snapshot jsonb NOT NULL,
  total numeric(14,2) NOT NULL DEFAULT 0,
  fecha_vencimiento date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee facturas" ON public.invoices FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea facturas" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita facturas" ON public.invoices FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Admin elimina facturas" ON public.invoices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.invoices_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.client_id AND estado = 'oficial') THEN
    RAISE EXCEPTION 'Solo se pueden emitir facturas a clientes oficiales';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.numero := OLD.numero; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_guard_trg BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.invoices_guard();