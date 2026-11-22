// Where the data lives. Every tool that touches the database agrees through this file.
//
// By default that is a `data` folder beside the code, which is what you want on a laptop:
// clone the repository, run it, and everything is in one place.
//
// On a server where a deploy replaces the code — a `git pull`, an upload, a rebuilt
// container — the database must NOT sit inside the folder being replaced, or one bad
// deploy takes every entry with it. Set DATA_DIR to somewhere outside it:
//
//     DATA_DIR=/home/ayan/sdsi-data
//
// The folder is created if it does not exist. It holds sdsi.db, the first-time password
// file, and the backups written by backup.js.
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

module.exports = {
  DATA_DIR,
  DB_FILE: path.join(DATA_DIR, 'sdsi.db'),
  BACKUP_DIR: path.join(DATA_DIR, 'backups'),
  // Photographs for the public page. Here rather than in the code directory for the same
  // reason as the database: a deploy must not be able to delete them.
  PHOTO_DIR: path.join(DATA_DIR, 'photos'),
};
