-- Cambiamos el período de prueba de 14 a 15 días para alinearlo con los
-- Términos y Condiciones publicados (/terminos).
-- Solo afecta a nuevos bares: los existentes mantienen el trial_ends_at
-- que ya tienen.

alter table public.bars
  alter column trial_ends_at set default (now() + interval '15 days');
