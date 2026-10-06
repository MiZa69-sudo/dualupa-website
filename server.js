const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Секрет для JWT (в продакшене хранить в переменных окружения!)
const JWT_SECRET = process.env.JWT_SECRET || 'dua-lupa-super-secret-key-change-me';

// Путь к "базе данных" (простой JSON-файл)
const DB_PATH = path.join(__dirname, 'users.json');

// ===== ХЕЛПЕРЫ ДЛЯ РАБОТЫ С БАЗОЙ =====
function readUsers() {
    try {
        if (!fs.existsSync(DB_PATH)) return [];
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Проверка авторизации по JWT из cookie
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
        const { email, nickname, password } = req.body;

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

        const users = readUsers();

        // Проверка на занятость
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({ error: 'Email уже занят' });
        }
        if (users.find(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
            return res.status(400).json({ error: 'Ник уже занят' });
        }

        // Хешируем пароль
        const passwordHash = await bcrypt.hash(password, 10);

        // Создаём пользователя
        const user = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            email,
            nickname,
            passwordHash,
            createdAt: new Date().toISOString(),
            balance: 0,
            rank: 'Игрок',
            referrals: 0
        };

        users.push(user);
        writeUsers(users);

        // Создаём JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
        });

        res.json({ success: true, nickname: user.nickname });
    } catch (e) {
        console.error(e);
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

        const users = readUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
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
        console.error(e);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ===== API: ЛОГАУТ =====
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// ===== API: ИНФО О ПОЛЬЗОВАТЕЛЕ =====
app.get('/api/me', (req, res) => {
    const payload = getUserFromToken(req);
    if (!payload) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const users = readUsers();
    const user = users.find(u => u.id === payload.id);
    if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
    }

    res.json({
        nickname: user.nickname,
        email: user.email,
        balance: user.balance,
        rank: user.rank,
        referrals: user.referrals,
        createdAt: user.createdAt
    });
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

app.listen(PORT, () => {
    console.log(`DUA LUPA website running on port ${PORT}`);
});
