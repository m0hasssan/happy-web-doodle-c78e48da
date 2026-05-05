-- Shifts table
CREATE TABLE public.shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL DEFAULT (('SH-' || to_char(now(), 'YYMMDDHH24MISS')) || '-' || substr(gen_random_uuid()::text, 1, 4)),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  started_by_user_id uuid NULL,
  started_by_name text NULL,
  ended_by_user_id uuid NULL,
  ended_by_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one open shift at a time
CREATE UNIQUE INDEX shifts_one_open ON public.shifts ((ended_at IS NULL)) WHERE ended_at IS NULL;

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view shifts" ON public.shifts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert shifts" ON public.shifts
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update shifts" ON public.shifts
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete shifts" ON public.shifts
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link movements to shift
ALTER TABLE public.movements ADD COLUMN shift_id uuid NULL;
CREATE INDEX movements_shift_id_idx ON public.movements(shift_id);