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
--   · Leer (SELECT): solo el usuario dueño de ese correo.
--   · Enviar (INSERT): cualquier autenticado (join write-only). El canal es
--     efímero (avisos de UI); el acceso real a los datos lo sigue gobernando
--     el RLS de `page_shares`. Riesgo residual aceptado: un usuario logueado
--     podría spamear una notificación falsa (sin acceso a datos).
-- ---------------------------------------------------------------------------
drop policy if exists "rt_user_notifs_read" on realtime.messages;
create policy "rt_user_notifs_read"
  on realtime.messages
  as permissive for select to authenticated
  using (
    (select realtime.topic()) like 'user_notifs:%'
    and lower(split_part((select realtime.topic()), ':', 2))
        = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

drop policy if exists "rt_user_notifs_write" on realtime.messages;
create policy "rt_user_notifs_write"
  on realtime.messages
  as permissive for insert to authenticated
  with check (
    (select realtime.topic()) like 'user_notifs:%'
    and realtime.messages.extension in ('broadcast')
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
