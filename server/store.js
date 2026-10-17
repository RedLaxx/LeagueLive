'use strict';

/**
 * LeagueLive — domain logic & serializers.
 * Everything the API (and the static exporter) returns is produced here, so
 * the website and the GitHub Pages snapshot are always byte-for-byte equal.
 */

const db = require('./db');

const PLAYED = ['live', 'ht', 'ft'];
const PLAYED_SQL = `('live','ht','ft')`;

/* ------------------------------------------------------------------ */
/* low level row mappers                                               */
/* ------------------------------------------------------------------ */

function mapCompetition(r) {
  if (!r) return r;
  let zones = [];
  try {
    zones = r.zones ? JSON.parse(r.zones) : [];
  } catch (_) {
    zones = [];
  }
  return {
    id: r.id,
    name: r.name,
    shortName: r.short_name || r.name,
    country: r.country || '',
    season: r.season || '',
    type: r.type,
    stage: r.stage || '',
    color: r.color,
    emblem: r.emblem || '',
    hasGroups: !!r.has_groups,
    zones,
  };
}

function mapTeam(r) {
  if (!r) return r;
  return {
    id: r.id,
    name: r.name,
    shortName: r.short_name || r.name,
    code: r.code || '',
    color: r.color,
    emblem: r.emblem || '',
    venue: r.venue || '',
    city: r.city || '',
    country: r.country || '',
    manager: r.manager || '',
    founded: r.founded || null,
  };
}

/** Trimmed team payload used inside lists, events and scoreboards. */
const teamBriefCache = new Map();
function teamBrief(id) {
  if (!id) return null;
  if (teamBriefCache.has(id)) return teamBriefCache.get(id);
  const t = teamRow(id);
  const brief = t && {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    code: t.code,
    color: t.color,
    emblem: t.emblem,
  };
  if (brief) teamBriefCache.set(id, brief);
  return brief;
}

function mapPlayer(r) {
  if (!r) return r;
  return {
    id: r.id,
    teamId: r.team_id,
    name: r.name,
    position: r.position,
    shirtNumber: r.shirt_number,
    nationality: r.nationality || '',
    age: r.age || null,
    photo: r.photo || '',
  };
}

function mapMatch(r) {
  if (!r) return r;
  return {
    id: r.id,
    competitionId: r.competition_id,
    round: r.round || '',
    group: r.group_name || '',
    kickoff: r.kickoff,
    status: r.status,
    minute: r.minute,
    addedTime: r.added_time || 0,
    homeScore: r.home_score || 0,
    awayScore: r.away_score || 0,
    homeScoreHT: r.home_score_ht,
    awayScoreHT: r.away_score_ht,
    homePen: r.home_pen,
    awayPen: r.away_pen,
    venue: r.venue || '',
    referee: r.referee || '',
    attendance: r.attendance || null,
    note: r.note || '',
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
  };
}

/* ------------------------------------------------------------------ */
/* lookups                                                             */
/* ------------------------------------------------------------------ */

const teamCache = new Map();

function teamRow(id) {
  if (!id) return null;
  if (teamCache.has(id)) return teamCache.get(id);
  const row = db.get('SELECT * FROM teams WHERE id = ?', id);
  const mapped = mapTeam(row);
  if (mapped) teamCache.set(id, mapped);
  return mapped;
}

function playerRow(id) {
  if (!id) return null;
  return mapPlayer(db.get('SELECT * FROM players WHERE id = ?', id));
}

function competitionRow(id) {
  return mapCompetition(db.get('SELECT * FROM competitions WHERE id = ?', id));
}

function clearCache() {
  teamCache.clear();
  teamBriefCache.clear();
}

/* ------------------------------------------------------------------ */
/* match summary (shared by every list view)                           */
/* ------------------------------------------------------------------ */

