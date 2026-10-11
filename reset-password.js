// Sets a new password for one account, from this computer.
//
//   node reset-password.js                      list the accounts
//   node reset-password.js mess_azad            give it a new random password
//   node reset-password.js admin my-new-pass    set a password you choose
//
// This is the way back in when the administrator password has been lost: it needs
// no sign-in, only the ability to run a command on the machine holding the database.
// The account is asked to choose its own password at the next sign-in.
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const users = require('./users.js');

const DB_FILE = path.join(__dirname, 'data', 'sdsi.db');
if (!fs.existsSync(DB_FILE)) {
  console.error('\n  No database yet. Start the site once, then run this again.\n');
  process.exit(1);
}

const db = new DatabaseSync(DB_FILE);
users.init(db);

const who = process.argv[2];
const chosen = process.argv[3];

const list = () => db.prepare('SELECT username, email, name, must_change FROM users ORDER BY id').all();

if (!who) {
  console.log('\n  Accounts on this site:\n');
  list().forEach(u => console.log(
    `    ${(u.email || '—').padEnd(28)} ${u.username.padEnd(14)} ${u.must_change ? 'has not chosen a password yet' : 'password set by the user'}`
  ));
  console.log('\n  To give one a new password:  node reset-password.js <username>');
  console.log('  Or choose it yourself:       node reset-password.js <username> <password>\n');
  process.exit(0);
}

const row = users.byName(db, who);
if (!row) {
  console.error(`\n  No account called "${who}". Run this with no arguments to see the list.\n`);
  process.exit(1);
}

if (chosen && chosen.length < users.MIN_PASSWORD) {
  console.error(`\n  A password must be at least ${users.MIN_PASSWORD} characters.\n`);
  process.exit(1);
}

const password = chosen || users.makePassword();
users.setPassword(db, row.id, password);
// Whoever receives this must replace it with one only they know.
db.prepare('UPDATE users SET must_change = 1 WHERE id = ?').run(row.id);

console.log(`\n  New password for ${row.email || row.username}:\n`);
console.log(`      ${password}\n`);
console.log('  They will be asked to choose their own password when they sign in.');
console.log('  Any other device signed in as this account has been signed out.\n');
