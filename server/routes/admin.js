'use strict';

const express = require('express');
const { execFileSync } = require('child_process');
const auth = require('../auth');
const db = require('../db');
const store = require('../store');
const transfer = require('../transfer');
const { exportStatic } = require('../exporter');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const nowIso = () => new Date().toISOString();

let exportTimer = null;
function scheduleExport() {
  if (process.env.AUTO_EXPORT === '0') return;
  if (exportTimer) clearTimeout(exportTimer);
  exportTimer = setTimeout(() => {
    exportTimer = null;
    try {
      exportStatic();
    } catch (err) {
      console.error('[LeagueLive] auto-export failed:', err.message);
    }
  }, 400);
  if (exportTimer.unref) exportTimer.unref();
}

function changed() {
  db.touch();
  store.clearCache();
  scheduleExport();
}

function ok(res, extra = {}) {
  res.json({ ok: true, updatedAt: db.updatedAt(), ...extra });
}

function fail(res, code, message) {
  res.status(code).json({ error: message });
}

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const nullable = (v) => (v === '' || v === undefined || v === null ? null : v);

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const token = auth.login(password);
  if (!token) return fail(res, 401, 'Wrong password.');
  res.json({ ok: true, token, expiresInHours: 12 });
});

router.get('/session', auth.middleware, (req, res) => ok(res));

router.use(auth.middleware);

/* ------------------------------------------------------------------ */
/* overview                                                            */
/* ------------------------------------------------------------------ */

router.get('/overview', (req, res) => {
  const counts = {
    competitions: db.get('SELECT COUNT(*) n FROM competitions')?.n || 0,
    teams: db.get('SELECT COUNT(*) n FROM teams')?.n || 0,
    players: db.get('SELECT COUNT(*) n FROM players')?.n || 0,
    matches: db.get('SELECT COUNT(*) n FROM matches')?.n || 0,
    live: db.get(`SELECT COUNT(*) n FROM matches WHERE status IN ('live','ht')`)?.n || 0,
    scheduled: db.get(`SELECT COUNT(*) n FROM matches WHERE status = 'scheduled'`)?.n || 0,
    finished: db.get(`SELECT COUNT(*) n FROM matches WHERE status = 'ft'`)?.n || 0,
  };
  res.json({
    ok: true,
    counts,
    updatedAt: db.updatedAt(),
    competitions: store.listCompetitions(),
    teams: store.listTeams(),
    liveMatches: store.liveMatches(),
    gitPublishEnabled: process.env.ENABLE_GIT_PUBLISH === '1',
  });
});

/* ------------------------------------------------------------------ */
/* competitions                                                        */
/* ------------------------------------------------------------------ */

function competitionFields(body) {
  return {
    name: String(body.name || '').trim(),
    short_name: nullable(String(body.shortName || '').trim()) || null,
    country: nullable(String(body.country || '').trim()),
    season: nullable(String(body.season || '').trim()),
    type: ['league', 'cup'].includes(body.type) ? body.type : 'league',
    stage: nullable(String(body.stage || '').trim()),
    color: String(body.color || '#00e07a').trim(),
    emblem: nullable(String(body.emblem || '').trim()),
    points_win: num(body.pointsWin, 3),
    points_draw: num(body.pointsDraw, 1),
    points_loss: num(body.pointsLoss, 0),
    has_groups: body.hasGroups ? 1 : 0,
    zones: JSON.stringify(Array.isArray(body.zones) ? body.zones : []),
    sort_order: num(body.sortOrder, 0),
    updated_at: nowIso(),
  };
}

router.post('/competitions', (req, res) => {
  const f = competitionFields(req.body || {});
  if (!f.name) return fail(res, 400, 'Competition name is required.');
  const id = db.slug(f.name) || db.uid('c');
  db.run(
    `INSERT INTO competitions (id, name, short_name, country, season, type, stage, color, emblem,
       points_win, points_draw, points_loss, has_groups, zones, sort_order, updated_at)
     VALUES (@id, @name, @short_name, @country, @season, @type, @stage, @color, @emblem,
       @points_win, @points_draw, @points_loss, @has_groups, @zones, @sort_order, @updated_at)`,
    { id, ...f }
  );
  changed();
  ok(res, { id });
});

