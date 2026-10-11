// SDSI data-entry portal: static pages + JSON API backed by the built-in node:sqlite.
// Run with `node server.js` (Node 22.13+), then open http://localhost:4000
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const SDSI = require('./public/schema.js');
const users = require('./users.js');

const PORT = Number(process.env.PORT) || 4000;
// All interfaces by default, so a campus machine serves everyone; HOST=127.0.0.1 to
// keep it to the one computer.
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const COOKIE = 'sdsi_session';
const SCHEMA_VERSION = '2';
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'sdsi.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id TEXT NOT NULL,
    period TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_entries_table ON entries(table_id);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);

// Columns added after the first version of the portal.
const entryCols = new Set(db.prepare(`PRAGMA table_info(entries)`).all().map(c => c.name));
if (!entryCols.has('created_by')) db.exec(`ALTER TABLE entries ADD COLUMN created_by TEXT`);

users.init(db);
users.purgeExpired(db);

const metaGet = key => db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value;
const metaSet = (key, value) => db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);

// Version 1 covered the whole SDSI site. Version 2 covers waste and sewage only, so rows
// belonging to the retired tables are put aside rather than deleted.
if (metaGet('schema_version') !== SCHEMA_VERSION) {
  db.exec(`CREATE TABLE IF NOT EXISTS archived_entries (
    id INTEGER, table_id TEXT, period TEXT, data TEXT, created_at TEXT, updated_at TEXT,
    archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const known = Object.keys(SDSI.tables);
  const placeholders = known.map(() => '?').join(',');
  const stale = db.prepare(`SELECT id, table_id, period, data, created_at, updated_at
    FROM entries WHERE table_id NOT IN (${placeholders})`).all(...known);
  if (stale.length) {
    const move = db.prepare(`INSERT INTO archived_entries (id, table_id, period, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    stale.forEach(r => move.run(r.id, r.table_id, r.period, r.data, r.created_at, r.updated_at));
    db.prepare(`DELETE FROM entries WHERE table_id NOT IN (${placeholders})`).run(...known);
    console.log(`  Moved ${stale.length} entries from retired tables into archived_entries.`);
  }
  metaSet('schema_version', SCHEMA_VERSION);
}

// Load the figures already published on the SDSI pages, once.
if (!metaGet('seeded')) {
  require('./seed.js')(db);
  metaSet('seeded', new Date().toISOString());
}

users.ensureDivisions(db, DATA_DIR);

const PERIOD_PATTERNS = {
  month: [/^\d{4}-(0[1-9]|1[0-2])$/, 'a month'],
  fy: [/^\d{4}-\d{2}$/, 'a financial year like 2024-25'],
  year: [/^\d{4}$/, 'a year like 2025'],
  date: [/^\d{4}-\d{2}-\d{2}$/, 'a date'],
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function rowOut(r) {
  return {
    id: r.id, table: r.table_id, period: r.period, data: JSON.parse(r.data),
    created_at: r.created_at, updated_at: r.updated_at,
    created_by: r.created_by || null,
  };
}

// ---------- permissions ----------
function requireUser(user) {
  if (!user) throw new HttpError(401, 'Please sign in again.');
  return user;
}

function requireTable(user, tableId) {
  const table = SDSI.tables[tableId];
  if (!table) throw new HttpError(400, `Unknown table "${tableId}"`);
  if (!users.canUse(user, tableId)) throw new HttpError(403, 'This section is not part of your data entry.');
  return table;
}

// A scoped account only ever sees and writes its own hall / plant / facility.
function scopeOf(user, table) {
  if (users.isAdmin(user) || !table.scopeField || !user.scope) return null;
  return user.scope;
}

function visible(user, table, row) {
  const scope = scopeOf(user, table);
  return !scope || row.data[table.scopeField] === scope;
}

// Validate a submission against the table's columns and return the cleaned values.
function clean(user, tableId, period, data, selfId) {
  const table = requireTable(user, tableId);
  if (!data || typeof data !== 'object') throw new HttpError(400, 'Missing data');

  let cleanPeriod = null;
  if (table.period) {
    const [re, desc] = PERIOD_PATTERNS[table.period];
    cleanPeriod = String(period || '').trim();
    if (!re.test(cleanPeriod)) throw new HttpError(400, `${table.periodLabel || 'Period'} must be ${desc}`);
    if (table.period === 'date' && cleanPeriod > new Date().toISOString().slice(0, 10)) {
      throw new HttpError(400, `${table.periodLabel || 'Date'} cannot be in the future.`);
    }
  }

  // The hall (or plant, or facility) always comes from the account, never from the form.
  const scope = scopeOf(user, table);

  const out = {};
  for (const f of table.fields) {
    if (scope && f.key === table.scopeField) { out[f.key] = scope; continue; }
    let v = data[f.key];
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v == null) {
      if (f.required) throw new HttpError(400, `"${f.label}" is required`);
      out[f.key] = null;
      continue;
    }
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new HttpError(400, `"${f.label}" must be a number`);
      if (n < 0) throw new HttpError(400, `"${f.label}" cannot be negative`);
      v = n;
    } else if (f.type === 'select') {
      if (!f.options.includes(v)) throw new HttpError(400, `"${f.label}" must be one of: ${f.options.join(', ')}`);
    } else if (f.type === 'date') {
      if (!PERIOD_PATTERNS.date[0].test(v)) throw new HttpError(400, `"${f.label}" must be a date`);
    } else {
      v = String(v).slice(0, 5000);
    }
    out[f.key] = v;
  }

  // Prevent two entries for the same day and hall, the same day and plant, and so on.
  if (table.unique) {
    const keyOf = (p, d) => table.unique.map(k => (k === 'period' ? p : d[k]) ?? '').join('|');
    const mine = keyOf(cleanPeriod, out);
    const others = db.prepare('SELECT id, period, data FROM entries WHERE table_id = ? AND id != ?').all(tableId, selfId || 0);
    if (others.some(o => keyOf(o.period, JSON.parse(o.data)) === mine)) {
      const what = table.unique.map(k => (k === 'period' ? cleanPeriod : out[k])).join(', ');
      throw new HttpError(409, `An entry for ${what} already exists. Edit that entry instead.`);
    }
  }
  return { period: cleanPeriod, data: out };
}

