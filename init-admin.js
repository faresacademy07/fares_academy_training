const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.json');

// Read or create database
let db;
if (fs.existsSync(dbPath)) {
    try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        db = { users: [], data: {} };
    }
} else {
    db = { users: [], data: {} };
}

// Check if admin already exists
const adminExists = db.users.find(u => u.email === 'faresacademy07@hotmail.com');

if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    const adminUser = {
        id: Date.now().toString(),
        email: 'faresacademy07@hotmail.com',
        password: hashedPassword,
        name: 'faresacademy',
        role: 'admin',
        createdAt: new Date().toISOString()
    };
    
    db.users.push(adminUser);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('✓ Admin account created: faresacademy07@hotmail.com');
} else {
    console.log('✓ Admin account already exists');
}
