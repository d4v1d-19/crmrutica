CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  descripcion text,
  email_notificacion text,
  plantilla_correo text,
  crea_cliente boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  validaciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
GRANT SELECT (id, titulo, slug, descripcion, activo, validaciones) ON public.forms TO anon;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Público ve formularios activos" ON public.forms FOR SELECT TO anon USING (activo);
CREATE POLICY "CRM lee formularios" ON public.forms FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea formularios" ON public.forms FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita formularios" ON public.forms FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Admin elimina formularios" ON public.forms FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  orden int NOT NULL DEFAULT 0,
  etiqueta text NOT NULL,
  variable text NOT NULL CHECK (variable ~ '^[a-z0-9_]+$'),
  tipo text NOT NULL CHECK (tipo IN ('text','number','number_stepper','checkbox','dropdown','dropdown_paises','si_no','paragraph','email','telefono','factura_electronica')),
  obligatorio boolean NOT NULL DEFAULT false,
  opciones jsonb,
  regla_condicional jsonb,
  mapea_a_campo_cliente text,
  UNIQUE (form_id, variable)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;
GRANT SELECT (id, form_id, orden, etiqueta, variable, tipo, obligatorio, opciones, regla_condicional) ON public.form_fields TO anon;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Público ve campos de formularios activos" ON public.form_fields FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.activo));
CREATE POLICY "CRM lee campos" ON public.form_fields FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM crea campos" ON public.form_fields FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita campos" ON public.form_fields FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "CRM elimina campos" ON public.form_fields FOR DELETE TO authenticated USING (public.is_active_user(auth.uid()));

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  email_estado text NOT NULL DEFAULT 'pendiente' CHECK (email_estado IN ('pendiente','enviado','sin_configurar','sin_destinatario','error')),
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.form_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Público envía a formularios activos" ON public.form_submissions FOR INSERT TO anon
  WITH CHECK (client_id IS NULL AND email_estado = 'pendiente' AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.activo));
CREATE POLICY "CRM lee respuestas" ON public.form_submissions FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM edita respuestas" ON public.form_submissions FOR UPDATE TO authenticated USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Admin elimina respuestas" ON public.form_submissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX form_submissions_form_idx ON public.form_submissions(form_id, created_at DESC);

INSERT INTO public.forms (id, titulo, slug, crea_cliente, created_by, plantilla_correo) VALUES
 ('00000000-0000-4000-8000-000000000001', 'Formulario primer contacto', 'primer-contacto', true,
  (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1),
  E'Nueva respuesta en {{formulario}}\n\nNombre: {{nombre_completo}}\nCorreo: {{email}}\nTeléfono: {{telefono}}\nNacionalidad: {{nacionalidad}}\nFacturación: {{facturacion}}'),
 ('00000000-0000-4000-8000-000000000002', 'Formulario cliente oficial (cotización)', 'cotizacion', false,
  (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1),
  E'Nueva solicitud de cotización\n\nCorreo: {{email}}\nPersonas: {{total_personas}}\nAdultos mayores: {{cantidad_adultos_mayores}}\nNiños: {{cantidad_ninos}}\nTransporte 4x4: {{transporte_4x4}}\nHospedaje: {{hospedaje}}\nNotas: {{notas}}');

UPDATE public.forms SET validaciones = '[{"tipo":"confirmar_suma_igual_total","total":"total_personas","partes":["cantidad_adultos_mayores","cantidad_ninos"],"mensaje":"Confirma que hay {{cantidad_adultos_mayores}} adultos mayores y {{cantidad_ninos}} niños, y ninguna persona entre 12 y 65 años."}]'::jsonb
 WHERE id = '00000000-0000-4000-8000-000000000002';

