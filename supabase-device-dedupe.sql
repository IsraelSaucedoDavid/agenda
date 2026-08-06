-- ============================================================================
-- ÓRBITA · Deduplicación de suscripciones push por dispositivo
-- ----------------------------------------------------------------------------
-- Objetivo: si el mismo dispositivo desinstala y vuelve a instalar la app,
-- se genera un endpoint FCM nuevo. Este script permite identificar el
-- dispositivo una sola vez y, si se vuelve a registrar, ACTUALIZAR el mismo
-- registro en lugar de acumular filas duplicadas.
--
-- Cómo funciona:
--   · device_id : UUID estable por navegador/instalación (localStorage).
--   · device_fp : huella del dispositivo (userAgent, pantalla, idioma, etc.)
--                 que NO cambia al desinstalar/reinstalar.
--   · Índice único (user_id, device_fp): la app hace upsert sobre él, así
--                 cada dispositivo tiene UNA sola fila por cuenta.
--
-- Ejecutar en: Supabase → SQL Editor (una sola pasada, es idempotente).
-- ============================================================================

-- 1) Columnas nuevas (nullable para no romper filas existentes)
alter table public.push_subscriptions add column if not exists device_id text;
alter table public.push_subscriptions add column if not exists device_fp text;

-- 2) Índice único: una fila por (cuenta, dispositivo).
--    (En Postgres los NULL no colisionan, así que las filas antiguas sin
--    huella coexisten y se van depurando solas con el 410 del worker.)
create unique index if not exists push_subscriptions_user_device_key
  on public.push_subscriptions (user_id, device_fp);

-- ============================================================================
-- 3) OPCIONAL: purga de filas heredadas (sin device_fp).
--    Las filas de antes de esta migración no tienen huella; el worker las
--    borra cuando FCM responde 410 (instalación desinstalada). Si prefieres
--    limpiar YA, abre la app una vez en cada dispositivo y descomenta:
--
-- delete from public.push_subscriptions where device_fp is null;
-- ============================================================================
