-- ==========================================================
-- Agrega columna payer_email a bars.
--
-- Guardamos el email de la cuenta MP del último pago para que el dueño
-- no tenga que reescribirlo cada vez. Puede ser distinto al email de
-- login del panel (ej: el bar lo registra Ivanna pero paga el padre con
-- su propia cuenta de MP).
-- ==========================================================

alter table public.bars
  add column if not exists payer_email text;
