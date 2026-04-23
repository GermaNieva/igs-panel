-- ==========================================================
-- Storage policies para menu-photos y bar-assets
-- Correr UNA VEZ después de crear los buckets en el dashboard.
-- Es idempotente: podés correrlo varias veces sin romper.
-- ==========================================================

-- Limpieza previa (no falla si las policies no existen)
drop policy if exists "public_read_menu_photos" on storage.objects;
drop policy if exists "public_read_bar_assets" on storage.objects;
drop policy if exists "bar_staff_write_menu_photos" on storage.objects;
drop policy if exists "bar_staff_write_bar_assets" on storage.objects;

-- Lectura pública: el cliente ve las fotos al escanear el QR (sin login)
create policy "public_read_menu_photos"
  on storage.objects for select to public
  using (bucket_id = 'menu-photos');

create policy "public_read_bar_assets"
  on storage.objects for select to public
  using (bucket_id = 'bar-assets');

-- Escritura: solo dueño/encargado del bar pueden subir/modificar/borrar.
-- Convención de path: el primer segmento es el bar_id (ej: "{uuid}/items/locro.jpg")
create policy "bar_staff_write_menu_photos"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'menu-photos'
    and (storage.foldername(name))[1] = (select public.current_bar_id()::text)
  )
  with check (
    bucket_id = 'menu-photos'
    and (storage.foldername(name))[1] = (select public.current_bar_id()::text)
  );

create policy "bar_staff_write_bar_assets"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'bar-assets'
    and (storage.foldername(name))[1] = (select public.current_bar_id()::text)
  )
  with check (
    bucket_id = 'bar-assets'
    and (storage.foldername(name))[1] = (select public.current_bar_id()::text)
  );
