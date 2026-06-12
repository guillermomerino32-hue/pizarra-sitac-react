
CREATE TABLE public.trazos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL,
  panel text NOT NULL,
  color text NOT NULL DEFAULT '#111111',
  puntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trazos TO anon, authenticated;
GRANT ALL ON public.trazos TO service_role;
ALTER TABLE public.trazos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open trazos" ON public.trazos FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.trazos;

CREATE TABLE public.focos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL,
  panel text NOT NULL,
  nombre text NOT NULL DEFAULT 'Foco',
  info text NOT NULL DEFAULT '',
  x real NOT NULL DEFAULT 200,
  y real NOT NULL DEFAULT 200,
  lat double precision,
  lng double precision,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focos TO anon, authenticated;
GRANT ALL ON public.focos TO service_role;
ALTER TABLE public.focos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open focos" ON public.focos FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.focos;