router.put('/competitions/:id', (req, res) => {
  if (!db.get('SELECT id FROM competitions WHERE id = ?', req.params.id))
    return fail(res, 404, 'Competition not found');
  const f = competitionFields(req.body || {});
  if (!f.name) return fail(res, 400, 'Competition name is required.');
  db.run(
    `UPDATE competitions SET name=@name, short_name=@short_name, country=@country, season=@season,
       type=@type, stage=@stage, color=@color, emblem=@emblem, points_win=@points_win,
       points_draw=@points_draw, points_loss=@points_loss, has_groups=@has_groups, zones=@zones,
       sort_order=@sort_order, updated_at=@updated_at
     WHERE id=@id`,
    { id: req.params.id, ...f }
  );
  changed();
  ok(res);
});

router.delete('/competitions/:id', (req, res) => {
  db.run('DELETE FROM competitions WHERE id = ?', req.params.id);
  changed();
  ok(res);
});

/* ------------------------------------------------------------------ */
/* teams                                                               */
/* ------------------------------------------------------------------ */

function teamFields(body) {
  return {
    name: String(body.name || '').trim(),
    short_name: nullable(String(body.shortName || '').trim()),
    code: nullable(String(body.code || '').trim().toUpperCase().slice(0, 5)),
    color: String(body.color || '#8a94a6').trim(),
    emblem: nullable(String(body.emblem || '').trim()),
    venue: nullable(String(body.venue || '').trim()),
    city: nullable(String(body.city || '').trim()),
    country: nullable(String(body.country || '').trim()),
    manager: nullable(String(body.manager || '').trim()),
    founded: nullable(num(body.founded, null)),
    updated_at: nowIso(),
  };
}

function setTeamCompetitions(teamId, ids) {
  db.run('DELETE FROM team_competitions WHERE team_id = ?', teamId);
  (ids || []).forEach((cid, i) => {
    db.run(
      'INSERT OR IGNORE INTO team_competitions (team_id, competition_id, points_adjustment, sort_order) VALUES (?,?,?,?)',
      teamId,
      cid,
      0,
      i
    );
  });
}

router.post('/teams', (req, res) => {
  const f = teamFields(req.body || {});
  if (!f.name) return fail(res, 400, 'Team name is required.');
  const id = `t_${db.slug(f.name) || db.uid('t').slice(2)}`;
  db.run(
    `INSERT INTO teams (id, name, short_name, code, color, emblem, venue, city, country, manager, founded, updated_at)
     VALUES (@id, @name, @short_name, @code, @color, @emblem, @venue, @city, @country, @manager, @founded, @updated_at)`,
    { id, ...f }
  );
  setTeamCompetitions(id, req.body?.competitions || []);
  changed();
  ok(res, { id });
});

router.put('/teams/:id', (req, res) => {
  const id = req.params.id;
  if (!db.get('SELECT id FROM teams WHERE id = ?', id)) return fail(res, 404, 'Team not found');
  const f = teamFields(req.body || {});
  if (!f.name) return fail(res, 400, 'Team name is required.');
  db.run(
    `UPDATE teams SET name=@name, short_name=@short_name, code=@code, color=@color, emblem=@emblem,
       venue=@venue, city=@city, country=@country, manager=@manager, founded=@founded, updated_at=@updated_at
     WHERE id=@id`,
    { id, ...f }
  );
  if (Array.isArray(req.body?.competitions)) setTeamCompetitions(id, req.body.competitions);
  changed();
  ok(res);
});

router.delete('/teams/:id', (req, res) => {
  db.run('DELETE FROM teams WHERE id = ?', req.params.id);
  changed();
  ok(res);
});

/* ------------------------------------------------------------------ */
/* players                                                             */
/* ------------------------------------------------------------------ */

function playerFields(body) {
  return {
    team_id: String(body.teamId || '').trim(),
    name: String(body.name || '').trim(),
    position: ['GK', 'DF', 'MF', 'FW'].includes(body.position) ? body.position : 'MF',
    shirt_number: nullable(num(body.shirtNumber, null)),
    nationality: nullable(String(body.nationality || '').trim()),
    age: nullable(num(body.age, null)),
    photo: nullable(String(body.photo || '').trim()),
    updated_at: nowIso(),
  };
}

