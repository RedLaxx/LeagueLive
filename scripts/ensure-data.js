'use strict';

/**
 * postinstall hook: make sure there is something to show.
 * Never fails the install.
 */

try {
  const fs = require('fs');
  const path = require('path');
  const db = require('../server/db');
  const transfer = require('../server/transfer');

  db.connect();
  if (!transfer.isEmpty()) {
    process.exit(0);
  }
  const jsonPath = path.join(db.DATA_DIR, 'db.json');
  if (fs.existsSync(jsonPath)) {
    transfer.load(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
    console.log('[LeagueLive] Restored data from data/db.json');
    process.exit(0);
  }
  const { seedDatabase } = require('./seed');
  seedDatabase();
  console.log('[LeagueLive] Demo data ready.');
} catch (err) {
  console.warn('[LeagueLive] Skipping data setup:', err.message);
}
