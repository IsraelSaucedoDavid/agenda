const express = require('express');
const cors = require('cors');
const db = require('./db');
const reminders = require('./reminders');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.send('Espacio Sync API is running.');
});

// Obtener datos de sincronización
app.get('/api/sync', (req, res) => {
  db.get("SELECT pages, \"order\", updatedAt FROM sync_data WHERE id = 'workspace'", [], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    if (!row) {
      return res.json({ pages: null, order: null, updatedAt: null });
    }
    res.json({
      pages: JSON.parse(row.pages),
      order: JSON.parse(row.order),
      updatedAt: row.updatedAt
    });
  });
});

// Actualizar datos de sincronización
app.post('/api/sync', (req, res) => {
  const { pages, order, updatedAt } = req.body;
  if (!pages || !order || !updatedAt) {
    return res.status(400).json({ error: 'Parámetros incompletos' });
  }

  const pagesStr = JSON.stringify(pages);
  const orderStr = JSON.stringify(order);

  db.run(
    `INSERT INTO sync_data (id, pages, "order", updatedAt) 
     VALUES ('workspace', ?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET pages = excluded.pages, "order" = excluded."order", updatedAt = excluded.updatedAt`,
    [pagesStr, orderStr, updatedAt],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error en la base de datos' });
      }
      res.json({ success: true });
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de sincronización escuchando en el puerto ${PORT}`);
  reminders.init();
});