function matchSummary(m, { includeCompetition = true, teamsAsIds = false } = {}) {
  const out = {
    id: m.id,
    round: m.round,
    group: m.group,
    kickoff: m.kickoff,
    status: m.status,
    minute: m.minute,
    addedTime: m.addedTime,
    venue: m.venue,
    note: m.note,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    home: teamsAsIds
      ? { teamId: m.homeTeamId, score: m.homeScore }
      : { team: teamBrief(m.homeTeamId), teamId: m.homeTeamId, score: m.homeScore },
    away: teamsAsIds
      ? { teamId: m.awayTeamId, score: m.awayScore }
      : { team: teamBrief(m.awayTeamId), teamId: m.awayTeamId, score: m.awayScore },
    homePen: m.homePen,
    awayPen: m.awayPen,
  };
  if (includeCompetition) out.competition = competitionRow(m.competitionId);
  out.competitionId = m.competitionId;
  return out;
}

function matchSummaries(rows, opts) {
  return rows.map(mapMatch).map((m) => matchSummary(m, opts));
}

/* ------------------------------------------------------------------ */
/* queries                                                             */
/* ------------------------------------------------------------------ */

function listCompetitions() {
  return db
    .all('SELECT * FROM competitions ORDER BY sort_order, name')
    .map(mapCompetition);
}

function listTeams() {
  const rows = db.all('SELECT * FROM teams ORDER BY name');
  const comps = db.all('SELECT * FROM team_competitions');
  const byTeam = new Map();
  for (const c of comps) {
    if (!byTeam.has(c.team_id)) byTeam.set(c.team_id, []);
    byTeam.get(c.team_id).push(c);
  }
  return rows.map((r) => {
    const t = mapTeam(r);
    t.competitions = (byTeam.get(t.id) || []).map((c) => c.competition_id);
    return t;
  });
}

function listPlayers() {
  return db
    .all('SELECT * FROM players ORDER BY team_id, shirt_number, name')
    .map(mapPlayer);
}

function bootstrap() {
  return {
    generatedAt: db.updatedAt(),
    competitions: listCompetitions(),
    teams: listTeams(),
    players: listPlayers(),
  };
}

function liveMatches() {
  const rows = db.all(
    `SELECT * FROM matches WHERE status IN ('live','ht') ORDER BY kickoff`
  );
  return matchSummaries(rows);
}

function homeFeed() {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 864e5).toISOString();
  const to = new Date(now.getTime() + 21 * 864e5).toISOString();

  const live = liveMatches();
  const recent = matchSummaries(
    db.all(
      `SELECT * FROM matches
       WHERE status IN ('ft','postponed') AND kickoff >= ? AND kickoff <= ?
       ORDER BY kickoff DESC LIMIT 30`,
      from,
      now.toISOString()
    )
  );
  const upcoming = matchSummaries(
    db.all(
      `SELECT * FROM matches
       WHERE status IN ('scheduled','live','ht') AND kickoff >= ? AND kickoff <= ?
       ORDER BY kickoff ASC LIMIT 120`,
      now.toISOString(),
      to
    )
  );
  return { generatedAt: db.updatedAt(), live, recent, upcoming };
}

function matchesByCompetition(competitionId, opts) {
  return matchSummaries(
    db.all('SELECT * FROM matches WHERE competition_id = ? ORDER BY kickoff', competitionId),
    opts
  );
}

function matchesByTeam(teamId) {
  return matchSummaries(
    db.all(
      'SELECT * FROM matches WHERE home_team_id = ? OR away_team_id = ? ORDER BY kickoff',
      teamId,
      teamId
    )
  );
}

/* ------------------------------------------------------------------ */
/* standings                                                           */
/* ------------------------------------------------------------------ */

function rawResults(competitionId) {
  return db.all(
    `SELECT m.* FROM matches m
     WHERE m.competition_id = ? AND m.status IN ${PLAYED_SQL}`,
    competitionId
  );
}

