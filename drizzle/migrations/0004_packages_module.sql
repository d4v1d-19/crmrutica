CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  dias int NOT NULL DEFAULT 1 CHECK (dias >= 0),
  noches int NOT NULL DEFAULT 0 CHECK (noches >= 0),
  incluye_hospedaje boolean NOT NULL DEFAULT false,
  incluye_desayuno boolean NOT NULL DEFAULT false,
  incluye_cena boolean NOT NULL DEFAULT false,
  desayunos_por_persona int NOT NULL DEFAULT 0 CHECK (desayunos_por_persona >= 0),
  meriendas_por_persona int NOT NULL DEFAULT 0 CHECK (meriendas_por_persona >= 0),
  cenas_por_persona int NOT NULL DEFAULT 0 CHECK (cenas_por_persona >= 0),
  transporte_4x4 boolean NOT NULL DEFAULT false,
  precio_4x4 numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_4x4 >= 0),
  unidad_4x4 text NOT NULL DEFAULT 'c/u' CHECK (unidad_4x4 IN ('c/u','total')),
  transporte_barco boolean NOT NULL DEFAULT false,
  precio_barco numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_barco >= 0),
  unidad_barco text NOT NULL DEFAULT 'c/u' CHECK (unidad_barco IN ('c/u','total')),
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','CRC','EUR')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee paquetes" ON public.packages FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea paquetes" ON public.packages FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita paquetes" ON public.packages FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Admin elimina paquetes" ON public.packages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.package_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  monto numeric(12,2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
  unidad text NOT NULL DEFAULT 'c/u' CHECK (unidad IN ('c/u','total')),
  orden int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_variables TO authenticated;
GRANT ALL ON public.package_variables TO service_role;
ALTER TABLE public.package_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee variables" ON public.package_variables FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea variables" ON public.package_variables FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita variables" ON public.package_variables FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM elimina variables" ON public.package_variables FOR DELETE TO authenticated USING (public.is_active_user(auth.uid()));

INSERT INTO public.packages (id, titulo, dias, noches, incluye_hospedaje, incluye_desayuno, incluye_cena, desayunos_por_persona, meriendas_por_persona, cenas_por_persona, transporte_4x4, precio_4x4, unidad_4x4, transporte_barco, precio_barco, unidad_barco, moneda) VALUES
 ('00000000-0000-4000-8000-0000000000a1', 'Puerto Jiménez - Sirena - Puerto Jiménez - Day tour', 1, 0, false, false, false, 0, 1, 0, false, 0, 'c/u', true, 60.00, 'c/u', 'USD'),
 ('00000000-0000-4000-8000-0000000000a2', 'Los Patos - Sirena - Carate - 2 días 1 noche', 2, 1, true, true, true, 1, 2, 1, true, 70.00, 'c/u', false, 0, 'c/u', 'USD');
INSERT INTO public.package_variables (package_id, nombre, descripcion, monto, unidad, orden) VALUES
 ('00000000-0000-4000-8000-0000000000a2', 'Refrigerio en el carro', 'Agua fría, frutas', 15.00, 'c/u', 1);