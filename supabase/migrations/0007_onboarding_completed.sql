-- Campo onboarding_completed en bars: marca si el dueño completó el wizard
-- inicial (datos del bar, primera categoría/plato, mesas, etc.).
-- Bares existentes los marcamos en TRUE — asumimos que ya tienen su data
-- cargada manualmente. Bares nuevos arrancan en FALSE y van al wizard.

ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: cualquier bar existente al momento de aplicar la migración
-- queda marcado como completado.
UPDATE public.bars SET onboarding_completed = TRUE WHERE created_at < NOW();
