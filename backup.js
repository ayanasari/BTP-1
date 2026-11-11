// Makes a dated copy of the database and keeps the most recent ones.
//
//   node backup.js            make a backup, keep the last 30
//   node backup.js 90         keep the last 90 instead
//
// Run it nightly from cron (see DEPLOY.md). Backups land in a `backups` folder beside
// the database.
//
// This is deliberately a plain file copy rather than anything clever. SQLite keeps the
// whole database in one file, so a copy of that file IS the backup: move it to another
// machine and it opens. The copy is taken through SQLite's own backup path, so it is
// safe to run while the site is in use — a copy made with `cp` while someone is halfway
// through saving an entry can be torn.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_FILE, BACKUP_DIR } = require('./paths.js');

const KEEP = Number(process.argv[2]) || 30;

if (!fs.existsSync(DB_FILE)) {
  console.error(`\n  No database at ${DB_FILE}. Nothing to back up.\n`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

// sdsi-2026-11-12-0340-15.db — local time, so the name matches the day you remember,
// and down to the second so two runs cannot collide. Sorts correctly as text, which is
// what the pruning below relies on.
const d = new Date();
const p2 = n => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  + `-${p2(d.getHours())}${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
// Two runs inside the same second would otherwise overwrite each other without saying so.
let target = path.join(BACKUP_DIR, `sdsi-${stamp}.db`);
for (let n = 2; fs.existsSync(target); n++) target = path.join(BACKUP_DIR, `sdsi-${stamp}-${n}.db`);

const db = new DatabaseSync(DB_FILE, { readOnly: true });
try {
  // VACUUM INTO writes a consistent copy even while the site is running.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} catch (err) {
  // Older builds, or a database already being vacuumed, fall back to a plain copy.
  console.error(`  VACUUM INTO failed (${err.message}); falling back to a file copy.`);
  fs.copyFileSync(DB_FILE, target);
} finally {
  db.close();
}

const size = (fs.statSync(target).size / 1024).toFixed(0);
console.log(`\n  Backed up to ${target}  (${size} KB)`);

// Keep the newest KEEP files, delete the rest. Sorted by when the file was actually
// written rather than by its name, so an unusual name can never cost you a good backup.
const old = fs.readdirSync(BACKUP_DIR)
  .filter(f => /^sdsi-.*\.db$/.test(f))
  .map(f => ({ f, at: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.at - a.at)
  .slice(KEEP);
old.forEach(({ f }) => fs.unlinkSync(path.join(BACKUP_DIR, f)));

const kept = fs.readdirSync(BACKUP_DIR).filter(f => /^sdsi-.*\.db$/.test(f)).length;
console.log(`  ${kept} backup(s) kept${old.length ? `, ${old.length} older one(s) removed` : ''}.`);
console.log(`\n  To restore: stop the site, copy a backup over ${DB_FILE}, start it again.\n`);