router.post('/players', (req, res) => {
  const f = playerFields(req.body || {});
  if (!f.name) return fail(res, 400, 'Player name is required.');
  if (!db.get('SELECT id FROM teams WHERE id = ?', f.team_id))
    return fail(res, 400, 'Pick a valid team.');
  const id = `p_${db.slug(f.name)}_${db.uid('').slice(1, 5)}`;
  db.run(
    `INSERT INTO players (id, team_id, name, position, shirt_number, nationality, age, photo, updated_at)
     VALUES (@id, @team_id, @name, @position, @shirt_number, @nationality, @age, @photo, @updated_at)`,
    { id, ...f }
  );
  changed();
  ok(res, { id });
});

router.put('/players/:id', (req, res) => {
  const id = req.params.id;
  if (!db.get('SELECT id FROM players WHERE id = ?', id)) return fail(res, 404, 'Player not found');
  const f = playerFields(req.body || {});
  if (!f.name) return fail(res, 400, 'Player name is required.');
  db.run(
    `UPDATE players SET team_id=@team_id, name=@name, position=@position, shirt_number=@shirt_number,
       nationality=@nationality, age=@age, photo=@photo, updated_at=@updated_at WHERE id=@id`,
    { id, ...f }
  );
  changed();
  ok(res);
});

router.delete('/players/:id', (req, res) => {
  db.run('DELETE FROM players WHERE id = ?', req.params.id);
  changed();
  ok(res);
});

/* ------------------------------------------------------------------ */
/* matches                                                             */
/* ------------------------------------------------------------------ */

function matchFields(body, existing = {}) {
  const kickoff = body.kickoff ? new Date(body.kickoff).toISOString() : existing.kickoff;
  return {
    competition_id: String(body.competitionId || existing.competition_id || '').trim(),
    round: nullable(String(body.round ?? existing.round ?? '').toString().trim()),
    group_name: nullable(String(body.group ?? existing.group ?? '').toString().trim()),
    home_team_id: String(body.homeTeamId || existing.home_team_id || '').trim(),
    away_team_id: String(body.awayTeamId || existing.away_team_id || '').trim(),
    kickoff,
    status: ['scheduled', 'live', 'ht', 'ft', 'postponed', 'cancelled'].includes(body.status)
      ? body.status
      : existing.status || 'scheduled',
    minute: nullable(num(body.minute, existing.minute ?? null)),
    added_time: num(body.addedTime ?? existing.added_time, 0),
    home_score: num(body.homeScore ?? existing.home_score, 0),
    away_score: num(body.awayScore ?? existing.away_score, 0),
    home_score_ht: nullable(num(body.homeScoreHT ?? existing.home_score_ht, null)),
    away_score_ht: nullable(num(body.awayScoreHT ?? existing.away_score_ht, null)),
    home_pen: nullable(num(body.homePen ?? existing.home_pen, null)),
    away_pen: nullable(num(body.awayPen ?? existing.away_pen, null)),
    venue: nullable(String(body.venue ?? existing.venue ?? '').trim()),
    referee: nullable(String(body.referee ?? existing.referee ?? '').trim()),
    attendance: nullable(num(body.attendance ?? existing.attendance, null)),
    note: nullable(String(body.note ?? existing.note ?? '').trim()),
    updated_at: nowIso(),
  };
}

router.post('/matches', (req, res) => {
  const f = matchFields(req.body || {});
  if (!f.competition_id || !f.home_team_id || !f.away_team_id || !f.kickoff)
    return fail(res, 400, 'Competition, both teams and a kick-off time are required.');
  if (f.home_team_id === f.away_team_id) return fail(res, 400, 'A team cannot play itself.');
  const id = `m_${db.slug(f.competition_id)}_${db.uid('').slice(1, 7)}`;
  db.run(
    `INSERT INTO matches (id, competition_id, round, group_name, home_team_id, away_team_id, kickoff, status,
       minute, added_time, home_score, away_score, home_score_ht, away_score_ht, home_pen, away_pen,
       venue, referee, attendance, note, updated_at)
     VALUES (@id, @competition_id, @round, @group_name, @home_team_id, @away_team_id, @kickoff, @status,
       @minute, @added_time, @home_score, @away_score, @home_score_ht, @away_score_ht, @home_pen, @away_pen,
       @venue, @referee, @attendance, @note, @updated_at)`,
    { id, ...f }
  );
  changed();
  ok(res, { id });
});

