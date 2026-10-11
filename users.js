// Accounts, passwords and sessions for the SDSI portal.
// One admin with the whole site, plus one account per division that enters its own data only.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// The nine divisions. `tables` is what the account may see and edit; '*' means everything.
// `scope` locks the account to one value of the table's scopeField (the hall, for a mess).
//
// CHANGE THE EMAIL ADDRESSES to the real ones before anyone uses this. People sign in with
// either the email or the short username, whichever they find easier to type. An address
// changed here is picked up the next time the server starts.
const DIVISIONS = [
  { username: 'admin', email: 'sdsi.admin@iitkgp.ac.in', name: 'Administrator', role: 'admin', scope: null, tables: '*' },

  { username: 'mess_azad', email: 'azad.mess@iitkgp.ac.in', name: 'Azad Hall mess', role: 'staff', scope: 'Azad Hall', tables: ['mess_waste'] },
  { username: 'mess_patel', email: 'patel.mess@iitkgp.ac.in', name: 'Patel Hall mess', role: 'staff', scope: 'Patel Hall', tables: ['mess_waste'] },
  { username: 'mess_nehru', email: 'nehru.mess@iitkgp.ac.in', name: 'Nehru Hall mess', role: 'staff', scope: 'Nehru Hall', tables: ['mess_waste'] },
  { username: 'mess_rk', email: 'rk.mess@iitkgp.ac.in', name: 'RK Hall mess', role: 'staff', scope: 'RK Hall', tables: ['mess_waste'] },

  { username: 'sanitation', email: 'sanitation@iitkgp.ac.in', name: 'Sanitation Section', role: 'staff', scope: null,
    tables: ['dry_waste', 'recyclables_sold', 'ewaste_disposal'] },
  { username: 'horticulture', email: 'horticulture@iitkgp.ac.in', name: 'Horticulture Section', role: 'staff', scope: null,
    tables: ['horticulture_waste'] },
  { username: 'processing', email: 'biogas@iitkgp.ac.in', name: 'Organic waste processing', role: 'staff', scope: null,
    tables: ['waste_processed'] },
  { username: 'stp', email: 'stp@iitkgp.ac.in', name: 'Sewage treatment', role: 'staff', scope: null,
    tables: ['stp_daily', 'stp_lab'] },
];

// A session dies after this long without use, so a browser left open on a shared
// machine doesn't stay signed in overnight. Every request pushes the deadline back.
const SESSION_IDLE_HOURS = 12;
// Five wrong passwords in a row locks that username for a few minutes.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;
const MIN_PASSWORD = 8;

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
  // Handed-out passwords must be replaced by one only that person knows.
  const cols = new Set(db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name));
  if (!cols.has('must_change')) db.exec(`ALTER TABLE users ADD COLUMN must_change INTEGER NOT NULL DEFAULT 0`);
  if (!cols.has('email')) db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`);
}

// Create any division that doesn't exist yet, with a fresh password, and write the
// list of new passwords to data/initial-passwords.txt for the admin to hand out.
function ensureDivisions(db, dataDir) {
  const existing = new Set(db.prepare('SELECT username FROM users').all().map(r => r.username));
  const created = [];
  const insert = db.prepare(`INSERT INTO users (username, email, name, role, scope, tables_json, pw_salt, pw_hash, must_change)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  for (const d of DIVISIONS) {
    if (existing.has(d.username)) continue;
    const password = makePassword();
    const { salt, hash } = hashPassword(password);
    insert.run(d.username, d.email || null, d.name, d.role, d.scope, JSON.stringify(d.tables), salt, hash);
    created.push({ ...d, password });
  }
  // An address edited in DIVISIONS takes effect on the next start, without touching anything else.
  const setEmail = db.prepare(`UPDATE users SET email = ? WHERE username = ? AND IFNULL(email, '') != IFNULL(?, '')`);
  DIVISIONS.forEach(d => setEmail.run(d.email || null, d.username, d.email || null));

  if (!created.length) return [];

  const file = path.join(dataDir, 'initial-passwords.txt');
  const lines = [
    'SDSI portal — first-time passwords',
    `Created ${new Date().toLocaleString('en-IN')}`,
    '',
    'Hand each person only their own line. The site makes them choose their own',
    'password the first time they sign in, so these stop working straight away.',
    'Delete this file once the passwords have been handed out.',
    '',
    'Either the email or the short name below works as the sign-in.',
    '',
    ...created.map(c => `${(c.email || '—').padEnd(28)} ${c.username.padEnd(14)} ${c.password.padEnd(22)} ${c.name}`),
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
    id: row.id, username: row.username, email: row.email || null, name: row.name, role: row.role,
    scope: row.scope || null, tables: JSON.parse(row.tables_json), active: !!row.active,
    mustChange: !!row.must_change,
  };
}

