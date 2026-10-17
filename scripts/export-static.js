'use strict';

/**
 * Rebuild the static snapshot in public/data from data/db.json (or the local
 * SQLite database). Used by `npm run export`, by the server after every admin
 * change, and by the GitHub Pages workflow.
 */

const fs = require('fs');
const path = require('path');

const db = require('../server/db');
const transfer = require('../server/transfer');
const { exportStatic } = require('../server/exporter');

function main() {
  db.connect();
  if (transfer.isEmpty()) {
    const jsonPath = path.join(db.DATA_DIR, 'db.json');
    if (fs.existsSync(jsonPath)) {
      transfer.load(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
    } else {
      console.error('[LeagueLive] No data found. Run `npm run seed` first.');
      process.exit(1);
    }
  }
  const result = exportStatic();
  console.log(
    `[LeagueLive] Exported ${result.files} files (${(result.bytes / 1024).toFixed(0)} KB) to public/data`
  );
}

if (require.main === module) main();
module.exports = { main };
