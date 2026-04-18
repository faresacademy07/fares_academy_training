const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        createdAt: new Date().toISOString()
    };

    db.users.push(user);
    writeDatabase(db);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
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
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
});

// GET /api/auth/me - Get current user
app.get('/api/auth/me', verifyToken, (req, res) => {
    const db = readDatabase();
    const user = db.users.find(u => u.id === req.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
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
    const subscribers = db.data[req.userId]?.subscribers || [];
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

// POST /api/data/programs - Add program
app.post('/api/data/programs', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        db.data[req.userId] = { subscribers: [], programs: [], measurements: [] };
    }
    
    const program = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    
    db.data[req.userId].programs.push(program);
    writeDatabase(db);
    res.json({ success: true, program });
});

// GET /api/data/programs - Get all programs
app.get('/api/data/programs', verifyToken, (req, res) => {
    const db = readDatabase();
    const programs = db.data[req.userId]?.programs || [];
    res.json(programs);
});

// PUT /api/data/programs/:id - Update program
app.put('/api/data/programs/:id', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        return res.status(404).json({ success: false, error: 'No data found' });
    }
    
    const index = db.data[req.userId].programs.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
        db.data[req.userId].programs[index] = { ...db.data[req.userId].programs[index], ...req.body };
        writeDatabase(db);
        res.json({ success: true, program: db.data[req.userId].programs[index] });
    } else {
        res.status(404).json({ success: false, error: 'Program not found' });
    }
});

// DELETE /api/data/programs/:id - Delete program
app.delete('/api/data/programs/:id', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        return res.status(404).json({ success: false, error: 'No data found' });
    }
    
    db.data[req.userId].programs = db.data[req.userId].programs.filter(p => p.id !== req.params.id);
    writeDatabase(db);
    res.json({ success: true });
});

// POST /api/data/measurements - Add measurement
app.post('/api/data/measurements', verifyToken, (req, res) => {
    const db = readDatabase();
    if (!db.data[req.userId]) {
        db.data[req.userId] = { subscribers: [], programs: [], measurements: [] };
    }
    
    const measurement = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    
    db.data[req.userId].measurements.push(measurement);
    writeDatabase(db);
    res.json({ success: true, measurement });
});

// GET /api/data/measurements - Get all measurements
app.get('/api/data/measurements', verifyToken, (req, res) => {
    const db = readDatabase();
    const measurements = db.data[req.userId]?.measurements || [];
    res.json(measurements);
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
