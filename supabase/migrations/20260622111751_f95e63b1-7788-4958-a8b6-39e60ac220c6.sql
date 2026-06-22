
-- App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'mando', 'voluntario');

-- Usuarios: indicativo <-> auth.users <-> email
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  indicativo text NOT NULL UNIQUE,
  email text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- User roles separate table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Accesos log
CREATE TABLE public.accesos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  indicativo text NOT NULL,
  email text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.accesos_log TO authenticated;
GRANT ALL ON public.accesos_log TO service_role;
ALTER TABLE public.accesos_log ENABLE ROW LEVEL SECURITY;

-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Lookup helper for login by indicativo (needs to read email/revoked without auth)
CREATE OR REPLACE FUNCTION public.lookup_indicativo(_indicativo text)
RETURNS TABLE(email text, revoked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, revoked FROM public.usuarios WHERE upper(indicativo) = upper(_indicativo) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.lookup_indicativo(text) TO anon, authenticated;

-- Trigger: handle_new_user creates usuarios row using indicativo from metadata; admin role auto for guille email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ind text;
BEGIN
  v_ind := upper(coalesce(NEW.raw_user_meta_data->>'indicativo', ''));
  IF v_ind <> '' THEN
    INSERT INTO public.usuarios (user_id, indicativo, email)
    VALUES (NEW.id, v_ind, NEW.email)
    ON CONFLICT (indicativo) DO NOTHING;
  END IF;

  IF lower(NEW.email) = 'guille.merino.tes@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mando') ON CONFLICT DO NOTHING;
  ELSIF v_ind LIKE 'V%' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'voluntario') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mando') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger for usuarios
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER usuarios_updated_at BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
-- usuarios: authenticated can read all (to display roles); only admin can update revoked/role assignments
CREATE POLICY "auth read usuarios" ON public.usuarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "self insert usuarios" ON public.usuarios
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin update usuarios" ON public.usuarios
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: authenticated can read (to know own role); only admin can insert/delete
CREATE POLICY "auth read user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- accesos_log: insert allowed for any authenticated, select only admin
CREATE POLICY "self insert accesos" ON public.accesos_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin read accesos" ON public.accesos_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
