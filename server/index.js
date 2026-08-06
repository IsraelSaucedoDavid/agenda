const express = require('express');
const reminders = require('./reminders');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Espacio Sync API is running.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de sincronización escuchando en el puerto ${PORT}`);
  reminders.init();
});