INSERT INTO public.form_fields (form_id, orden, etiqueta, variable, tipo, obligatorio, opciones, regla_condicional, mapea_a_campo_cliente) VALUES
 ('00000000-0000-4000-8000-000000000001', 1, 'Nacionalidad', 'nacionalidad', 'dropdown_paises', false, NULL, NULL, 'pais'),
 ('00000000-0000-4000-8000-000000000001', 2, 'Nombre completo', 'nombre_completo', 'text', true, NULL, NULL, 'name'),
 ('00000000-0000-4000-8000-000000000001', 3, 'DNI', 'dni', 'text', false, '{"patron":"^[0-9-]*$","ayuda":"Solo números y guiones"}', NULL, 'dni'),
 ('00000000-0000-4000-8000-000000000001', 4, 'Facturación', 'facturacion', 'dropdown', true, '{"items":[{"label":"No necesitamos","value":"no_necesita"},{"label":"Factura sencilla","value":"sencilla"},{"label":"Factura electrónica","value":"electronica"}],"defecto":"no_necesita"}', NULL, 'tipo_facturacion'),
 ('00000000-0000-4000-8000-000000000001', 5, 'Datos de factura electrónica', 'factura_electronica', 'factura_electronica', true, NULL, '{"campo":"facturacion","valor":"electronica"}', 'billing'),
 ('00000000-0000-4000-8000-000000000001', 6, 'Correo electrónico', 'email', 'email', true, NULL, NULL, 'email'),
 ('00000000-0000-4000-8000-000000000001', 7, 'Número telefónico', 'telefono', 'telefono', true, NULL, NULL, 'phone'),
 ('00000000-0000-4000-8000-000000000002', 1, 'Correo electrónico', 'email', 'email', true, NULL, NULL, 'email'),
 ('00000000-0000-4000-8000-000000000002', 2, 'Cantidad total de personas', 'total_personas', 'number_stepper', true, '{"min":1}', NULL, NULL),
 ('00000000-0000-4000-8000-000000000002', 3, '¿Todas las personas son de la misma nacionalidad?', 'misma_nacionalidad', 'dropdown', true, '{"items":[{"label":"Todos somos extranjeros","value":"extranjeros"},{"label":"Todos somos nacionales","value":"nacionales"},{"label":"Hay nacionales y extranjeros","value":"mixto"}]}', NULL, NULL),
 ('00000000-0000-4000-8000-000000000002', 4, '¿Hay adultos mayores (> 65 años)?', 'adultos_mayores', 'si_no', true, NULL, NULL, NULL),
 ('00000000-0000-4000-8000-000000000002', 5, '¿Hay niños (≤ 11 años)?', 'ninos', 'si_no', true, NULL, NULL, NULL),
 ('00000000-0000-4000-8000-000000000002', 6, 'Cantidad de nacionales (con cédula costarricense)', 'cantidad_nacionales', 'number_stepper', true, '{"min":0}', '{"campo":"misma_nacionalidad","valor":"mixto"}', NULL),
 ('00000000-0000-4000-8000-000000000002', 7, 'Cantidad de adultos mayores', 'cantidad_adultos_mayores', 'number_stepper', true, '{"min":0}', '{"campo":"adultos_mayores","valor":"si"}', NULL),
 ('00000000-0000-4000-8000-000000000002', 8, 'Cantidad de niños', 'cantidad_ninos', 'number_stepper', true, '{"min":0}', '{"campo":"ninos","valor":"si"}', NULL),
 ('00000000-0000-4000-8000-000000000002', 9, '¿Necesitarán transporte 4x4?', 'transporte_4x4', 'dropdown', true, '{"items":[{"label":"Sí necesitamos","value":"si"},{"label":"No, tenemos transporte 4x4 propio","value":"no"}]}', NULL, NULL),
 ('00000000-0000-4000-8000-000000000002', 10, '¿Necesitarán hospedaje?', 'hospedaje', 'dropdown', true, '{"items":[{"label":"Sí necesitamos","value":"si"},{"label":"No, nosotros lo conseguimos","value":"no"}]}', NULL, NULL),
 ('00000000-0000-4000-8000-000000000002', 11, 'Notas adicionales', 'notas', 'paragraph', false, NULL, NULL, NULL);