// People sign in with whichever they remember: the email or the short name.
const byName = (db, login) => db.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
  .get(String(login || '').trim().toLowerCase(), String(login || '').trim().toLowerCase());
const byId = (db, id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const list = db => db.prepare('SELECT * FROM users ORDER BY role DESC, username').all().map(shape);

// Failed sign-ins, per username, in memory. Cleared when the server restarts.
const attempts = new Map();

function lockedFor(username) {
  const a = attempts.get(username);
  if (!a || a.count < MAX_ATTEMPTS) return 0;
  const left = a.until - Date.now();
  if (left <= 0) { attempts.delete(username); return 0; }
  return Math.ceil(left / 60000);
}

function noteFailure(username) {
  const a = attempts.get(username) || { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) a.until = Date.now() + LOCKOUT_MINUTES * 60000;
  attempts.set(username, a);
}

// A hash of nothing, so an unknown username costs the same time as a wrong password
// and the response can't be used to find out which usernames exist.
const DUMMY = hashPassword('no-such-account');

function authenticate(db, username, password) {
  const name = String(username || '').trim().toLowerCase();
  const row = byName(db, name);
  if (!row || !row.active) { verifyPassword(password, DUMMY.salt, DUMMY.hash); return null; }
  if (!verifyPassword(password, row.pw_salt, row.pw_hash)) return null;
  return shape(row);
}

function setPassword(db, userId, password) {
  const { salt, hash } = hashPassword(password);
  db.prepare('UPDATE users SET pw_salt = ?, pw_hash = ?, must_change = 0 WHERE id = ?').run(salt, hash, userId);
  // Signing out of other devices after a password change.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// An admin reset hands out a temporary password, so that person must pick a new one.
function resetPassword(db, userId) {
  const password = makePassword();
  setPassword(db, userId, password);
  db.prepare('UPDATE users SET must_change = 1 WHERE id = ?').run(userId);
  return password;
}

// ---------- sessions ----------
const idleDeadline = () => new Date(Date.now() + SESSION_IDLE_HOURS * 3600e3).toISOString();

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = idleDeadline();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return { token, expires };
}

// Every request pushes the deadline back, so an idle browser signs itself out.
function userForToken(db, token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!s) return null;
  if (s.expires_at < new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const u = shape(byId(db, s.user_id));
  if (!u || !u.active) return null;
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(idleDeadline(), token);
  return u;
}

const endSession = (db, token) => { if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token); };
const purgeExpired = db => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

// ---------- permissions ----------
const isAdmin = user => !!user && user.role === 'admin';
const canUse = (user, tableId) => !!user && (user.tables === '*' || user.tables.includes(tableId));

module.exports = {
  DIVISIONS, SESSION_IDLE_HOURS, MAX_ATTEMPTS, LOCKOUT_MINUTES, MIN_PASSWORD,
  init, ensureDivisions, list, byName, byId, shape,
  authenticate, setPassword, resetPassword, makePassword, hashPassword, verifyPassword,
  lockedFor, noteFailure,
  createSession, userForToken, endSession, purgeExpired,
  isAdmin, canUse,
};
