const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Отдаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// API-проверка здоровья
app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'DUA LUPA', time: new Date() });
});

// Все остальные маршруты → index.html (для SPA-роутинга)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DUA LUPA website running on port ${PORT}`);
});