/** Build table rows for a set of finished/in-play matches. */
function buildTable(matches, { teams, points, adjustments }) {
  const table = new Map();
  for (const id of teams) {
    table.set(id, {
      teamId: id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      points: adjustments.get(id) || 0,
      form: [],
      home: { w: 0, d: 0, l: 0, gf: 0, ga: 0 },
      away: { w: 0, d: 0, l: 0, gf: 0, ga: 0 },
    });
  }

  const ordered = matches
    .slice()
    .sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));

  for (const m of ordered) {
    const h = table.get(m.home_team_id);
    const a = table.get(m.away_team_id);
    if (!h || !a) continue;
    const hs = m.home_score || 0;
    const as = m.away_score || 0;
    h.played += 1;
    a.played += 1;
    h.gf += hs;
    h.ga += as;
    a.gf += as;
    a.ga += hs;
    h.home.gf += hs;
    h.home.ga += as;
    a.away.gf += as;
    a.away.ga += hs;

    if (hs > as) {
      h.won += 1;
      a.lost += 1;
      h.points += points.win;
      a.points += points.loss;
      h.form.push('W');
      a.form.push('L');
      h.home.w += 1;
      a.away.l += 1;
    } else if (hs < as) {
      a.won += 1;
      h.lost += 1;
      a.points += points.win;
      h.points += points.loss;
      a.form.push('W');
      h.form.push('L');
      a.away.w += 1;
      h.home.l += 1;
    } else {
      h.drawn += 1;
      a.drawn += 1;
      h.points += points.draw;
      a.points += points.draw;
      h.form.push('D');
      a.form.push('D');
      h.home.d += 1;
      a.away.d += 1;
    }
  }

  const rows = [...table.values()].map((r) => ({
    ...r,
    gd: r.gf - r.ga,
    team: teamRow(r.teamId),
    form: r.form.slice(-5),
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      String(a.team?.name || '').localeCompare(String(b.team?.name || ''))
  );

  rows.forEach((r, i) => {
    r.position = i + 1;
    r.zone = zoneFor(r.position, r._zones || []);
  });

  return rows;
}

function zoneFor(position, zones) {
  const hit = (zones || []).find((z) => position >= z.from && position <= z.to);
  return hit || null;
}

function competitionTables(competitionId) {
  const comp = competitionRow(competitionId);
  if (!comp) return null;
  const points = {
    win: db.get('SELECT points_win w FROM competitions WHERE id = ?', competitionId)?.w ?? 3,
    draw: db.get('SELECT points_draw d FROM competitions WHERE id = ?', competitionId)?.d ?? 1,
    loss: 0,
  };
  const adjustments = new Map(
    db
      .all('SELECT team_id, points_adjustment FROM team_competitions WHERE competition_id = ?', competitionId)
      .map((r) => [r.team_id, r.points_adjustment || 0])
  );
  const teamIds = db
    .all('SELECT team_id FROM team_competitions WHERE competition_id = ?', competitionId)
    .map((r) => r.team_id);
  const matches = rawResults(competitionId);

  if (comp.hasGroups) {
    const groups = new Map();
    for (const m of matches) {
      const key = m.group_name || 'Group A';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    const teamGroups = new Map(
      db
        .all(
          `SELECT DISTINCT m.group_name g, m.home_team_id t FROM matches m WHERE m.competition_id = ?
           UNION
           SELECT DISTINCT m.group_name g, m.away_team_id t FROM matches m WHERE m.competition_id = ?`,
          competitionId,
          competitionId
        )
        .map((r) => [r.t, r.g || 'Group A'])
    );
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, ms]) => {
        const ids = [...new Set([...teamGroups.entries()].filter(([, g]) => g === name).map(([t]) => t))];
        const rows = buildTable(
          ms.filter((m) => ids.includes(m.home_team_id) && ids.includes(m.away_team_id)),
          { teams: ids, points, adjustments }
        );
        rows.forEach((r) => {
          r._zones = comp.zones;
          r.zone = zoneFor(r.position, comp.zones);
        });
        return { name, rows };
      });
  }

  const rows = buildTable(matches, { teams: teamIds, points, adjustments });
  rows.forEach((r) => {
    r.zone = zoneFor(r.position, comp.zones);
  });
  return [{ name: comp.stage || 'Table', rows }];
}

/* ------------------------------------------------------------------ */
/* scorers / assists                                                   */
/* ------------------------------------------------------------------ */

