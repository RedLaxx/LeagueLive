'use strict';

/**
 * Move the whole database in and out of a single plain-JSON file
 * (`data/db.json`). That file is committed to git, which is what makes
 * GitHub Pages able to rebuild the site without a running server.
 */

const db = require('./db');

const TABLES = [
  'competitions',
  'teams',
  'team_competitions',
  'players',
  'matches',
  'match_events',
  'match_stats',
  'lineups',
];

function dump() {
  const out = { version: 1, generatedAt: new Date().toISOString(), tables: {} };
  const meta = db.all('SELECT key, value FROM meta').filter((r) => r.key !== 'auth_secret');
  out.meta = meta;
  for (const t of TABLES) {
    out.tables[t] = db.all(`SELECT * FROM ${t}`);
  }
  // keep autoincrement counters meaningful
  out.sequences = {
    match_events: db.get('SELECT COALESCE(MAX(id),0) m FROM match_events')?.m || 0,
    lineups: db.get('SELECT COALESCE(MAX(id),0) m FROM lineups')?.m || 0,
  };
  return out;
}

function load(data) {
  const d = db.db();
  db.transaction(() => {
    d.exec('PRAGMA foreign_keys = OFF');
    // reverse dependency order for deletes
    for (const t of [...TABLES].reverse()) d.exec(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const rows = data.tables?.[t] || [];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const sql = `INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
      const stmt = d.prepare(sql);
      for (const row of rows) stmt.run(...cols.map((c) => row[c] ?? null));
    }
    if (Array.isArray(data.meta)) {
      for (const m of data.meta) {
        if (m.key === 'auth_secret') continue;
        db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', m.key, m.value);
      }
    }
    d.exec('PRAGMA foreign_keys = ON');
  });
  db.touch();
  return true;
}

function isEmpty() {
  return (db.get('SELECT COUNT(*) n FROM competitions')?.n || 0) === 0;
}

module.exports = { dump, load, isEmpty, TABLES };
