CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Costa_Rica')::date),
  metodo text NOT NULL CHECK (metodo IN ('efectivo','transferencia','sinpe_movil','tarjeta','otro')),
  nota text,
  registrado_por uuid,
  registrado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice_idx ON public.payments(invoice_id);
GRANT SELECT, INSERT, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lee pagos" ON public.payments FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CRM registra pagos" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_active_user(auth.uid()));
CREATE POLICY "Admin elimina pagos" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.payments_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _total numeric; _pagado numeric;
BEGIN
  SELECT total INTO _total FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  SELECT COALESCE(sum(monto),0) INTO _pagado FROM public.payments WHERE invoice_id = NEW.invoice_id;
  IF _pagado >= _total THEN RAISE EXCEPTION 'La factura ya está pagada'; END IF;
  IF _pagado + NEW.monto > _total THEN RAISE EXCEPTION 'El abono excede el saldo pendiente'; END IF;
  NEW.registrado_por := auth.uid();
  NEW.registrado_por_nombre := (SELECT COALESCE(nombre, email) FROM public.profiles WHERE id = auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER payments_guard_trg BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.payments_guard();