function scorerBoard(competitionId, limit = 25) {
  const params = [];
  let where = `e.type IN ('goal','penalty')`;
  if (competitionId) {
    where += ` AND m.competition_id = ?`;
    params.push(competitionId);
  }
  const goals = db.all(
    `SELECT e.player_id pid, p.team_id tid, COUNT(*) n,
            SUM(CASE WHEN e.type = 'penalty' THEN 1 ELSE 0 END) pens
     FROM match_events e
     JOIN matches m ON m.id = e.match_id
     JOIN players p ON p.id = e.player_id
     WHERE ${where} AND e.player_id IS NOT NULL
     GROUP BY e.player_id`,
    ...params
  );
  const assists = db.all(
    `SELECT e.secondary_player_id pid, COUNT(*) n
     FROM match_events e
     JOIN matches m ON m.id = e.match_id
     WHERE ${where} AND e.secondary_player_id IS NOT NULL
     GROUP BY e.secondary_player_id`,
    ...params
  );
  const own = db.all(
    `SELECT e.player_id pid, COUNT(*) n
     FROM match_events e
     JOIN matches m ON m.id = e.match_id
     WHERE e.type = 'own_goal' ${competitionId ? 'AND m.competition_id = ?' : ''}
     GROUP BY e.player_id`,
    ...(competitionId ? [competitionId] : [])
  );
  const apps = db.all(
    `SELECT l.player_id pid, COUNT(*) n,
            SUM(CASE WHEN l.is_starting = 1 THEN 1 ELSE 0 END) starts
     FROM lineups l
     JOIN matches m ON m.id = l.match_id
     WHERE m.status IN ${PLAYED_SQL} ${competitionId ? 'AND m.competition_id = ?' : ''}
     GROUP BY l.player_id`,
    ...(competitionId ? [competitionId] : [])
  );
  const cards = db.all(
    `SELECT e.player_id pid,
            SUM(CASE WHEN e.type IN ('yellow','second_yellow') THEN 1 ELSE 0 END) y,
            SUM(CASE WHEN e.type IN ('red','second_yellow') THEN 1 ELSE 0 END) r
     FROM match_events e
     JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('yellow','red','second_yellow') ${competitionId ? 'AND m.competition_id = ?' : ''}
     GROUP BY e.player_id`,
    ...(competitionId ? [competitionId] : [])
  );

  const idx = new Map();
  const bump = (pid, patch) => {
    if (!pid) return;
    if (!idx.has(pid)) {
      idx.set(pid, { playerId: pid, goals: 0, assists: 0, ownGoals: 0, appearances: 0, starts: 0, penalties: 0, yellow: 0, red: 0 });
    }
    Object.assign(idx.get(pid), patch);
  };
  for (const r of goals) bump(r.pid, { goals: r.n, penalties: r.pens || 0 });
  for (const r of assists) bump(r.pid, { assists: r.n });
  for (const r of own) bump(r.pid, { ownGoals: r.n });
  for (const r of apps) bump(r.pid, { appearances: r.n, starts: r.starts || 0 });
  for (const r of cards) bump(r.pid, { yellow: r.y || 0, red: r.r || 0 });

  const out = [...idx.values()]
    .map((r) => {
      const p = playerRow(r.playerId);
      return { ...r, player: p, team: p ? teamBrief(p.teamId) : null };
    })
    .filter((r) => r.player);
  out.sort((a, b) => b.goals - a.goals || b.assists - a.assists || (a.player?.name || '').localeCompare(b.player?.name || ''));
  return limit ? out.slice(0, limit) : out;
}

