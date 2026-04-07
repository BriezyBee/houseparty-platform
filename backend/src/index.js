const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dataFilePath = path.join(__dirname, '../data/shifts.json');
const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dataFilePath)) {
  const sampleShifts = [
    {
      id: 1,
      date: '2026-06-10',
      start_time: '10:00:00',
      end_time: '13:00:00',
      role: 'Mutual Aid Delivery',
      capacity: 4,
      location: 'Colfax & Peoria',
      notes: '',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      date: '2026-06-10',
      start_time: '14:00:00',
      end_time: '17:00:00',
      role: 'Zine Folding Party',
      capacity: 10,
      location: 'Library',
      notes: '',
      created_at: new Date().toISOString()
    }
  ];
  fs.writeFileSync(dataFilePath, JSON.stringify(sampleShifts, null, 2));
  console.log('Sample shifts created');
}

function readShifts() {
  const data = fs.readFileSync(dataFilePath, 'utf8');
  return JSON.parse(data);
}

function writeShifts(shifts) {
  fs.writeFileSync(dataFilePath, JSON.stringify(shifts, null, 2));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'House Party backend running with JSON storage!' });
});

app.get('/api/shifts', (req, res) => {
  try {
    const shifts = readShifts();
    res.json({ shifts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to read shifts' });
  }
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
  console.log(`Data file: ${dataFilePath}`);
});