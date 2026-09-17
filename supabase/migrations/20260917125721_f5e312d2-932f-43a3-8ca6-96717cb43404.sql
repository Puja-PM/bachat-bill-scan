CREATE TABLE public.match_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  line_text text NOT NULL,
  product_id uuid,
  confidence numeric,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_cache TO authenticated;
GRANT SELECT, INSERT ON public.match_cache TO anon;
GRANT ALL ON public.match_cache TO service_role;

ALTER TABLE public.match_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read match cache" ON public.match_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can add match cache" ON public.match_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update match cache" ON public.match_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete match cache" ON public.match_cache FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_match_cache_updated_at BEFORE UPDATE ON public.match_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();