function assistBoard(competitionId, limit = 25) {
  return scorerBoard(competitionId, null)
    .slice()
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* competition detail                                                  */
/* ------------------------------------------------------------------ */

function competitionDetail(competitionId) {
  const competition = competitionRow(competitionId);
  if (!competition) return null;
  const matches = matchesByCompetition(competitionId, { includeCompetition: false, teamsAsIds: true });
  const tables = competitionTables(competitionId) || [];

  return {
    competition,
    tables,
    matches,
    topScorers: scorerBoard(competitionId, 30),
    topAssists: assistBoard(competitionId, 30),
    teams: db
      .all('SELECT team_id FROM team_competitions WHERE competition_id = ?', competitionId)
      .map((r) => teamBrief(r.team_id))
      .filter(Boolean),
    generatedAt: db.updatedAt(),
  };
}

/* ------------------------------------------------------------------ */
/* match detail                                                        */
/* ------------------------------------------------------------------ */

function matchDetail(matchId) {
  const row = db.get('SELECT * FROM matches WHERE id = ?', matchId);
  if (!row) return null;
  const m = mapMatch(row);
  const summary = matchSummary(m);

  const events = db
    .all('SELECT * FROM match_events WHERE match_id = ? ORDER BY minute, added_time, id', matchId)
    .map((e) => {
      const p = playerRow(e.player_id);
      const sp = playerRow(e.secondary_player_id);
      return {
        id: e.id,
        type: e.type,
        minute: e.minute,
        addedTime: e.added_time || 0,
        teamId: e.team_id,
        playerId: e.player_id,
        playerName: p ? p.name : null,
        secondaryPlayerId: e.secondary_player_id,
        secondaryName: sp ? sp.name : null,
        note: e.note || '',
      };
    });

  // running score line for each event
  let h = 0;
  let a = 0;
  for (const e of events) {
    const isHome = e.teamId === m.homeTeamId;
    if (['goal', 'penalty'].includes(e.type)) {
      if (isHome) h += 1;
      else a += 1;
    } else if (e.type === 'own_goal') {
      if (isHome) a += 1;
      else h += 1;
    }
    e.scoreAfter = { home: h, away: a };
  }

  const lineupRows = db.all('SELECT * FROM lineups WHERE match_id = ? ORDER BY team_id, is_starting DESC, shirt_number', matchId);
  const shape = (teamId) =>
    lineupRows
      .filter((l) => l.team_id === teamId)
      .map((l) => {
        const p = playerRow(l.player_id);
        return {
          playerId: l.player_id,
          name: p ? p.name : 'Unknown',
          position: l.position || (p ? p.position : ''),
          shirtNumber: l.shirt_number ?? (p ? p.shirt_number : null),
          isStarting: !!l.is_starting,
          isCaptain: !!l.is_captain,
          minuteOn: l.minute_on,
          minuteOff: l.minute_off,
        };
      })
      .sort((x, y) => (y.isStarting - x.isStarting) || (x.shirtNumber || 99) - (y.shirtNumber || 99));

  const statRows = db.all('SELECT * FROM match_stats WHERE match_id = ?', matchId);
  const statFor = (teamId) => {
    const s = statRows.find((r) => r.team_id === teamId);
    if (!s) return null;
    return {
      possession: s.possession,
      shots: s.shots,
      shotsOnTarget: s.shots_on_target,
      corners: s.corners,
      fouls: s.fouls,
      yellowCards: s.yellow_cards,
      redCards: s.red_cards,
      offsides: s.offsides,
      passes: s.passes,
      passAccuracy: s.pass_accuracy,
      tackles: s.tackles,
      saves: s.saves,
      bigChances: s.big_chances,
      xg: s.xg,
    };
  };

  const h2hRows = db.all(
    `SELECT * FROM matches
     WHERE status IN ('ft','ht','live')
       AND ((home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?))
     ORDER BY kickoff DESC LIMIT 6`,
    m.homeTeamId,
    m.awayTeamId,
    m.awayTeamId,
    m.homeTeamId
  );
  const h2h = {
    matches: matchSummaries(h2hRows),
    summary: { homeWins: 0, draws: 0, awayWins: 0 },
  };
  for (const r of h2hRows) {
    const homeIsA = r.home_team_id === m.awayTeamId;
    const aScore = homeIsA ? r.home_score : r.away_score;
    const bScore = homeIsA ? r.away_score : r.home_score;
    if (aScore > bScore) h2h.summary.awayWins += 1;
    else if (aScore < bScore) h2h.summary.homeWins += 1;
    else h2h.summary.draws += 1;
  }

  return {
    ...summary,
    events,
    lineups: { home: shape(m.homeTeamId), away: shape(m.awayTeamId) },
    stats: { home: statFor(m.homeTeamId), away: statFor(m.awayTeamId) },
    h2h,
    generatedAt: db.updatedAt(),
  };
}

/* ------------------------------------------------------------------ */
/* team detail                                                         */
/* ------------------------------------------------------------------ */

function teamDetail(teamId) {
  const team = teamRow(teamId);
  if (!team) return null;

  const players = db
    .all('SELECT * FROM players WHERE team_id = ? ORDER BY shirt_number', teamId)
    .map(mapPlayer);

  // season stats for every squad member, across all competitions
  const stats = new Map();
  const add = (pid, patch) => {
    if (!stats.has(pid)) stats.set(pid, { goals: 0, assists: 0, appearances: 0, starts: 0, yellow: 0, red: 0 });
    Object.assign(stats.get(pid), patch);
  };
  for (const r of db.all(
    `SELECT e.player_id pid, COUNT(*) n FROM match_events e JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('goal','penalty') AND m.status IN ${PLAYED_SQL} AND e.player_id IN (SELECT id FROM players WHERE team_id = ?)
     GROUP BY e.player_id`,
    teamId
  )) add(r.pid, { goals: r.n });
  for (const r of db.all(
    `SELECT e.secondary_player_id pid, COUNT(*) n FROM match_events e JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('goal','penalty') AND m.status IN ${PLAYED_SQL} AND e.secondary_player_id IN (SELECT id FROM players WHERE team_id = ?)
     GROUP BY e.secondary_player_id`,
    teamId
  )) add(r.pid, { assists: r.n });
  for (const r of db.all(
    `SELECT l.player_id pid, COUNT(*) n, SUM(l.is_starting) s FROM lineups l JOIN matches m ON m.id = l.match_id
     WHERE m.status IN ${PLAYED_SQL} AND l.player_id IN (SELECT id FROM players WHERE team_id = ?)
     GROUP BY l.player_id`,
    teamId
  )) add(r.pid, { appearances: r.n, starts: r.s || 0 });
  for (const r of db.all(
    `SELECT e.player_id pid,
       SUM(CASE WHEN e.type IN ('yellow','second_yellow') THEN 1 ELSE 0 END) y,
       SUM(CASE WHEN e.type IN ('red','second_yellow') THEN 1 ELSE 0 END) r
     FROM match_events e JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('yellow','red','second_yellow') AND m.status IN ${PLAYED_SQL}
       AND e.player_id IN (SELECT id FROM players WHERE team_id = ?)
     GROUP BY e.player_id`,
    teamId
  )) add(r.pid, { yellow: r.y || 0, red: r.r || 0 });

  const squad = players.map((p) => ({ ...p, stats: stats.get(p.id) || { goals: 0, assists: 0, appearances: 0, starts: 0, yellow: 0, red: 0 } }));

  const all = matchesByTeam(teamId);
  const nowIso = new Date().toISOString();
  const results = all
    .filter((m) => ['ft', 'postponed'].includes(m.status) && m.kickoff <= nowIso)
    .slice()
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 15);
  const upcoming = all
    .filter((m) => !['ft', 'postponed', 'cancelled'].includes(m.status))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(0, 12);

  const compIds = [...new Set(all.map((m) => m.competition.id))];
  const competitions = compIds.map(competitionRow).filter(Boolean).map((c) => {
    const rows = (competitionTables(c.id) || [{ rows: [] }])[0].rows;
    const row = rows.find((r) => r.teamId === teamId);
    return { ...c, tableRow: row || null };
  });

  const form = results
    .slice(0, 5)
    .reverse()
    .map((m) => {
      const isHome = m.home.team.id === teamId;
      const gf = isHome ? m.home.score : m.away.score;
      const ga = isHome ? m.away.score : m.home.score;
      return gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    });

  return {
    team,
    squad,
    results,
    upcoming,
    competitions,
    form,
    generatedAt: db.updatedAt(),
  };
}

