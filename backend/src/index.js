const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Data paths
const shiftsFilePath = path.join(__dirname, '../data/shifts.json');
const usersFilePath = path.join(__dirname, '../data/users.json');
const dataDir = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Initialize shifts file if empty
if (!fs.existsSync(shiftsFilePath)) {
  const sampleShifts = [
    { id: 1, date: '2026-06-10', start_time: '10:00:00', end_time: '13:00:00', role: 'Mutual Aid Delivery', capacity: 4, location: 'Colfax & Peoria', notes: '', created_at: new Date().toISOString() },
    { id: 2, date: '2026-06-10', start_time: '14:00:00', end_time: '17:00:00', role: 'Zine Folding Party', capacity: 10, location: 'Library', notes: '', created_at: new Date().toISOString() }
  ];
  fs.writeFileSync(shiftsFilePath, JSON.stringify(sampleShifts, null, 2));
  console.log('Sample shifts created');
}

// Initialize users file if empty (create a default admin)
if (!fs.existsSync(usersFilePath)) {
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  const defaultUsers = [
    { id: 1, email: 'admin@houseparty.org', password: defaultPassword, role: 'admin', created_at: new Date().toISOString() }
  ];
  fs.writeFileSync(usersFilePath, JSON.stringify(defaultUsers, null, 2));
  console.log('Default admin user created (email: admin@houseparty.org, password: admin123)');
}

// Helper functions
function readShifts() { return JSON.parse(fs.readFileSync(shiftsFilePath, 'utf8')); }
function writeShifts(shifts) { fs.writeFileSync(shiftsFilePath, JSON.stringify(shifts, null, 2)); }
function readUsers() { return JSON.parse(fs.readFileSync(usersFilePath, 'utf8')); }
function writeUsers(users) { fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2)); }

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Registration endpoint
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const users = readUsers();
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'User already exists' });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    id: users.length + 1,
    email,
    password: hashedPassword,
    role: role || 'volunteer',
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  writeUsers(users);
  res.status(201).json({ message: 'User created successfully' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);  // temporary log

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = readUsers();
    console.log('Users loaded:', users.length); // temporary log

    const user = users.find(u => u.email === email);
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected shifts endpoints
app.get('/api/shifts', authenticateToken, (req, res) => {
  try {
    const shifts = readShifts();
    res.json({ shifts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read shifts' });
  }
});

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'House Party backend with authentication' });
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
  console.log(`Data file: ${shiftsFilePath}`);
  console.log(`Users file: ${usersFilePath}`);
});
