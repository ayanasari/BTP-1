// Accounts, passwords and sessions for the SDSI portal.
// One admin with the whole site, plus one account per division that enters its own data only.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// The nine divisions. `tables` is what the account may see and edit; '*' means everything.
// `scope` locks the account to one value of the table's scopeField (the hall, for a mess).
const DIVISIONS = [
  { username: 'admin', name: 'Administrator', role: 'admin', scope: null, tables: '*' },

  { username: 'mess_azad', name: 'Azad Hall mess', role: 'staff', scope: 'Azad Hall', tables: ['mess_waste'] },
  { username: 'mess_patel', name: 'Patel Hall mess', role: 'staff', scope: 'Patel Hall', tables: ['mess_waste'] },
  { username: 'mess_nehru', name: 'Nehru Hall mess', role: 'staff', scope: 'Nehru Hall', tables: ['mess_waste'] },
  { username: 'mess_rk', name: 'RK Hall mess', role: 'staff', scope: 'RK Hall', tables: ['mess_waste'] },

  { username: 'sanitation', name: 'Sanitation Section', role: 'staff', scope: null,
    tables: ['dry_waste', 'recyclables_sold', 'ewaste_disposal'] },
  { username: 'horticulture', name: 'Horticulture Section', role: 'staff', scope: null,
    tables: ['horticulture_waste'] },
  { username: 'processing', name: 'Organic waste processing', role: 'staff', scope: null,
    tables: ['waste_processed'] },
  { username: 'stp', name: 'Sewage treatment', role: 'staff', scope: null,
    tables: ['stp_daily', 'stp_lab'] },
];

const SESSION_DAYS = 30;

// ---------- passwords ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

// Readable but not guessable: two words and four digits, e.g. "patel-river-8431".
const WORDS = ['river', 'banyan', 'mango', 'tiger', 'delta', 'lotus', 'cedar', 'amber',
  'fern', 'ridge', 'coral', 'maple', 'stone', 'willow', 'harbour', 'meadow'];
function makePassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  let a = pick(), b = pick();
  while (b === a) b = pick();
  return `${a}-${b}-${crypto.randomInt(1000, 10000)}`;
}

// ---------- schema ----------
function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      scope TEXT,
      tables_json TEXT NOT NULL,
      pw_salt TEXT NOT NULL,
      pw_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);
}

// Create any division that doesn't exist yet, with a fresh password, and write the
// list of new passwords to data/initial-passwords.txt for the admin to hand out.
function ensureDivisions(db, dataDir) {
  const existing = new Set(db.prepare('SELECT username FROM users').all().map(r => r.username));
  const created = [];
  const insert = db.prepare(`INSERT INTO users (username, name, role, scope, tables_json, pw_salt, pw_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const d of DIVISIONS) {
    if (existing.has(d.username)) continue;
    const password = makePassword();
    const { salt, hash } = hashPassword(password);
    insert.run(d.username, d.name, d.role, d.scope, JSON.stringify(d.tables), salt, hash);
    created.push({ ...d, password });
  }
  if (!created.length) return [];

  const file = path.join(dataDir, 'initial-passwords.txt');
  const lines = [
    'SDSI portal — first-time passwords',
    `Created ${new Date().toLocaleString('en-IN')}`,
    '',
    'Hand each person only their own line, then change it from the Accounts page.',
    'Delete this file once the passwords have been handed out.',
    '',
    ...created.map(c => `${c.username.padEnd(14)} ${c.password.padEnd(22)} ${c.name}`),
    '',
  ].join('\n');
  fs.writeFileSync(file, lines, { mode: 0o600 });
  console.log(`\n  ${created.length} account(s) created. Passwords written to ${file}\n`);
  return created;
}

// ---------- lookups ----------
function shape(row) {
  if (!row) return null;
  return {
    id: row.id, username: row.username, name: row.name, role: row.role,
    scope: row.scope || null, tables: JSON.parse(row.tables_json), active: !!row.active,
  };
}

const byName = (db, username) => db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim().toLowerCase());
const byId = (db, id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const list = db => db.prepare('SELECT * FROM users ORDER BY role DESC, username').all().map(shape);

function authenticate(db, username, password) {
  const row = byName(db, username);
  if (!row || !row.active) return null;
  if (!verifyPassword(password, row.pw_salt, row.pw_hash)) return null;
  return shape(row);
}

function setPassword(db, userId, password) {
  const { salt, hash } = hashPassword(password);
  db.prepare('UPDATE users SET pw_salt = ?, pw_hash = ? WHERE id = ?').run(salt, hash, userId);
  // Signing out of other devices after a password change.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ---------- sessions ----------
function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return { token, expires };
}

function userForToken(db, token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!s) return null;
  if (s.expires_at < new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const u = shape(byId(db, s.user_id));
  return u && u.active ? u : null;
}

const endSession = (db, token) => { if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token); };
const purgeExpired = db => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

// ---------- permissions ----------
const isAdmin = user => !!user && user.role === 'admin';
const canUse = (user, tableId) => !!user && (user.tables === '*' || user.tables.includes(tableId));

module.exports = {
  DIVISIONS, SESSION_DAYS,
  init, ensureDivisions, list, byName, byId, shape,
  authenticate, setPassword, makePassword, hashPassword, verifyPassword,
  createSession, userForToken, endSession, purgeExpired,
  isAdmin, canUse,
};