/* ------------------------------------------------------------------ */
/* player detail                                                       */
/* ------------------------------------------------------------------ */

function playerDetail(playerId) {
  const player = playerRow(playerId);
  if (!player) return null;
  const team = teamBrief(player.teamId);

  const goals = db.all(
    `SELECT e.*, m.kickoff, m.competition_id, m.home_team_id, m.away_team_id, m.id mid
     FROM match_events e JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('goal','penalty') AND e.player_id = ?
     ORDER BY m.kickoff DESC`,
    playerId
  );
  const apps = db.get(
    `SELECT COUNT(*) n, SUM(l.is_starting) s FROM lineups l JOIN matches m ON m.id = l.match_id
     WHERE m.status IN ${PLAYED_SQL} AND l.player_id = ?`,
    playerId
  );
  const assists = db.get(
    `SELECT COUNT(*) n FROM match_events e JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('goal','penalty') AND e.secondary_player_id = ? AND m.status IN ${PLAYED_SQL}`,
    playerId
  );
  const cards = db.get(
    `SELECT SUM(CASE WHEN e.type IN ('yellow','second_yellow') THEN 1 ELSE 0 END) y,
            SUM(CASE WHEN e.type IN ('red','second_yellow') THEN 1 ELSE 0 END) r
     FROM match_events e JOIN matches m ON m.id = e.match_id
     WHERE e.type IN ('yellow','red','second_yellow') AND e.player_id = ? AND m.status IN ${PLAYED_SQL}`,
    playerId
  );

  const goalLog = goals.map((g) => {
    const opponentId = g.home_team_id === player.teamId ? g.away_team_id : g.home_team_id;
    return {
      matchId: g.mid,
      competitionId: g.competition_id,
      competitionName: competitionRow(g.competition_id)?.shortName || '',
      kickoff: g.kickoff,
      minute: g.minute,
      type: g.type,
      opponentId,
      opponentName: teamBrief(opponentId)?.shortName || '',
      home: g.home_team_id === player.teamId,
    };
  });

  const byComp = new Map();
  for (const g of goals) {
    if (!byComp.has(g.competition_id)) {
      const c = competitionRow(g.competition_id);
      byComp.set(g.competition_id, {
        competition: c ? { id: c.id, name: c.name, shortName: c.shortName, color: c.color, emblem: c.emblem } : null,
        goals: 0,
      });
    }
    byComp.get(g.competition_id).goals += 1;
  }

  return {
    player,
    team,
    stats: {
      goals: goals.length,
      assists: assists?.n || 0,
      appearances: apps?.n || 0,
      starts: apps?.s || 0,
      yellowCards: cards?.y || 0,
      redCards: cards?.r || 0,
    },
    goalLog,
    byCompetition: [...byComp.values()],
    generatedAt: db.updatedAt(),
  };
}

/* ------------------------------------------------------------------ */
/* search                                                              */
/* ------------------------------------------------------------------ */

function searchIndex() {
  return {
    generatedAt: db.updatedAt(),
    competitions: listCompetitions().map((c) => ({ id: c.id, type: 'competition', name: c.name, sub: `${c.country} · ${c.season}`, emblem: c.emblem, color: c.color })),
    teams: listTeams().map((t) => ({ id: t.id, type: 'team', name: t.name, sub: t.country || t.city || '', emblem: t.emblem, color: t.color })),
    players: listPlayers().map((p) => ({
      id: p.id,
      type: 'player',
      name: p.name,
      sub: teamRow(p.teamId)?.name || '',
      teamId: p.teamId,
      position: p.position,
    })),
  };
}

module.exports = {
  PLAYED,
  teamBrief,
  bootstrap,
  homeFeed,
  liveMatches,
  listCompetitions,
  listTeams,
  listPlayers,
  matchesByCompetition,
  matchesByTeam,
  competitionDetail,
  competitionTables,
  matchDetail,
  teamDetail,
  playerDetail,
  scorerBoard,
  assistBoard,
  searchIndex,
  clearCache,
  teamRow,
  playerRow,
  competitionRow,
};