// ---------- request plumbing ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { reject(new HttpError(413, 'Request too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj, headers = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(obj));
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// No Max-Age: the cookie dies with the browser, and the server expires the session
// itself after SESSION_IDLE_HOURS without use. Secure is added behind HTTPS.
const setCookie = token =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${process.env.HTTPS === '1' ? '; Secure' : ''}`;

// ---------- API ----------
async function handleApi(req, res, url, user, token) {
  const p = url.pathname;

  if (p === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const name = String(body.username || '').trim().toLowerCase();
    const locked = users.lockedFor(name);
    if (locked) {
      throw new HttpError(429, `Too many wrong passwords. Try again in ${locked} minute${locked === 1 ? '' : 's'}.`);
    }
    const found = users.authenticate(db, name, body.password);
    if (!found) {
      users.noteFailure(name);
      throw new HttpError(401, 'Wrong username or password.');
    }
    const session = users.createSession(db, found.id);
    return sendJson(res, 200, { user: publicUser(found) }, { 'Set-Cookie': setCookie(session.token) });
  }

  if (p === '/api/logout' && req.method === 'POST') {
    users.endSession(db, token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  }

  if (p === '/api/me' && req.method === 'GET') {
    return sendJson(res, 200, { user: user ? publicUser(user) : null });
  }

  requireUser(user);

  if (p === '/api/password' && req.method === 'POST') {
    const body = await readBody(req);
    // An admin may reset anyone; everyone else may only change their own.
    const targetId = users.isAdmin(user) && body.userId ? Number(body.userId) : user.id;
    if (targetId === user.id) {
      if (!users.authenticate(db, user.username, body.current)) throw new HttpError(403, 'Your current password is not right.');
    }
    const next = String(body.password || '');
    if (next.length < users.MIN_PASSWORD) {
      throw new HttpError(400, `A password must be at least ${users.MIN_PASSWORD} characters.`);
    }
    if (next === body.current) throw new HttpError(400, 'Choose a password different from the current one.');
    if (!users.byId(db, targetId)) throw new HttpError(404, 'No such account.');
    users.setPassword(db, targetId, next);
    if (targetId === user.id) {
      const session = users.createSession(db, user.id); // keep this device signed in
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': setCookie(session.token) });
    }
    return sendJson(res, 200, { ok: true });
  }

  // Until a handed-out password has been replaced, the account can do nothing else.
  if (user.mustChange) {
    throw new HttpError(403, 'Choose your own password before entering any data.');
  }

  if (p === '/api/users') {
    if (!users.isAdmin(user)) throw new HttpError(403, 'Administrators only.');
    if (req.method === 'GET') return sendJson(res, 200, { users: users.list(db) });
    if (req.method === 'POST') {
      const body = await readBody(req);
      const target = users.byId(db, Number(body.userId));
      if (!target) throw new HttpError(404, 'No such account.');
      if (body.action === 'reset') {
        return sendJson(res, 200, { password: users.resetPassword(db, target.id) });
      }
      if (body.action === 'active') {
        if (target.username === 'admin') throw new HttpError(400, 'The administrator account cannot be switched off.');
        db.prepare('UPDATE users SET active = ? WHERE id = ?').run(body.active ? 1 : 0, target.id);
        if (!body.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
        return sendJson(res, 200, { ok: true });
      }
      throw new HttpError(400, 'Unknown action');
    }
  }

  // Everything anyone has entered, newest first, in one list for the admin.
  if (p === '/api/recent' && req.method === 'GET') {
    if (!users.isAdmin(user)) throw new HttpError(403, 'Administrators only.');
    const known = Object.keys(SDSI.tables);
    const marks = known.map(() => '?').join(',');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
    // The figures loaded from the SDSI pages on first start are not anyone's entry,
    // so they stay out of a list that answers "who has been entering what".
    const rows = db.prepare(`SELECT * FROM entries WHERE table_id IN (${marks})
      AND IFNULL(created_by, '') != 'published'
      ORDER BY datetime(created_at) DESC, id DESC LIMIT ?`).all(...known, limit);
    return sendJson(res, 200, { entries: rows.map(rowOut) });
  }

  const idMatch = p.match(/^\/api\/entries\/(\d+)$/);

  if (p === '/api/entries' && req.method === 'GET') {
    const ids = (url.searchParams.get('tables') || '').split(',').filter(Boolean);
    const result = {};
    const stmt = db.prepare('SELECT * FROM entries WHERE table_id = ? ORDER BY period DESC, id ASC');
    for (const id of ids) {
      const table = requireTable(user, id);
      result[id] = stmt.all(id).map(rowOut).filter(r => visible(user, table, r));
    }
    return sendJson(res, 200, result);
  }

  if (p === '/api/entries' && req.method === 'POST') {
    const body = await readBody(req);
    const { period, data } = clean(user, body.table, body.period, body.data);
    const info = db.prepare(`INSERT INTO entries (table_id, period, data, created_by)
      VALUES (?, ?, ?, ?)`).run(body.table, period, JSON.stringify(data), user.username);
    return sendJson(res, 201, rowOut(db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid)));
  }

  if (idMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = Number(idMatch[1]);
    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
    if (!existing) throw new HttpError(404, 'Entry not found');
    const table = requireTable(user, existing.table_id);
    if (!visible(user, table, rowOut(existing))) throw new HttpError(403, 'That entry belongs to another section.');

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM entries WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    }
    const body = await readBody(req);
    const { period, data } = clean(user, existing.table_id, body.period, body.data, id);
    db.prepare(`UPDATE entries SET period = ?, data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`).run(period, JSON.stringify(data), id);
    return sendJson(res, 200, rowOut(db.prepare('SELECT * FROM entries WHERE id = ?').get(id)));
  }

  throw new HttpError(404, 'Not found');
}

// What the browser is told about the signed-in account.
function publicUser(user) {
  const allowed = user.tables === '*' ? Object.keys(SDSI.tables) : user.tables;
  return {
    username: user.username, email: user.email, name: user.name, role: user.role,
    scope: user.scope, tables: user.mustChange ? [] : allowed,
    isAdmin: user.role === 'admin', mustChange: !!user.mustChange,
    minPassword: users.MIN_PASSWORD,
  };
}

// ---------- static files ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function serveStatic(res, pathname) {
  let file;
  try {
    let rel = path.posix.normalize(decodeURIComponent(pathname));
    if (rel.endsWith('/')) rel += 'index.html';
    file = path.resolve(PUBLIC_DIR, '.' + rel);
  } catch { res.writeHead(400); return res.end(); }
  // path.resolve collapses "..", so anything outside public/ is refused. The separator
  // matters: without it a sibling folder named "publicXYZ" would pass a prefix test.
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8',
      // Nothing is kept on disk by the browser, so a signed-out machine has no pages
      // left in its cache or its back button.
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(buf);
  });
}

// Files anyone may fetch before signing in: the sign-in page and what it needs to draw.
const OPEN_PAGES = new Set(['/login.html', '/styles.css', '/favicon.ico']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  // Everything the site runs ships with it; nothing is fetched from the internet.
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "connect-src 'self'", "form-action 'self'",
    "base-uri 'none'", "frame-ancestors 'none'", "object-src 'none'",
  ].join('; '),
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const token = cookies(req)[COOKIE];
  const user = users.userForToken(db, token);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url, user, token);
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    // Signed out, every address lands on the sign-in page; signed in, that page is
    // pointless, so it bounces to the site.
    if (!user && !OPEN_PAGES.has(url.pathname)) {
      res.writeHead(302, { ...SECURITY_HEADERS, Location: '/login.html', 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (user && url.pathname === '/login.html') {
      res.writeHead(302, { ...SECURITY_HEADERS, Location: '/', 'Cache-Control': 'no-store' });
      return res.end();
    }
    serveStatic(res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    sendJson(res, status, { error: status === 500 ? 'Server error' : err.message });
  }
}).listen(PORT, HOST, () => {
  console.log(`\n  SDSI portal running.`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    const nets = Object.values(os.networkInterfaces()).flat()
      .filter(n => n && n.family === 'IPv4' && !n.internal);
    nets.forEach(n => console.log(`  On the network:    http://${n.address}:${PORT}`));
    console.log(`\n  Anyone on this network can reach the sign-in page. To keep it to this`);
    console.log(`  computer only, start it with:  HOST=127.0.0.1 node server.js\n`);
  } else {
    console.log(`  Reachable from this computer only.\n`);
  }
});
