'use strict';

/**
 * Writes the static snapshot consumed by the GitHub Pages site:
 *   public/data/bootstrap.json, home.json, live.json,
 *   competition-<id>.json, team-<id>.json, match-<id>.json,
 *   players.json, search.json, meta.json
 */

const fs = require('fs');
const path = require('path');
const store = require('./store');
const db = require('./db');
const transfer = require('./transfer');

const OUT_DIR = path.join(db.ROOT, 'public', 'data');
const DB_JSON = path.join(db.DATA_DIR, 'db.json');

function writeJson(file, data) {
  const target = path.join(OUT_DIR, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data));
  return fs.statSync(target).size;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.writeDbJson=true] also (re)write data/db.json
 * @returns {{files:number, bytes:number, at:string}}
 */
function exportStatic(opts = {}) {
  const { writeDbJson = true } = opts;
  // start from a clean slate so deleted matches/players disappear from the site
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let bytes = 0;
  let files = 0;
  const bump = (n) => {
    bytes += n;
    files += 1;
  };

  // ---- canonical data dump (committed; used by CI + restores) ----
  if (writeDbJson) {
    fs.mkdirSync(db.DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_JSON, JSON.stringify(transfer.dump(), null, 0));
  }

  // ---- core feeds ----
  bump(writeJson('bootstrap.json', store.bootstrap()));
  bump(writeJson('home.json', store.homeFeed()));
  bump(writeJson('live.json', { generatedAt: db.updatedAt(), matches: store.liveMatches() }));
  bump(writeJson('search.json', store.searchIndex()));
  // one small file per player — the player page loads only the one it needs
  for (const row of db.all('SELECT id FROM players')) {
    const detail = store.playerDetail(row.id);
    if (detail) bump(writeJson(`player-${row.id}.json`, detail));
  }

  // ---- competitions (fixtures trimmed to a rolling window) ----
  const windowHorizon = Date.now() + 45 * 864e5;
  for (const c of store.listCompetitions()) {
    const detail = store.competitionDetail(c.id);
    if (detail) {
      detail.matches = (detail.matches || []).filter(
        (m) => m.status !== 'scheduled' || new Date(m.kickoff).getTime() <= windowHorizon
      );
    }
    bump(writeJson(`competition-${c.id}.json`, detail));
  }

  // ---- teams ----
  for (const t of store.listTeams()) {
    bump(writeJson(`team-${t.id}.json`, store.teamDetail(t.id)));
  }

  // ---- matches: completed, in-play, or kicking off in the next 3 weeks ----
  const horizon = new Date(Date.now() + 21 * 864e5).toISOString();
  const matches = db.all('SELECT * FROM matches ORDER BY kickoff');
  for (const m of matches) {
    const keep =
      ['live', 'ht', 'ft', 'postponed'].includes(m.status) || String(m.kickoff) <= horizon;
    if (!keep) continue;
    bump(writeJson(`match-${m.id}.json`, store.matchDetail(m.id)));
  }

  const at = db.updatedAt();
  bump(
    writeJson('meta.json', {
      mode: 'static',
      generatedAt: at,
      matchesExported: matches.length,
    })
  );

  return { files, bytes, at };
}

module.exports = { exportStatic, OUT_DIR, DB_JSON };
