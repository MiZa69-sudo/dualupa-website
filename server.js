const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT-секрет (в продакшене — в env-переменных)
const JWT_SECRET = process.env.JWT_SECRET || 'dua-lupa-super-secret-key-change-me';

// Подключение к PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false, // наш VPS без SSL
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// Создание таблиц при первом запуске
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                nickname VARCHAR(32) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                balance INTEGER DEFAULT 0,
                rank VARCHAR(50) DEFAULT 'Игрок',
                referrals INTEGER DEFAULT 0,
                referred_by VARCHAR(32)
            );
        `);
        console.log('✅ Database initialized');
    } catch (e) {
        console.error('❌ Database init error:', e.message);
    }
}

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Проверка JWT
function getUserFromToken(req) {
    const token = req.cookies.token;
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

// ===== API: РЕГИСТРАЦИЯ =====
app.post('/api/register', async (req, res) => {
    try {
        const { email, nickname, password, ref } = req.body;

        // Проверки
        if (!email || !nickname || !password) {
            return res.status(400).json({ error: 'Заполни все поля' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        }
        if (nickname.length < 3 || nickname.length > 16) {
            return res.status(400).json({ error: 'Ник от 3 до 16 символов' });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
            return res.status(400).json({ error: 'Ник: только буквы, цифры и _' });
        }

        // Проверка на занятость
        const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email уже занят' });
        }

        const nickCheck = await pool.query('SELECT id FROM users WHERE LOWER(nickname) = LOWER($1)', [nickname]);
        if (nickCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ник уже занят' });
        }

        // Хешируем пароль
        const passwordHash = await bcrypt.hash(password, 10);

        // Генерируем ID
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

        // Создаём пользователя
        await pool.query(
            'INSERT INTO users (id, email, nickname, password_hash, referred_by) VALUES ($1, $2, $3, $4, $5)',
            [id, email, nickname, passwordHash, ref || null]
        );

        // Если есть реферер — увеличиваем счётчик
        if (ref) {
            await pool.query('UPDATE users SET referrals = referrals + 1 WHERE LOWER(nickname) = LOWER($1)', [ref]);
        }

        // Создаём JWT
        const token = jwt.sign(
            { id, email, nickname },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true, nickname });
    } catch (e) {
        console.error('Register error:', e.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ===== API: ЛОГИН =====
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Заполни все поля' });
        }

        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }

        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true, nickname: user.nickname });
    } catch (e) {
        console.error('Login error:', e.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ===== API: ЛОГАУТ =====
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// ===== API: ИНФО О ПОЛЬЗОВАТЕЛЕ =====
app.get('/api/me', async (req, res) => {
    const payload = getUserFromToken(req);
    if (!payload) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    try {
        const result = await pool.query(
            'SELECT nickname, email, balance, rank, referrals, created_at FROM users WHERE id = $1',
            [payload.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        res.json({
            nickname: user.nickname,
            email: user.email,
            balance: user.balance,
            rank: user.rank,
            referrals: user.referrals,
            createdAt: user.created_at
        });
    } catch (e) {
        console.error('Me error:', e.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ===== СТРАНИЦЫ =====
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    const payload = getUserFromToken(req);
    if (!payload) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Проверка здоровья
app.get('/health', (req, res) => {
    res.json({ status: 'ok', project: 'DUA LUPA', time: new Date() });
});

// Всё остальное → index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 DUA LUPA website running on port ${PORT}`);
    });
});
