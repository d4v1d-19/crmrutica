ALTER TABLE public.clients ALTER COLUMN codigo SET DEFAULT '';

CREATE OR REPLACE FUNCTION public.clients_set_codigo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('clients_codigo'));
  NEW.codigo := 'CL-' || lpad((COALESCE((SELECT max(substring(codigo from 4)::int) FROM public.clients WHERE codigo ~ '^CL-[0-9]+$'), 0) + 1)::text, 4, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER clients_set_codigo_trg BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.clients_set_codigo();

ALTER TABLE public.clients DISABLE TRIGGER clients_guard_trg;
UPDATE public.clients c SET codigo = 'CL-' || lpad(x.rn::text, 4, '0')
FROM (SELECT id, row_number() OVER (ORDER BY created_at) rn FROM public.clients) x WHERE x.id = c.id;
ALTER TABLE public.clients ENABLE TRIGGER clients_guard_trg;
COMMENT ON SEQUENCE public.clients_codigo_seq IS 'DEPRECATED: codigo now assigned gaplessly by clients_set_codigo trigger';