router.put('/matches/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.get('SELECT * FROM matches WHERE id = ?', id);
  if (!existing) return fail(res, 404, 'Match not found');
  const f = matchFields(req.body || {}, existing);
  db.run(
    `UPDATE matches SET competition_id=@competition_id, round=@round, group_name=@group_name,
       home_team_id=@home_team_id, away_team_id=@away_team_id, kickoff=@kickoff, status=@status,
       minute=@minute, added_time=@added_time, home_score=@home_score, away_score=@away_score,
       home_score_ht=@home_score_ht, away_score_ht=@away_score_ht, home_pen=@home_pen, away_pen=@away_pen,
       venue=@venue, referee=@referee, attendance=@attendance, note=@note, updated_at=@updated_at
     WHERE id=@id`,
    { id, ...f }
  );
  changed();
  ok(res);
});

router.delete('/matches/:id', (req, res) => {
  db.run('DELETE FROM matches WHERE id = ?', req.params.id);
  changed();
  ok(res);
});

/** Fast "live ticker" update: status + minute + score in one call. */
router.post('/matches/:id/quick', (req, res) => {
  const id = req.params.id;
  const existing = db.get('SELECT * FROM matches WHERE id = ?', id);
  if (!existing) return fail(res, 404, 'Match not found');
  const body = req.body || {};
  const patch = {
    status: ['scheduled', 'live', 'ht', 'ft', 'postponed', 'cancelled'].includes(body.status)
      ? body.status
      : existing.status,
    minute: body.minute !== undefined ? nullable(num(body.minute, null)) : existing.minute,
    added_time: body.addedTime !== undefined ? num(body.addedTime, 0) : existing.added_time,
    home_score: body.homeScore !== undefined ? num(body.homeScore, existing.home_score) : existing.home_score,
    away_score: body.awayScore !== undefined ? num(body.awayScore, existing.away_score) : existing.away_score,
  };
  if (patch.status === 'ft') patch.minute = 90;
  if (patch.status === 'ht') patch.minute = 45;
  if (patch.status === 'scheduled') patch.minute = null;

  db.run(
    `UPDATE matches SET status=@status, minute=@minute, added_time=@added_time,
       home_score=@home_score, away_score=@away_score, updated_at=@updated_at WHERE id=@id`,
    { id, ...patch, updated_at: nowIso() }
  );

  // Keep the half-time score in sync when the whistle goes for half time.
  if (patch.status === 'ht') {
    db.run('UPDATE matches SET home_score_ht=@h, away_score_ht=@a WHERE id=@id', {
      id,
      h: patch.home_score,
      a: patch.away_score,
    });
  }
  changed();
  ok(res, { match: store.matchDetail(id) });
});

/* ------------------------------------------------------------------ */
/* events                                                              */
/* ------------------------------------------------------------------ */

/** Recalculate home/away score from the goal events on a match. */
function recomputeScore(matchId) {
  const m = db.get('SELECT * FROM matches WHERE id = ?', matchId);
  if (!m) return;
  const events = db.all(
    `SELECT * FROM match_events WHERE match_id = ? AND type IN ('goal','penalty','own_goal')`,
    matchId
  );
  let hs = 0;
  let as = 0;
  for (const e of events) {
    const isHome = e.team_id === m.home_team_id;
    if (e.type === 'own_goal') {
      if (isHome) as += 1;
      else hs += 1;
    } else if (isHome) {
      hs += 1;
    } else {
      as += 1;
    }
  }
  db.run('UPDATE matches SET home_score=?, away_score=?, updated_at=? WHERE id=?', hs, as, nowIso(), matchId);
}

const EVENT_TYPES = ['goal', 'penalty', 'penalty_missed', 'own_goal', 'yellow', 'second_yellow', 'red', 'sub', 'var'];

