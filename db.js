const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Read database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { users: [], messages: [], likes: [], matches: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { users: [], messages: [], likes: [], matches: [] };
  }
}

// Write database
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Generate ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

module.exports = { readDB, writeDB, generateId };