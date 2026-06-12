CREATE TABLE public.zonas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servicio_id UUID NOT NULL,
  nombre TEXT NOT NULL DEFAULT 'Zona',
  color TEXT NOT NULL DEFAULT '#dc2626',
  puntos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zonas TO anon, authenticated;
GRANT ALL ON public.zonas TO service_role;
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open zonas" ON public.zonas FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.zonas;