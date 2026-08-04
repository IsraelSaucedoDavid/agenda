const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const db = require('./db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;
const TICK_MS = Math.max(5000, parseInt(process.env.REMINDER_TICK_MS || '15000', 10) || 15000);

let supabase = null;

function init() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Recordatorios desactivados: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
    console.warn('Recordatorios desactivados: faltan las claves VAPID.');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  setInterval(tick, TICK_MS);
  tick();
  console.log(`Worker de recordatorios activo (cada ${TICK_MS / 1000}s).`);
}

function extractDue(workspace) {
  const now = Date.now();
  const due = [];
  const pages = workspace.pages || {};
  for (const pageId of Object.keys(pages)) {
    const page = pages[pageId];
    if (!page || !Array.isArray(page.blocks)) continue;
    for (const b of page.blocks) {
      if (!b || b.type !== 'todo') continue;
      if (b.checked) continue;
      if (!b.notifyAt) continue;
      const t = new Date(b.notifyAt).getTime();
      if (Number.isNaN(t) || t > now) continue;
      due.push({
        blockId: b.id,
        notifyAt: b.notifyAt,
        text: (b.text || '').trim() || 'Tienes una tarea pendiente',
        pageId,
        pageTitle: page.title || 'Sin título',
        pageIcon: page.icon || '',
      });
    }
  }
  return due;
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function processWorkspace(ws) {
  const due = extractDue(ws);
  if (due.length === 0) return;

  const sentRows = await dbAll(
    'SELECT block_id, notify_at FROM reminder_sent WHERE user_id = ?',
    [ws.user_id]
  );
  const sentSet = new Set(sentRows.map((r) => `${r.block_id}|${r.notify_at}`));
  const pending = due.filter((d) => !sentSet.has(`${d.blockId}|${d.notifyAt}`));
  if (pending.length === 0) return;

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', ws.user_id);
  if (error) {
    console.error(`Error cargando suscripciones de ${ws.user_id}:`, error.message);
    return;
  }
  if (!subs || subs.length === 0) return;

  const sentAt = new Date().toISOString();
  for (const d of pending) {
    const payload = JSON.stringify({
      title: '⏰ ' + d.text,
      body: `${d.pageIcon} ${d.pageTitle}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url: '/?page=' + encodeURIComponent(d.pageId),
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 3600 }
        );
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .match({ user_id: ws.user_id, endpoint: sub.endpoint });
        } else {
          console.warn(`Push fallido para ${ws.user_id}:`, (err && err.message) || err);
        }
      }
    }
    await dbRun(
      'INSERT OR IGNORE INTO reminder_sent (user_id, block_id, notify_at, sent_at) VALUES (?, ?, ?, ?)',
      [ws.user_id, d.blockId, d.notifyAt, sentAt]
    );
  }
}

async function tick() {
  if (!supabase) return;
  try {
    const { data: workspaces, error } = await supabase
      .from('user_workspaces')
      .select('user_id, pages');
    if (error) {
      console.error('Error cargando workspaces:', error.message);
      return;
    }
    for (const ws of workspaces || []) {
      await processWorkspace(ws);
    }
  } catch (err) {
    console.error('Error en worker de recordatorios:', (err && err.message) || err);
  }
}

module.exports = { init, extractDue };