router.post('/matches/:id/events', (req, res) => {
  const id = req.params.id;
  const m = db.get('SELECT * FROM matches WHERE id = ?', id);
  if (!m) return fail(res, 404, 'Match not found');
  const b = req.body || {};
  const type = EVENT_TYPES.includes(b.type) ? b.type : 'goal';
  const teamId = String(b.teamId || (b.side === 'away' ? m.away_team_id : m.home_team_id));
  const minute = num(b.minute, m.minute || 0);

  const info = db.run(
    `INSERT INTO match_events (match_id, type, minute, added_time, team_id, player_id, secondary_player_id, note)
     VALUES (?,?,?,?,?,?,?,?)`,
    id,
    type,
    minute,
    num(b.addedTime, 0),
    teamId,
    nullable(String(b.playerId || '')),
    nullable(String(b.secondaryPlayerId || '')),
    nullable(String(b.note || '').trim())
  );

  // The scoreline is always derived from the event feed, so adding or removing
  // a goal can never leave the two out of sync.
  if (['goal', 'penalty', 'own_goal'].includes(type)) recomputeScore(id);

  changed();
  ok(res, { eventId: info.lastInsertRowid, match: store.matchDetail(id) });
});

router.delete('/events/:eventId', (req, res) => {
  const ev = db.get('SELECT * FROM match_events WHERE id = ?', req.params.eventId);
  if (!ev) return fail(res, 404, 'Event not found');
  const m = db.get('SELECT * FROM matches WHERE id = ?', ev.match_id);
  db.run('DELETE FROM match_events WHERE id = ?', req.params.eventId);

  if (m && ['goal', 'penalty', 'own_goal'].includes(ev.type)) recomputeScore(m.id);

  changed();
  ok(res, { match: m ? store.matchDetail(m.id) : null });
});

/* ------------------------------------------------------------------ */
/* stats                                                               */
/* ------------------------------------------------------------------ */

const STAT_KEYS = {
  possession: 'possession',
  shots: 'shots',
  shotsOnTarget: 'shots_on_target',
  corners: 'corners',
  fouls: 'fouls',
  yellowCards: 'yellow_cards',
  redCards: 'red_cards',
  offsides: 'offsides',
  passes: 'passes',
  passAccuracy: 'pass_accuracy',
  tackles: 'tackles',
  saves: 'saves',
  bigChances: 'big_chances',
  xg: 'xg',
};

router.put('/matches/:id/stats', (req, res) => {
  const id = req.params.id;
  const m = db.get('SELECT * FROM matches WHERE id = ?', id);
  if (!m) return fail(res, 404, 'Match not found');
  const body = req.body || {};
  for (const side of ['home', 'away']) {
    const teamId = side === 'home' ? m.home_team_id : m.away_team_id;
    const incoming = body[side] || {};
    const current = db.get('SELECT * FROM match_stats WHERE match_id=? AND team_id=?', id, teamId) || {};
    const values = {};
    for (const [jsKey, col] of Object.entries(STAT_KEYS)) {
      values[col] = incoming[jsKey] !== undefined ? num(incoming[jsKey], current[col] ?? null) : (current[col] ?? null);
    }
    db.run(
      `INSERT INTO match_stats (match_id, team_id, ${Object.keys(values).join(',')})
       VALUES (?, ?, ${Object.keys(values).map(() => '?').join(',')})
       ON CONFLICT(match_id, team_id) DO UPDATE SET ${Object.keys(values).map((c) => `${c}=excluded.${c}`).join(',')}`,
      id,
      teamId,
      ...Object.values(values)
    );
  }
  changed();
  ok(res, { match: store.matchDetail(id) });
});

/* ------------------------------------------------------------------ */
/* line-ups                                                            */
/* ------------------------------------------------------------------ */

