const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>DUA LUPA</title>
      <style>
        body {
          background: #08080d;
          color: #B57EEC;
          font-family: 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        h1 { font-size: 60px; letter-spacing: 8px; }
        p { color: #888; }
      </style>
    </head>
    <body>
      <div>
        <h1>DUA LUPA</h1>
        <p>Сайт в разработке. Скоро здесь будет круто.</p>
      </div>
    </body>
    </html>
  `);
});

// Проверка здоровья (для Render)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'DUA LUPA' });
});

app.listen(PORT, () => {
  console.log(`DUA LUPA website running on port ${PORT}`);
});
