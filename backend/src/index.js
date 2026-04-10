import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabaseClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));  // serves login.html, index.html

// ---------- Helper Middleware ----------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ---------- Register ----------
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Check if user already exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (fetchError) {
    console.error('Supabase error:', fetchError);
    return res.status(500).json({ error: 'Database error' });
  }
  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    email,
    password: hashedPassword,
    role: role || 'volunteer',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('users').insert([newUser]).select().single();

  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }

  res.status(201).json({
    message: 'User created',
    user: { id: data.id, email: data.email, role: data.role },
  });
});

// ---------- Login ----------
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// ---------- Get Shifts (Protected) ----------
app.get('/api/shifts', authenticateToken, async (req, res) => {
  try {
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    res.json({ shifts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// ---------- Health Check (Public) ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'House Party backend with Supabase' });
});

// ---------- Start Server ----------
app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
  console.log(`Serving static files from ${path.join(__dirname, '../public')}`);
});