router.put('/matches/:id/lineups', (req, res) => {
  const id = req.params.id;
  const m = db.get('SELECT * FROM matches WHERE id = ?', id);
  if (!m) return fail(res, 404, 'Match not found');
  const body = req.body || {};
  db.run('DELETE FROM lineups WHERE match_id = ?', id);

  const order = { GK: 0, DF: 1, MF: 2, FW: 3 };
  for (const side of ['home', 'away']) {
    const teamId = side === 'home' ? m.home_team_id : m.away_team_id;
    const list = Array.isArray(body[side]) ? body[side] : [];
    list.forEach((entry, i) => {
      const playerId = typeof entry === 'string' ? entry : entry.playerId;
      if (!playerId) return;
      const p = db.get('SELECT * FROM players WHERE id = ?', playerId);
      if (!p) return;
      const isStarting = typeof entry === 'string' ? i < 11 : entry.isStarting !== false && i < 11;
      db.run(
        `INSERT INTO lineups (match_id, team_id, player_id, is_starting, is_captain, position, shirt_number, minute_on, minute_off)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        id,
        teamId,
        playerId,
        isStarting ? 1 : 0,
        entry && entry.isCaptain ? 1 : 0,
        entry?.position || p.position,
        entry?.shirtNumber ?? p.shirt_number,
        isStarting ? 0 : (entry?.minuteOn ?? null),
        entry?.minuteOff ?? null
      );
      void order;
    });
  }
  changed();
  ok(res, { match: store.matchDetail(id) });
});

/** Auto-generate a starting XI + bench from the squad list. */
router.post('/matches/:id/lineups/auto', (req, res) => {
  const id = req.params.id;
  const m = db.get('SELECT * FROM matches WHERE id = ?', id);
  if (!m) return fail(res, 404, 'Match not found');
  const order = { GK: 0, DF: 1, MF: 2, FW: 3 };
  const shape = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];

  for (const teamId of [m.home_team_id, m.away_team_id]) {
    const squad = db
      .all('SELECT * FROM players WHERE team_id = ?', teamId)
      .sort((a, b) => (order[a.position] - order[b.position]) || (a.shirt_number || 99) - (b.shirt_number || 99));
    if (!squad.length) continue;
    const picked = [];
    const used = new Set();
    for (const need of shape) {
      const candidate = squad.find((p) => p.position === need && !used.has(p.id));
      if (candidate) {
        picked.push(candidate);
        used.add(candidate.id);
      }
    }
    for (const p of squad) {
      if (picked.length >= 11) break;
      if (!used.has(p.id)) {
        picked.push(p);
        used.add(p.id);
      }
    }
    db.run('DELETE FROM lineups WHERE match_id = ? AND team_id = ?', id, teamId);
    picked.forEach((p, i) => {
      const starting = i < 11;
      db.run(
        `INSERT INTO lineups (match_id, team_id, player_id, is_starting, is_captain, position, shirt_number, minute_on, minute_off)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        id,
        teamId,
        p.id,
        starting ? 1 : 0,
        i === 2 ? 1 : 0,
        p.position,
        p.shirt_number,
        starting ? 0 : null,
        null
      );
    });
  }
  changed();
  ok(res, { match: store.matchDetail(id) });
});

/* ------------------------------------------------------------------ */
/* fixture generator (round robin / circle method)                     */
/* ------------------------------------------------------------------ */

router.post('/fixtures', (req, res) => {
  const b = req.body || {};
  const competitionId = String(b.competitionId || '');
  const comp = db.get('SELECT * FROM competitions WHERE id = ?', competitionId);
  if (!comp) return fail(res, 404, 'Competition not found');

  const teams = db
    .all('SELECT team_id FROM team_competitions WHERE competition_id = ? ORDER BY sort_order', competitionId)
    .map((r) => r.team_id);
  if (teams.length < 2) return fail(res, 400, 'Add at least two teams to that competition first.');

  const doubleRound = b.doubleRound !== false;
  const startDate = new Date(b.startDate || Date.now());
  const intervalDays = num(b.intervalDays, 7);
  const kickoffHour = num(b.kickoffHour, 15);
  const clearExisting = !!b.clearExisting;

  const list = teams.slice();
  const bye = list.length % 2 !== 0;
  if (bye) list.push(null);
  const n = list.length;
  const rounds = [];
  const fixed = list[0];
  const rotating = list.slice(1);
  for (let r = 0; r < n - 1; r += 1) {
    const pairs = [];
    const arr = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i += 1) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home && away) {
        // alternate home advantage so it isn't always the same side hosting
        const flip = (r + i) % 2 === 1 && doubleRound === false;
        pairs.push(flip ? { home: away, away: home } : { home, away });
      }
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop());
  }

  const schedule = [];
  rounds.forEach((pairs, ri) => schedule.push({ round: ri + 1, pairs }));
  if (doubleRound) {
    rounds.forEach((pairs, ri) =>
      schedule.push({
        round: rounds.length + ri + 1,
        pairs: pairs.map((p) => ({ home: p.away, away: p.home })),
      })
    );
  }

  db.transaction(() => {
    if (clearExisting) db.run('DELETE FROM matches WHERE competition_id = ?', competitionId);
    schedule.forEach((r, idx) => {
      const day = new Date(startDate.getTime() + idx * intervalDays * 864e5);
      const base = new Date(day);
      base.setUTCHours(kickoffHour, 0, 0, 0);
      r.pairs.forEach((p, mi) => {
        const kickoff = new Date(base.getTime() + mi * 15 * 60000).toISOString();
        const homeTeam = db.get('SELECT * FROM teams WHERE id = ?', p.home);
        db.run(
          `INSERT INTO matches (id, competition_id, round, group_name, home_team_id, away_team_id, kickoff,
             status, minute, added_time, home_score, away_score, venue, updated_at)
           VALUES (?,?,?,?,?,?,?, 'scheduled', NULL, 0, 0, 0, ?, ?)`,
          `m_${competitionId}_r${r.round}_${mi}_${db.uid('').slice(1, 5)}`,
          competitionId,
          String(r.round),
          null,
          p.home,
          p.away,
          kickoff,
          homeTeam?.venue || '',
          nowIso()
        );
      });
    });
  });

  changed();
  ok(res, {
    created: db.get('SELECT COUNT(*) n FROM matches WHERE competition_id = ?', competitionId)?.n || 0,
  });
});

