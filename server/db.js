'use strict';

/**
 * LeagueLive — database layer.
 *
 * Uses the SQLite engine built into Node 22.5+ (`node:sqlite`), so the whole
 * app has exactly one npm dependency (express) and no native compilation.
 */

const fs = require('fs');
const path = require('path');

let DatabaseSync = null;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
  DatabaseSync = null;
}

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.LEAGUELIVE_DATA || path.join(ROOT, 'data');
const DB_PATH = process.env.LEAGUELIVE_DB || path.join(DATA_DIR, 'leaguelive.db');

if (!DatabaseSync) {
  console.error(
    '\n[LeagueLive] This app needs Node.js 22.5 or newer (built-in SQLite).\n' +
      `You are running ${process.version}. Please upgrade Node, then run: npm start\n`
  );
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  short_name    TEXT,
  country       TEXT,
  season        TEXT,
  type          TEXT NOT NULL DEFAULT 'league',
  stage         TEXT,
  color         TEXT NOT NULL DEFAULT '#00e07a',
  emblem        TEXT,
  points_win    INTEGER NOT NULL DEFAULT 3,
  points_draw   INTEGER NOT NULL DEFAULT 1,
  points_loss   INTEGER NOT NULL DEFAULT 0,
  has_groups    INTEGER NOT NULL DEFAULT 0,
  zones         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS teams (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  short_name   TEXT,
  code         TEXT,
  color        TEXT NOT NULL DEFAULT '#8a94a6',
  emblem       TEXT,
  venue        TEXT,
  city         TEXT,
  country      TEXT,
  manager      TEXT,
  founded      INTEGER,
  updated_at   TEXT
);

-- A team can take part in several competitions (domestic league + cups).
CREATE TABLE IF NOT EXISTS team_competitions (
  team_id            TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  points_adjustment  INTEGER NOT NULL DEFAULT 0,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, competition_id)
);

CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,
  team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  position     TEXT NOT NULL DEFAULT 'MF',
  shirt_number INTEGER,
  nationality  TEXT,
  age          INTEGER,
  photo        TEXT,
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id             TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  round          TEXT,
  group_name     TEXT,
  home_team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kickoff        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'scheduled',
  minute         INTEGER,
  added_time     INTEGER NOT NULL DEFAULT 0,
  home_score     INTEGER NOT NULL DEFAULT 0,
  away_score     INTEGER NOT NULL DEFAULT 0,
  home_score_ht  INTEGER,
  away_score_ht  INTEGER,
  home_pen       INTEGER,
  away_pen       INTEGER,
  venue          TEXT,
  referee        TEXT,
  attendance     INTEGER,
  note           TEXT,
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS match_events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id            TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  minute              INTEGER NOT NULL DEFAULT 0,
  added_time          INTEGER NOT NULL DEFAULT 0,
  team_id             TEXT REFERENCES teams(id) ON DELETE CASCADE,
  player_id           TEXT REFERENCES players(id) ON DELETE CASCADE,
  secondary_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  note                TEXT
);

CREATE TABLE IF NOT EXISTS match_stats (
  match_id         TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id          TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  possession       INTEGER,
  shots            INTEGER,
  shots_on_target  INTEGER,
  corners          INTEGER,
  fouls            INTEGER,
  yellow_cards     INTEGER,
  red_cards        INTEGER,
  offsides         INTEGER,
  passes           INTEGER,
  pass_accuracy    INTEGER,
  tackles          INTEGER,
  saves            INTEGER,
  big_chances      INTEGER,
  xg               REAL,
  PRIMARY KEY (match_id, team_id)
);

CREATE TABLE IF NOT EXISTS lineups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id    TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  is_starting  INTEGER NOT NULL DEFAULT 1,
  is_captain   INTEGER NOT NULL DEFAULT 0,
  position     TEXT,
  shirt_number INTEGER,
  minute_on    INTEGER,
  minute_off   INTEGER
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff);
CREATE INDEX IF NOT EXISTS idx_matches_comp    ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches(status);
CREATE INDEX IF NOT EXISTS idx_events_match    ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_lineups_match   ON lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_players_team    ON players(team_id);
`;

let _db = null;

function connect() {
  if (_db) return _db;
  ensureDir(DATA_DIR);
  const fresh = !fs.existsSync(DB_PATH);
  _db = new DatabaseSync(DB_PATH);
  _db.exec(SCHEMA);
  if (fresh) setMeta('created_at', new Date().toISOString());
  return _db;
}

function db() {
  return connect();
}

/* ------------------------------------------------------------------ */
/* tiny query helpers                                                  */
/* ------------------------------------------------------------------ */

function all(sql, ...params) {
  return db().prepare(sql).all(...params).map((r) => ({ ...r }));
}
function get(sql, ...params) {
  const row = db().prepare(sql).get(...params);
  return row ? { ...row } : null;
}
function run(sql, ...params) {
  return db().prepare(sql).run(...params);
}
function exec(sql) {
  return db().exec(sql);
}
function transaction(fn) {
  const d = db();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (err) {
    try {
      d.exec('ROLLBACK');
    } catch (_) {}
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* meta                                                                */
/* ------------------------------------------------------------------ */

function getMeta(key, fallback = null) {
  const row = get('SELECT value FROM meta WHERE key = ?', key);
  return row ? row.value : fallback;
}

function setMeta(key, value) {
  run(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    String(value)
  );
}

function touch(updatedAt = new Date().toISOString()) {
  setMeta('updated_at', updatedAt);
  return updatedAt;
}

function updatedAt() {
  return getMeta('updated_at') || new Date(0).toISOString();
}

/* ------------------------------------------------------------------ */
/* ids                                                                 */
/* ------------------------------------------------------------------ */

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function uid(prefix = 'x') {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return `${prefix}_${out}`;
}

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function teamId(team) {
  return `t_${slug(team.name)}`;
}

module.exports = {
  ROOT,
  DATA_DIR,
  DB_PATH,
  connect,
  db,
  all,
  get,
  run,
  exec,
  transaction,
  getMeta,
  setMeta,
  touch,
  updatedAt,
  uid,
  slug,
  teamId,
};
