
-- Servicios
CREATE TABLE public.servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'activo',
  mando_indicativo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicios TO anon, authenticated;
GRANT ALL ON public.servicios TO service_role;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open servicios" ON public.servicios FOR ALL USING (true) WITH CHECK (true);

-- Intervinientes
CREATE TABLE public.intervinientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  indicativo_recurso TEXT NOT NULL,
  indicativo_intervinientes TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'vehiculo' | 'pie'
  funcion TEXT NOT NULL, -- sanitario|rescate|extincion|logistico|mando
  subtipo TEXT, -- ambulancia|cardio
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (servicio_id, indicativo_recurso),
  UNIQUE (servicio_id, indicativo_intervinientes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervinientes TO anon, authenticated;
GRANT ALL ON public.intervinientes TO service_role;
ALTER TABLE public.intervinientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open intervinientes" ON public.intervinientes FOR ALL USING (true) WITH CHECK (true);

-- Stickers (placed on a panel)
CREATE TABLE public.stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  interviniente_id UUID NOT NULL REFERENCES public.intervinientes(id) ON DELETE CASCADE,
  panel TEXT NOT NULL, -- 'mapa' | 'pizarra'
  x REAL NOT NULL DEFAULT 100,
  y REAL NOT NULL DEFAULT 100,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  clave TEXT NOT NULL DEFAULT 'C2',
  dashed BOOLEAN NOT NULL DEFAULT true,
  removed BOOLEAN NOT NULL DEFAULT false,
  c2_at TIMESTAMPTZ DEFAULT now(),
  c3_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (servicio_id, interviniente_id, panel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stickers TO anon, authenticated;
GRANT ALL ON public.stickers TO service_role;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open stickers" ON public.stickers FOR ALL USING (true) WITH CHECK (true);

-- Claves log
CREATE TABLE public.claves_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  indicativo_recurso TEXT NOT NULL,
  clave TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claves_log TO anon, authenticated;
GRANT ALL ON public.claves_log TO service_role;
ALTER TABLE public.claves_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open claves_log" ON public.claves_log FOR ALL USING (true) WITH CHECK (true);

-- Historial
CREATE TABLE public.historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url TEXT,
  resumen JSONB
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historial TO anon, authenticated;
GRANT ALL ON public.historial TO service_role;
ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open historial" ON public.historial FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.servicios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intervinientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stickers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.claves_log;

ALTER TABLE public.intervinientes REPLICA IDENTITY FULL;
ALTER TABLE public.stickers REPLICA IDENTITY FULL;
ALTER TABLE public.claves_log REPLICA IDENTITY FULL;
ALTER TABLE public.servicios REPLICA IDENTITY FULL;