/* ------------------------------------------------------------------ */
/* bulk team import                                                    */
/* ------------------------------------------------------------------ */

router.post('/teams/import', (req, res) => {
  const b = req.body || {};
  const competitionId = String(b.competitionId || '');
  if (!db.get('SELECT id FROM competitions WHERE id = ?', competitionId))
    return fail(res, 404, 'Competition not found');
  const names = String(b.names || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  let created = 0;
  for (const name of names) {
    const id = `t_${db.slug(name)}`;
    if (db.get('SELECT id FROM teams WHERE id = ?', id)) {
      db.run('INSERT OR IGNORE INTO team_competitions (team_id, competition_id, points_adjustment, sort_order) VALUES (?,?,0,0)', id, competitionId);
      continue;
    }
    db.run(
      `INSERT INTO teams (id, name, short_name, code, color, updated_at) VALUES (?,?,?,?,?,?)`,
      id,
      name,
      name,
      name.slice(0, 3).toUpperCase(),
      '#8a94a6',
      nowIso()
    );
    db.run('INSERT INTO team_competitions (team_id, competition_id, points_adjustment, sort_order) VALUES (?,?,0,0)', id, competitionId);
    created += 1;
  }
  changed();
  ok(res, { created, total: names.length });
});

/* ------------------------------------------------------------------ */
/* export / publish                                                    */
/* ------------------------------------------------------------------ */

router.post('/export', (req, res) => {
  try {
    const result = exportStatic();
    ok(res, { exported: result });
  } catch (err) {
    fail(res, 500, `Export failed: ${err.message}`);
  }
});

router.post('/publish', (req, res) => {
  if (process.env.ENABLE_GIT_PUBLISH !== '1')
    return fail(res, 400, 'Git publishing is disabled. Start the server with ENABLE_GIT_PUBLISH=1 to enable it.');
  try {
    const result = exportStatic();
    const message = String((req.body && req.body.message) || 'Update LeagueLive data').replace(/"/g, '\\"');
    const out = (cmd, args) =>
      execFileSync('git', args, { cwd: db.ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) && cmd;

    execFileSync('git', ['add', 'data/db.json', 'public/data'], { cwd: db.ROOT, encoding: 'utf8' });
    try {
      execFileSync('git', ['commit', '-m', message], { cwd: db.ROOT, encoding: 'utf8' });
    } catch (e) {
      if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
    }
    const push = execFileSync('git', ['push'], { cwd: db.ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    void out;
    ok(res, { exported: result, push: String(push || '').trim() });
  } catch (err) {
    fail(res, 500, `Publish failed: ${(err.stderr || err.message || '').toString().trim()}`);
  }
});

/** Replace the entire database from an uploaded data/db.json payload. */
router.post('/import', (req, res) => {
  const data = (req.body || {}).data;
  if (!data || !data.tables) return fail(res, 400, 'Missing data payload.');
  try {
    transfer.load(data);
    changed();
    ok(res);
  } catch (err) {
    fail(res, 500, `Import failed: ${err.message}`);
  }
});

module.exports = router;
