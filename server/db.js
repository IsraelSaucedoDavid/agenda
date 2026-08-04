const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err.message);
    return;
  }
  console.log('Conectado a la base de datos SQLite.');
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_data (
      id TEXT PRIMARY KEY,
      pages TEXT,
      "order" TEXT,
      updatedAt TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reminder_sent (
      user_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      notify_at TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      PRIMARY KEY (user_id, block_id, notify_at)
    )
  `);
});

module.exports = db;
