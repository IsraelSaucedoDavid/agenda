-- ============================================================================
-- ÓRBITA · HARDENING RLS (Row Level Security)
-- ----------------------------------------------------------------------------
-- Objetivo: cerrar la escalada a admin y las fugas de datos entre usuarios.
-- Ejecutar en: Supabase → SQL Editor (una sola pasada, es idempotente).
--
-- IMPORTANTE:
--   · La service_role / SQL Editor BYPASEA las políticas (por eso el worker de
--     recordatorios del backend sigue funcionando sin cambios).
--   · Si una tabla ya tenía políticas propias, revisa el listado "Policies"
--     de esa tabla después de ejecutar; este script solo reemplaza las suyas.
--   · No ejecutes esto con un usuario "admin" ya existente sin antes probar
--     en otra cuenta que el rol se asigna correctamente.
-- ============================================================================

-- ============================================================================
-- 1) FUNCIÓN is_admin()  (SECURITY DEFINER → evita recursión de políticas)
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ============================================================================
-- 2) TRIGGER protect: impide que un cliente cambie role / is_blocked
--    - INSERT  (desde cliente): fuerza role='user', is_blocked=false.
--    - UPDATE  (desde cliente): si quien ejecuta NO es admin, restaura los
--      valores previos de role e is_blocked (bloquea la auto-escalada).
--    - Cuando auth.uid() es NULL (service_role / SQL Editor): paso libre,
--      para que puedas crear/promover admins por SQL sin que se reviertan.
-- ============================================================================
create or replace function public.protect_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into actor_is_admin;

  if TG_OP = 'INSERT' then
    new.role      := coalesce(nullif(new.role, ''), 'user');
    new.is_blocked := coalesce(new.is_blocked, false);
    return new;
  end if;

  -- UPDATE
  if not actor_is_admin then
    new.role       := old.role;
    new.is_blocked := old.is_blocked;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_privileged_columns on public.profiles;
create trigger trg_protect_privileged_columns
before insert or update on public.profiles
for each row execute function public.protect_privileged_columns();

-- ============================================================================
-- 3) POLÍTICAS RLS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: cada quien su fila; los admin ven todo.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- user_workspaces: tu workspace + los de quienes te comparten una página
-- (la app lee el workspace del dueño para cargar la página compartida).
-- ---------------------------------------------------------------------------
alter table public.user_workspaces enable row level security;

drop policy if exists "uw_select" on public.user_workspaces;
create policy "uw_select" on public.user_workspaces
  for select to authenticated
  using (
    user_id = auth.uid()
    or user_id in (
      select owner_id from public.page_shares
      where lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or public.is_admin()
  );

drop policy if exists "uw_insert" on public.user_workspaces;
create policy "uw_insert" on public.user_workspaces
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "uw_update" on public.user_workspaces;
create policy "uw_update" on public.user_workspaces
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "uw_delete" on public.user_workspaces;
create policy "uw_delete" on public.user_workspaces
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- page_shares: el dueño y el destinatario (o admin).
-- ---------------------------------------------------------------------------
alter table public.page_shares enable row level security;

drop policy if exists "shares_select" on public.page_shares;
create policy "shares_select" on public.page_shares
  for select to authenticated
  using (
    owner_id = auth.uid()
    or lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_admin()
  );

drop policy if exists "shares_insert" on public.page_shares;
create policy "shares_insert" on public.page_shares
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "shares_update" on public.page_shares;
create policy "shares_update" on public.page_shares
  for update to authenticated
  using (
    owner_id = auth.uid()
    or lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_id = auth.uid()
    or lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "shares_delete" on public.page_shares;
create policy "shares_delete" on public.page_shares
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- push_subscriptions: solo tus suscripciones (el worker usa service_role).
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

drop policy if exists "ps_select" on public.push_subscriptions;
create policy "ps_select" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ps_insert" on public.push_subscriptions;
create policy "ps_insert" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "ps_update" on public.push_subscriptions;
create policy "ps_update" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ps_delete" on public.push_subscriptions;
create policy "ps_delete" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- support_tickets: tú creas y ves los tuyos; solo admin lee/edita todos.
-- ---------------------------------------------------------------------------
alter table public.support_tickets enable row level security;

drop policy if exists "tickets_insert" on public.support_tickets;
create policy "tickets_insert" on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "tickets_select" on public.support_tickets;
create policy "tickets_select" on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "tickets_update" on public.support_tickets;
create policy "tickets_update" on public.support_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tickets_delete" on public.support_tickets;
create policy "tickets_delete" on public.support_tickets
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- announcements: todos leen; solo admin escribe.
-- ---------------------------------------------------------------------------
alter table public.announcements enable row level security;

drop policy if exists "ann_select" on public.announcements;
create policy "ann_select" on public.announcements
  for select to authenticated
  using (true);

drop policy if exists "ann_insert" on public.announcements;
create policy "ann_insert" on public.announcements
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "ann_update" on public.announcements;
create policy "ann_update" on public.announcements
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ann_delete" on public.announcements;
create policy "ann_delete" on public.announcements
  for delete to authenticated
  using (public.is_admin());

-- ============================================================================
-- 4) CÓMO HACERTE ADMIN (promoción manual, por SQL):
--    update public.profiles set role = 'admin' where id = '<tu_uuid>';
--    (auth.uid() es NULL aquí, así que el trigger no lo revierte)
--
--    CÓMO REVERTIR TODO ESTO:
--    drop trigger if exists trg_protect_privileged_columns on public.profiles;
--    drop function if exists public.protect_privileged_columns();
--    drop function if exists public.is_admin();
--    alter table public.profiles        disable row level security;
--    alter table public.user_workspaces disable row level security;
--    alter table public.page_shares     disable row level security;
--    alter table public.push_subscriptions disable row level security;
--    alter table public.support_tickets disable row level security;
--    alter table public.announcements   disable row level security;
-- ============================================================================
