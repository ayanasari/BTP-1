// SDSI data-entry portal: static pages + JSON API backed by the built-in node:sqlite.
// Run with `node server.js` (Node 22.13+), then open http://localhost:4000
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const SDSI = require('./public/schema.js');

const PORT = Number(process.env.PORT) || 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
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

// Load the figures already published on the SDSI pages, once.
if (!db.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).get()) {
  require('./seed.js')(db);
  db.prepare(`INSERT INTO meta (key, value) VALUES ('seeded', ?)`).run(new Date().toISOString());
}

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
  return { id: r.id, table: r.table_id, period: r.period, data: JSON.parse(r.data), created_at: r.created_at, updated_at: r.updated_at };
}

// Validate a submission against the table's columns and return the cleaned values.
function clean(tableId, period, data, selfId) {
  const table = SDSI.tables[tableId];
  if (!table) throw new HttpError(400, `Unknown table "${tableId}"`);
  if (!data || typeof data !== 'object') throw new HttpError(400, 'Missing data');

  let cleanPeriod = null;
  if (table.period) {
    const [re, desc] = PERIOD_PATTERNS[table.period];
    cleanPeriod = String(period || '').trim();
    if (!re.test(cleanPeriod)) throw new HttpError(400, `${table.periodLabel || 'Period'} must be ${desc}`);
  }

  const out = {};
  for (const f of table.fields) {
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

  // Prevent two entries for the same month / same vehicle type in a year, etc.
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

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleApi(req, res, url) {
  const idMatch = url.pathname.match(/^\/api\/entries\/(\d+)$/);

  if (url.pathname === '/api/entries' && req.method === 'GET') {
    const ids = (url.searchParams.get('tables') || '').split(',').filter(Boolean);
    const result = {};
    const stmt = db.prepare('SELECT * FROM entries WHERE table_id = ? ORDER BY period DESC, id ASC');
    for (const id of ids) {
      if (!SDSI.tables[id]) throw new HttpError(400, `Unknown table "${id}"`);
      result[id] = stmt.all(id).map(rowOut);
    }
    return sendJson(res, 200, result);
  }

  if (url.pathname === '/api/entries' && req.method === 'POST') {
    const body = await readBody(req);
    const { period, data } = clean(body.table, body.period, body.data);
    const info = db.prepare('INSERT INTO entries (table_id, period, data) VALUES (?, ?, ?)').run(body.table, period, JSON.stringify(data));
    return sendJson(res, 201, rowOut(db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid)));
  }

  if (idMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = Number(idMatch[1]);
    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
    if (!existing) throw new HttpError(404, 'Entry not found');
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM entries WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    }
    const body = await readBody(req);
    const { period, data } = clean(existing.table_id, body.period, body.data, id);
    db.prepare(`UPDATE entries SET period = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(period, JSON.stringify(data), id);
    return sendJson(res, 200, rowOut(db.prepare('SELECT * FROM entries WHERE id = ?').get(id)));
  }

  throw new HttpError(404, 'Not found');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-cache', // always revalidate so updated pages are picked up
    });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    serveStatic(res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    sendJson(res, status, { error: status === 500 ? 'Server error' : err.message });
  }
}).listen(PORT, () => console.log(`SDSI portal running at http://localhost:${PORT}`));
