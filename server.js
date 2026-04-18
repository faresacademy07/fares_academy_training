const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize admin account on startup
require('./init-admin.js');

const app = express();
const PORT = process.env.PORT || 8889;
const JWT_SECRET = process.env.JWT_SECRET || 'fares_academy_secret_key_2024';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Database file path
const dbPath = path.join(__dirname, 'database.json');

// Initialize database if it doesn't exist
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        users: [],
        data: {
            subscribers: [],
            programs: [],
            measurements: []
        }
    }, null, 2));
}

// Read database
function readDatabase() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading database:', e);
        return { users: [], data: { subscribers: [], programs: [], measurements: [] } };
    }
}

// Write database
function writeDatabase(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing database:', e);
    }
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (e) {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
}

// ==================== AUTH ENDPOINTS ====================

// POST /api/auth/register - Register new user
app.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const db = readDatabase();
    
    // Check if user exists
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = {
        id: Date.now().toString(),
        email,
        password: hashedPassword,
        name,
        role: email === 'faresacademy07@hotmail.com' ? 'admin' : 'user',
        createdAt: new Date().toISOString()
    };

    db.users.push(user);
    writeDatabase(db);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// POST /api/auth/login - Login user
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Missing email or password' });
    }

    const db = readDatabase();
    const user = db.users.find(u => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// GET /api/auth/me - Get current user
app.get('/api/auth/me', verifyToken, (req, res) => {
    const db = readDatabase();
    const user = db.users.find(u => u.id === req.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ==================== DATA ENDPOINTS ====================

// GET /api/data - Get user's data
app.get('/api/data', verifyToken, (req, res) => {
    const db = readDatabase();
    const userData = db.data[req.userId] || { subscribers: [], programs: [], measurements: [] };
    res.json(userData);
});

// POST /api/data/subscribers - Add subscriber
app.post('/api/data/subscribers', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        db.data[req.userId] = { subscribers: [], programs: [], measurements: [] };
    }
    
    const subscriber = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    
    db.data[req.userId].subscribers.push(subscriber);
    writeDatabase(db);
    res.json({ success: true, subscriber });
});

// GET /api/data/subscribers - Get all subscribers
app.get('/api/data/subscribers', verifyToken, (req, res) => {
    const db = readDatabase();
    const user = db.users.find(u => u.id === req.userId);
    
    let subscribers = [];
    if (user && user.role === 'admin') {
        // Admin sees all subscribers from all users
        Object.keys(db.data).forEach(userId => {
            if (db.data[userId]?.subscribers) {
                subscribers = subscribers.concat(db.data[userId].subscribers.map(s => ({
                    ...s,
                    userId: userId,
                    userName: db.users.find(u => u.id === userId)?.name
                })));
            }
        });
    } else {
        // Regular users see only their own subscribers
        subscribers = db.data[req.userId]?.subscribers || [];
    }
    res.json(subscribers);
});

// PUT /api/data/subscribers/:id - Update subscriber
app.put('/api/data/subscribers/:id', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        return res.status(404).json({ success: false, error: 'No data found' });
    }
    
    const index = db.data[req.userId].subscribers.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        db.data[req.userId].subscribers[index] = { ...db.data[req.userId].subscribers[index], ...req.body };
        writeDatabase(db);
        res.json({ success: true, subscriber: db.data[req.userId].subscribers[index] });
    } else {
        res.status(404).json({ success: false, error: 'Subscriber not found' });
    }
});

// DELETE /api/data/subscribers/:id - Delete subscriber
app.delete('/api/data/subscribers/:id', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        return res.status(404).json({ success: false, error: 'No data found' });
    }
    
    db.data[req.userId].subscribers = db.data[req.userId].subscribers.filter(s => s.id !== req.params.id);
    db.data[req.userId].programs = db.data[req.userId].programs.filter(p => p.subscriberId !== req.params.id);
    db.data[req.userId].measurements = db.data[req.userId].measurements.filter(m => m.subscriberId !== req.params.id);
    writeDatabase(db);
    res.json({ success: true });
});

// PUT /api/data/subscribers/:id/session - Update session date
app.put('/api/data/subscribers/:id/session', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        return res.status(404).json({ success: false, error: 'No data found' });
    }
    
    const { sessionIndex, date } = req.body;
    const index = db.data[req.userId].subscribers.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        if (!db.data[req.userId].subscribers[index].sessionDates) {
            db.data[req.userId].subscribers[index].sessionDates = [];
        }
        db.data[req.userId].subscribers[index].sessionDates[sessionIndex] = date;
        writeDatabase(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, error: 'Subscriber not found' });
    }
});

// GET /api/admin/users - Get all users (admin only)
app.get('/api/admin/users', verifyToken, (req, res) => {
    const db = readDatabase();
    const user = db.users.find(u => u.id === req.userId);
    
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const users = db.users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt
    }));
    res.json(users);
});

// GET /api/admin/dashboard - Get all data for admin (admin only)
app.get('/api/admin/dashboard', verifyToken, (req, res) => {
    const db = readDatabase();
    const user = db.users.find(u => u.id === req.userId);
    
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const allData = [];
    Object.keys(db.data).forEach(userId => {
        const userData = db.users.find(u => u.id === userId);
        if (userData && db.data[userId]?.subscribers) {
            allData.push({
                userId: userId,
                userName: userData.name,
                userEmail: userData.email,
                subscribers: db.data[userId].subscribers
            });
        }
    });
    res.json(allData);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎓 Fares Academy Training running on http://localhost:${PORT}`);
    console.log(`📊 Database file: ${dbPath}`);
    console.log(`✅ Ready for multi-user access!`);
});
