-- ============================================================================
-- ÓRBITA · Autorización de Realtime (Broadcast / Presence)
-- ----------------------------------------------------------------------------
-- Protege los canales realtime de la app:
--   · `page:<id>`            -> colaboración en vivo (broadcast + presence)
--   · `user_notifs:<email>`  -> avisos de invitación / respuesta / revocación
--
-- Sin esto, cualquiera con la clave ANÓNIMA (sin login) puede suscribirse a
-- cualquier canal, leer y transmitir mensajes (verificado en producción).
--
-- IMPORTANTE:
--   · El RLS en `realtime.messages` ya está habilitado por defecto en Supabase.
--   · Estas políticas SOLO se evalúan en canales marcados `private: true`
--     desde el cliente (ya implementado en src/App.jsx).
--   · `postgres_changes` NO usa estas políticas: respeta el RLS de la tabla
--     escuchada (support_tickets) como siempre.
--   · Ejecutar en: Supabase → SQL Editor (es idempotente).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CANAL user_notifs:<email>
--   · Leer (SELECT) y Escribir (INSERT): el dueño del correo, el dueño de una
--     invitación hacia ese correo, o el invitado por ese correo (relación real
--     de page_shares en ambos sentidos).
--   · Nota: el servidor rechaza un canal privado si no hay permiso de LECTURA
--     (no existe el join "write-only"), por eso SELECT e INSERT usan la misma
--     regla de relación.
-- ---------------------------------------------------------------------------
drop policy if exists "rt_user_notifs_read" on realtime.messages;
create policy "rt_user_notifs_read"
  on realtime.messages
  as permissive for select to authenticated
  using (
    (select realtime.topic()) like 'user_notifs:%'
    and (
      lower(split_part((select realtime.topic()), ':', 2))
          = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      or exists (
        select 1 from public.page_shares ps
        where lower(ps.shared_with_email) = lower(split_part((select realtime.topic()), ':', 2))
          and ps.owner_id = (select auth.uid())
      )
      or exists (
        select 1 from public.page_shares ps
        join public.profiles p on p.id = ps.owner_id
        where lower(p.email) = lower(split_part((select realtime.topic()), ':', 2))
          and lower(ps.shared_with_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
    )
  );

drop policy if exists "rt_user_notifs_write" on realtime.messages;
create policy "rt_user_notifs_write"
  on realtime.messages
  as permissive for insert to authenticated
  with check (
    (select realtime.topic()) like 'user_notifs:%'
    and (
      lower(split_part((select realtime.topic()), ':', 2))
          = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      or exists (
        select 1 from public.page_shares ps
        where lower(ps.shared_with_email) = lower(split_part((select realtime.topic()), ':', 2))
          and ps.owner_id = (select auth.uid())
      )
      or exists (
        select 1 from public.page_shares ps
        join public.profiles p on p.id = ps.owner_id
        where lower(p.email) = lower(split_part((select realtime.topic()), ':', 2))
          and lower(ps.shared_with_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- CANAL page:<id>
--   · Leer (SELECT) y Escribir (INSERT): el dueño de la página (la tiene en
--     su user_workspaces.pages), los colaboradores registrados en
--     page_shares, o un admin.
-- ---------------------------------------------------------------------------
drop policy if exists "rt_page_read" on realtime.messages;
create policy "rt_page_read"
  on realtime.messages
  as permissive for select to authenticated
  using (
    (select realtime.topic()) like 'page:%'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_workspaces uw
        where uw.user_id = (select auth.uid())
          and uw.pages -> (select split_part(realtime.topic(), ':', 2)) is not null
      )
      or exists (
        select 1 from public.page_shares ps
        where ps.page_id = (select split_part(realtime.topic(), ':', 2))
          and (
            ps.owner_id = (select auth.uid())
            or ps.shared_with_user_id = (select auth.uid())
            or lower(ps.shared_with_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          )
      )
    )
  );

drop policy if exists "rt_page_write" on realtime.messages;
create policy "rt_page_write"
  on realtime.messages
  as permissive for insert to authenticated
  with check (
    (select realtime.topic()) like 'page:%'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_workspaces uw
        where uw.user_id = (select auth.uid())
          and uw.pages -> (select split_part(realtime.topic(), ':', 2)) is not null
      )
      or exists (
        select 1 from public.page_shares ps
        where ps.page_id = (select split_part(realtime.topic(), ':', 2))
          and (
            ps.owner_id = (select auth.uid())
            or ps.shared_with_user_id = (select auth.uid())
            or lower(ps.shared_with_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          )
      )
    )
  );
