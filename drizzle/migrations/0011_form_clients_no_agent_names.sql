CREATE OR REPLACE FUNCTION public.clients_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.canal = 'Formulario' AND current_user NOT IN ('service_role','postgres','supabase_admin') THEN
      RAISE EXCEPTION 'El canal "Formulario" solo lo asigna el sistema';
    END IF;
    IF NEW.agente_id IS NULL AND NEW.canal <> 'Formulario' THEN NEW.agente_id := COALESCE(auth.uid(), NEW.user_id); END IF;
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (NEW.id, NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'name', '')), ''), NEW.email);
  PERFORM pg_advisory_xact_lock(hashtext('first_admin'));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agente');
  END IF;
  RETURN NEW;
END $$;

UPDATE public.profiles SET nombre = NULL WHERE nombre = split_part(email,'@',1);
UPDATE public.clients SET agente_id = NULL WHERE canal = 'Formulario' AND agente_id = user_id;