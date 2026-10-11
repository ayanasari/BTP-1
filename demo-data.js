// Fills the site with about a month of plausible daily entries, so a demonstration has
// something to show: monthly totals, trends and a PDF report with real rows in it.
//
//   node demo-data.js            add 30 days ending today
//   node demo-data.js 60         add 60 days instead
//   node demo-data.js --clear    remove everything this script added
//
// Every row it writes is marked as entered by "demo", so --clear can find them again and
// nothing a real person typed is ever touched.
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'sdsi.db');
if (!fs.existsSync(DB_FILE)) {
  console.error('\n  No database yet. Start the site once (node server.js), then run this again.\n');
  process.exit(1);
}

const db = new DatabaseSync(DB_FILE);
const MARK = 'demo';

if (process.argv.includes('--clear')) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM entries WHERE created_by = ?').get(MARK).n;
  db.prepare('DELETE FROM entries WHERE created_by = ?').run(MARK);
  console.log(`\n  Removed ${n} demonstration entries. Anything entered by a real account is untouched.\n`);
  process.exit(0);
}

const DAYS = Number(process.argv[2]) > 0 ? Math.min(Number(process.argv[2]), 365) : 30;

// Repeatable pseudo-random, so re-running gives the same shape of data.
let seed = 20261011;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const near = (base, spread) => Math.max(0, Math.round(base + (rnd() - 0.5) * spread));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayBack = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const insert = db.prepare(`INSERT INTO entries (table_id, period, data, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)`);
const exists = db.prepare('SELECT 1 FROM entries WHERE table_id = ? AND period = ? AND data LIKE ?');

let added = 0, skipped = 0;
function add(table, period, data) {
  const scopeVal = data.hall || data.plant || data.facility || data.material;
  const like = scopeVal ? `%${scopeVal}%` : '%';
  if (exists.get(table, period, like)) { skipped++; return; }
  // Logged during the working day it belongs to, so the admin's list reads like real
  // use rather than everything arriving at once.
  const hh = String(9 + Math.floor(rnd() * 9)).padStart(2, '0');
  const mm = String(Math.floor(rnd() * 60)).padStart(2, '0');
  const at = `${period} ${hh}:${mm}:00`;
  insert.run(table, period, JSON.stringify(data), MARK, at, at);
  added++;
}

const HALLS = [['Azad Hall', 170], ['Patel Hall', 145], ['Nehru Hall', 195], ['RK Hall', 125]];

// Stops at yesterday: today is left empty so there is something to enter live.
for (let d = DAYS; d >= 1; d--) {
  const day = dayBack(d);
  const sunday = new Date(day).getDay() === 0;

  HALLS.forEach(([hall, base]) => {
    if (rnd() < 0.05) return;        // the occasional day nobody weighed
    // Halls are quieter at the weekend.
    add('mess_waste', day, { hall, food_kg: near(sunday ? base * 0.75 : base, 55) });
  });

  add('dry_waste', day, { dry_kg: near(sunday ? 620 : 840, 240) });

  add('horticulture_waste', day, {
    leaves_kg: near(215, 110),
    other_kg: near(95, 65),
    composted_kg: near(150, 70),
  });

  add('waste_processed', day, {
    facility: 'Biogas plant',
    input_kg: near(560, 150),
    output_kg: near(82, 35),
  });

  add('stp_daily', day, {
    plant: 'STP-1',
    flow_mld: +(1.08 + (rnd() - 0.5) * 0.28).toFixed(2),
    ph_in: +(7.3 + (rnd() - 0.5) * 0.7).toFixed(1),
    ph_out: +(7.1 + (rnd() - 0.5) * 0.5).toFixed(1),
  });

  if (d % 5 === 0) {
    add('stp_daily', day, {
      plant: 'STP at SPMS Hospital',
      flow_mld: +(0.34 + (rnd() - 0.5) * 0.08).toFixed(2),
      ph_in: +(7.2 + (rnd() - 0.5) * 0.4).toFixed(1),
      ph_out: +(7.0 + (rnd() - 0.5) * 0.3).toFixed(1),
    });
  }

  // Scrap leaves in lots, not daily.
  if (d % 7 === 2) add('recyclables_sold', day, { material: 'Cartons', qty_kg: near(400, 160), vendor: 'KGP Scrap Traders' });
  if (d % 9 === 4) add('recyclables_sold', day, { material: 'Iron scrap', qty_kg: near(300, 130), vendor: 'Midnapore Metals' });
  if (d % 8 === 1) add('recyclables_sold', day, { material: 'Plastics', qty_kg: near(255, 110), vendor: 'KGP Scrap Traders' });
  if (d % 11 === 3) add('recyclables_sold', day, { material: 'Paper', qty_kg: near(175, 80), vendor: 'Sadar Paper Mart' });

  // Laboratory samples roughly fortnightly, and one breaches the NGT limits.
  if (d % 14 === 6) {
    const bad = d < 14;
    add('stp_lab', day, {
      plant: 'STP-1',
      ph_in: +(7.4 + (rnd() - 0.5) * 0.4).toFixed(1),
      ph_out: bad ? 9.3 : +(7.1 + (rnd() - 0.5) * 0.3).toFixed(1),
      cod_in: near(330, 70), cod_out: bad ? 58 : near(42, 10),
      bod_in: near(150, 40), bod_out: bad ? 13 : near(8, 3),
      tss_in: near(205, 50), tss_out: bad ? 23 : near(16, 5),
    });
  }
  if (d % 21 === 9) {
    add('stp_lab', day, {
      plant: 'STP at SPMS Hospital',
      ph_in: 7.1, ph_out: 7.0,
      cod_in: near(245, 50), cod_out: near(37, 8),
      bod_in: near(112, 25), bod_out: near(7, 2),
      tss_in: near(152, 35), tss_out: near(14, 4),
    });
  }
}

add('ewaste_disposal', dayBack(Math.min(DAYS, 24)), {
  description: 'CRT monitors and keyboards cleared from Nalanda complex', qty_kg: 148, vendor: 'EcoReco Recycling',
}, true);
add('ewaste_disposal', dayBack(Math.min(DAYS, 5)), {
  description: 'Dead UPS batteries from the Hall of Residence stores', qty_kg: 62, vendor: 'EcoReco Recycling',
}, false);

console.log(`\n  Added ${added} demonstration entries, from ${DAYS} days ago up to yesterday.`);
if (skipped) console.log(`  Left ${skipped} alone, because an entry for that day already existed.`);
console.log(`  Today is empty, so every account has something to enter during the demonstration.`);
console.log(`  The administrator sees all of them under Administration > Recent entries.`);
console.log(`\n  To remove them again:  node demo-data.js --clear\n`);
