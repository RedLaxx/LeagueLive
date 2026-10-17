'use strict';

// Anchor the demo calendar to Nigerian time so "today" matches the user's day.
process.env.TZ = process.env.TZ || 'Africa/Lagos';

const db = require('../server/db');
const transfer = require('../server/transfer');
const { competitions, clubs, uclEntrants, POOLS, MANAGERS } = require('./seed-data');

/* ------------------------------------------------------------------ */
/* deterministic rng                                                   */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261017);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ */
/* per-competition plan for the matches happening today                */
/* offsets are minutes relative to "now"                               */
/* ------------------------------------------------------------------ */

const TODAY_PLAN = {
  epl: [
    { o: -320, s: 'ft' },
    { o: -165, s: 'ft' },
    { o: -78, s: 'live' },
    { o: -40, s: 'live' },
    { o: -52, s: 'ht' },
    { o: 45, s: 'scheduled' },
    { o: 190, s: 'scheduled' },
  ],
  laliga: [
    { o: -300, s: 'ft' },
    { o: -70, s: 'live' },
    { o: -52, s: 'ht' },
    { o: 60, s: 'scheduled' },
  ],
  seriea: [
    { o: -290, s: 'ft' },
    { o: 50, s: 'scheduled' },
    { o: 150, s: 'scheduled' },
  ],
  bundesliga: [
    { o: -260, s: 'ft' },
    { o: 35, s: 'scheduled' },
    { o: 170, s: 'scheduled' },
  ],
  npfl: [
    { o: -72, s: 'live' },
    { o: -56, s: 'ht' },
    { o: 70, s: 'scheduled' },
    { o: 220, s: 'scheduled' },
  ],
  ucl: [
    { o: -64, s: 'live' },
    { o: -38, s: 'live' },
    { o: 80, s: 'scheduled' },
    { o: 260, s: 'scheduled' },
  ],
};

const KICKOFF_HOURS = [13, 15, 17, 19, 20];

/* ------------------------------------------------------------------ */
/* name generation                                                     */
/* ------------------------------------------------------------------ */

function pickPoolKey(mix) {
  const entries = Object.entries(mix);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

const usedNames = new Set();

function makeName(mix) {
  const key = pickPoolKey(mix);
  const pool = POOLS[key];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const first = pick(pool.first);
    const last = pick(pool.last);
    const name = `${first} ${last}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      const nationality = pool.nationalities
        ? pick(pool.nationalities)
        : pool.nationality;
      return { name, nationality };
    }
  }
  const first = pick(pool.first);
  const last = pick(pool.last);
  const name = `${first} ${last}`;
  usedNames.add(name);
  return { name, nationality: pool.nationality };
}

/* ------------------------------------------------------------------ */
/* squads                                                              */
/* ------------------------------------------------------------------ */

const SHAPE = [
  ['GK', 2],
  ['DF', 6],
  ['MF', 6],
  ['FW', 4],
];

function buildSquad(teamId, mix) {
  const players = [];
  const numbers = shuffle(
    Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => n !== 1 && n !== 13)
  );
  let n = 0;
  SHAPE.forEach(([position, count]) => {
    for (let i = 0; i < count; i += 1) {
      const { name, nationality } = makeName(mix);
      let shirt;
      if (position === 'GK') shirt = i === 0 ? 1 : 13;
      else shirt = numbers[n++] || 30 + i;
      const age =
        position === 'GK' ? int(22, 36) : position === 'DF' ? int(19, 33) : int(18, 32);
      players.push({
        id: `${teamId}_p${players.length + 1}`,
        team_id: teamId,
        name,
        position,
        shirt_number: shirt,
        nationality,
        age,
        photo: null,
        updated_at: new Date().toISOString(),
      });
    }
  });
  return players;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

function roundRobin(teamIds, double) {
  const list = teamIds.slice();
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const arr = list.slice();
  const rounds = [];
  for (let r = 0; r < n - 1; r += 1) {
    const pairs = [];
    for (let i = 0; i < n / 2; i += 1) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (!home || !away) continue;
      const flip = (r + i) % 2 === 1;
      pairs.push(flip ? { home: away, away: home } : { home, away });
    }
    rounds.push(pairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }
  if (!double) return rounds;
  return [...rounds, ...rounds.map((pairs) => pairs.map((p) => ({ home: p.away, away: p.home })))];
}

/* ------------------------------------------------------------------ */
/* match simulation                                                    */
/* ------------------------------------------------------------------ */

function pickLineup(squad) {
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) byPos[p.position].push(p);
  const starters = [];
  const take = (pos, count) => {
    for (let i = 0; i < count && byPos[pos].length; i += 1) starters.push(byPos[pos].shift());
  };
  take('GK', 1);
  take('DF', 4);
  take('MF', 3);
  take('FW', 3);
  // fill any gap (small squads) with whoever is left
  const rest = [...byPos.GK, ...byPos.DF, ...byPos.MF, ...byPos.FW];
  while (starters.length < 11 && rest.length) starters.push(rest.shift());
  const bench = rest.slice(0, 7);
  return { starters, bench };
}

function weightedPlayer(players, rndVal) {
  // forwards score most, then midfielders, then defenders
  const weights = { FW: 0.46, MF: 0.34, DF: 0.16, GK: 0.04 };
  const total = players.reduce((s, p) => s + (weights[p.position] || 0.05), 0);
  let r = rndVal * total;
  for (const p of players) {
    r -= weights[p.position] || 0.05;
    if (r <= 0) return p;
  }
  return players[players.length - 1];
}

function simulate(matchId, home, away, { minute, span }) {
  const homeLineup = pickLineup(home.squad);
  const awayLineup = pickLineup(away.squad);
  const events = [];

  const ratio = home.strength / away.strength;
  const hg = clamp(Math.round(1.35 * Math.pow(ratio, 0.75) * span + (rnd() - 0.45) * 2), 0, 6);
  const ag = clamp(Math.round(1.05 * Math.pow(1 / ratio, 0.75) * span + (rnd() - 0.45) * 2), 0, 6);

  const goalMinutes = (count) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      let m = int(3, Math.max(4, minute));
      if (rnd() < 0.12) m = Math.max(m, Math.max(4, minute)); // late goal
      out.push(m);
    }
    return out.sort((a, b) => a - b);
  };

  const homeGoals = goalMinutes(hg);
  const awayGoals = goalMinutes(ag);

  for (const m of homeGoals) {
    events.push({
      kind: 'goal',
      team: 'home',
      minute: m,
      scorer: weightedPlayer(homeLineup.starters, rnd()),
      assist: rnd() < 0.72 ? weightedPlayer(homeLineup.starters.filter((p) => p.position !== 'GK'), rnd()) : null,
      penalty: rnd() < 0.14,
    });
  }
  for (const m of awayGoals) {
    events.push({
      kind: 'goal',
      team: 'away',
      minute: m,
      scorer: weightedPlayer(awayLineup.starters, rnd()),
      assist: rnd() < 0.72 ? weightedPlayer(awayLineup.starters.filter((p) => p.position !== 'GK'), rnd()) : null,
      penalty: rnd() < 0.14,
    });
  }

  // cards
  const cardCount = int(0, 4);
  for (let i = 0; i < cardCount; i += 1) {
    const side = rnd() < 0.5 ? 'home' : 'away';
    const lineup = side === 'home' ? homeLineup : awayLineup;
    const player = weightedPlayer(lineup.starters.filter((p) => p.position !== 'GK'), rnd());
    if (!player) continue;
    const red = rnd() < 0.05;
    events.push({
      kind: red ? 'red' : 'yellow',
      team: side,
      minute: int(10, Math.max(12, minute)),
      scorer: player,
      assist: null,
    });
  }

  // substitutions
  const subCount = clamp(Math.round((minute / 90) * int(2, 5)), 0, 5);
  const usedBench = new Set();
  const usedOff = new Set();
  for (let i = 0; i < subCount; i += 1) {
    const side = rnd() < 0.5 ? 'home' : 'away';
    const lineup = side === 'home' ? homeLineup : awayLineup;
    const off = lineup.starters.filter((p) => p.position !== 'GK' && !usedOff.has(p.id));
    const on = lineup.bench.filter((p) => !usedBench.has(p.id));
    if (!off.length || !on.length) continue;
    const playerOff = pick(off);
    const playerOn = pick(on);
    usedOff.add(playerOff.id);
    usedBench.add(playerOn.id);
    const at = int(55, Math.max(58, minute));
    events.push({ kind: 'sub', team: side, minute: at, scorer: playerOn, assist: playerOff });
  }

  events.sort((a, b) => a.minute - b.minute);

  const rows = [];
  let hs = 0;
  let as = 0;
  let hsHt = 0;
  let asHt = 0;

  for (const e of events) {
    const isHome = e.team === 'home';
    const teamId = isHome ? home.id : away.id;
    if (e.kind === 'goal') {
      if (isHome) hs += 1;
      else as += 1;
      if (e.minute <= 45) {
        if (isHome) hsHt += 1;
        else asHt += 1;
      }
      rows.push({
        match_id: matchId,
        type: e.penalty ? 'penalty' : 'goal',
        minute: e.minute,
        added_time: 0,
        team_id: teamId,
        player_id: e.scorer.id,
        secondary_player_id: e.assist && e.assist.id !== e.scorer.id ? e.assist.id : null,
        note: null,
      });
    } else if (e.kind === 'yellow' || e.kind === 'red') {
      rows.push({
        match_id: matchId,
        type: e.kind,
        minute: e.minute,
        added_time: 0,
        team_id: teamId,
        player_id: e.scorer.id,
        secondary_player_id: null,
        note: null,
      });
    } else if (e.kind === 'sub') {
      rows.push({
        match_id: matchId,
        type: 'sub',
        minute: e.minute,
        added_time: 0,
        team_id: teamId,
        player_id: e.scorer.id,
        secondary_player_id: e.assist.id,
        note: null,
      });
    }
  }

  const yellow = (side) => rows.filter((r) => r.type === 'yellow' && r.team_id === (side === 'home' ? home.id : away.id)).length;
  const red = (side) => rows.filter((r) => r.type === 'red' && r.team_id === (side === 'home' ? home.id : away.id)).length;

  return {
    events: rows,
    homeScore: hs,
    awayScore: as,
    homeScoreHT: hsHt,
    awayScoreHT: asHt,
    lineups: { home: homeLineup, away: awayLineup },
    yellows: { home: yellow('home'), away: yellow('away') },
    reds: { home: red('home'), away: red('away') },
  };
}

function buildStats(sim, home, away, minute) {
  const span = clamp(minute / 90, 0.15, 1);
  const ratio = home.strength / away.strength;
  const homePoss = clamp(Math.round(50 + (ratio - 1) * 45 + (rnd() - 0.5) * 8), 28, 72);
  const awayPoss = 100 - homePoss;
  const homeShots = clamp(Math.round((10 + (ratio - 1) * 12) * span + rnd() * 6), 2, 30);
  const awayShots = clamp(Math.round((10 + (1 / ratio - 1) * 12) * span + rnd() * 6), 2, 30);

  const mk = (poss, shots, goals, reds, yellows) => {
    const onTarget = clamp(Math.round(shots * (0.32 + rnd() * 0.2)) + goals, goals, shots);
    return {
      possession: poss,
      shots,
      shots_on_target: onTarget,
      corners: clamp(Math.round(shots * 0.45 + rnd() * 3), 0, 16),
      fouls: clamp(Math.round(8 + rnd() * 10 - reds), 3, 24),
      yellow_cards: yellows,
      red_cards: reds,
      offsides: int(0, 5),
      passes: clamp(Math.round(poss * 9 + rnd() * 120), 80, 950),
      pass_accuracy: clamp(Math.round(72 + rnd() * 18), 60, 94),
      tackles: int(8, 26),
      saves: clamp(Math.round(onTarget - goals + rnd() * 2), 0, 12),
      big_chances: clamp(goals + int(0, 3), 0, 9),
      xg: Number((goals * 0.35 + shots * 0.065 + rnd() * 0.4).toFixed(2)),
    };
  };

  return {
    home: mk(homePoss, homeShots, sim.homeScore, sim.reds.home, sim.yellows.home),
    away: mk(awayPoss, awayShots, sim.awayScore, sim.reds.away, sim.yellows.away),
  };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function seedDatabase({ force = false } = {}) {
  db.connect();
  const d = db.db();
  let matchCount = 0;
  let simulated = 0;

  if (!force && transfer.isEmpty()) {
    // empty database -> continue
  } else if (!force) {
    return { skipped: true };
  }

  const nowIso = () => new Date().toISOString();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const insertPlayer = d.prepare(
    `INSERT INTO players (id, team_id, name, position, shirt_number, nationality, age, photo, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );
  const insertMatch = d.prepare(
    `INSERT INTO matches (id, competition_id, round, group_name, home_team_id, away_team_id, kickoff, status,
       minute, added_time, home_score, away_score, home_score_ht, away_score_ht, home_pen, away_pen,
       venue, referee, attendance, note, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertEvent = d.prepare(
    `INSERT INTO match_events (match_id, type, minute, added_time, team_id, player_id, secondary_player_id, note)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const insertLineup = d.prepare(
    `INSERT INTO lineups (match_id, team_id, player_id, is_starting, is_captain, position, shirt_number, minute_on, minute_off)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );
  const insertStats = d.prepare(
    `INSERT INTO match_stats (match_id, team_id, possession, shots, shots_on_target, corners, fouls,
       yellow_cards, red_cards, offsides, passes, pass_accuracy, tackles, saves, big_chances, xg)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  db.transaction(() => {
    d.exec('PRAGMA foreign_keys = OFF');
    for (const t of ['lineups', 'match_stats', 'match_events', 'matches', 'players', 'team_competitions', 'teams', 'competitions']) {
      d.exec(`DELETE FROM ${t}`);
    }

    /* competitions */
    competitions.forEach((c, i) => {
      d.prepare(
        `INSERT INTO competitions (id, name, short_name, country, season, type, stage, color, emblem,
           points_win, points_draw, points_loss, has_groups, zones, sort_order, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        c.id,
        c.name,
        c.shortName,
        c.country,
        c.season,
        c.type,
        c.stage,
        c.color,
        c.emblem,
        3,
        1,
        0,
        0,
        JSON.stringify(c.zones || []),
        i,
        nowIso()
      );
    });

    /* teams */
    const teamIdsByComp = {};
    const managersByCountry = {};
    for (const c of clubs) {
      const id = `t_${db.slug(c.name)}`;
      const pool = MANAGERS[c.country] || MANAGERS.Europe;
      if (!managersByCountry[c.country]) managersByCountry[c.country] = shuffle(pool.slice());
      const manager = managersByCountry[c.country].pop() || pool[0];
      d.prepare(
        `INSERT INTO teams (id, name, short_name, code, color, emblem, venue, city, country, manager, founded, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, c.name, c.name, c.code, c.color, null, c.venue, c.city, c.country, manager, c.founded, nowIso());
      (teamIdsByComp[c.comp] = teamIdsByComp[c.comp] || []).push(id);
    }

    /* team <-> competition links */
    const link = (teamId, compId, order) =>
      d.prepare('INSERT OR IGNORE INTO team_competitions (team_id, competition_id, points_adjustment, sort_order) VALUES (?,?,0,?)').run(teamId, compId, order);
    for (const [comp, ids] of Object.entries(teamIdsByComp)) ids.forEach((id, i) => link(id, comp, i));
    uclEntrants.forEach((name, i) => link(`t_${db.slug(name)}`, 'ucl', i));

    /* players + squads in memory */
    const squads = new Map();
    const strengths = new Map();
    for (const c of competitions) {
      const ids = [...(teamIdsByComp[c.id] || [])];
      if (c.id === 'ucl') {
        for (const name of uclEntrants) ids.push(`t_${db.slug(name)}`);
      }
      for (const teamId of ids) {
        if (squads.has(teamId)) continue;
        const club = clubs.find((x) => `t_${db.slug(x.name)}` === teamId);
        const mix = c.mix;
        const squad = buildSquad(teamId, mix);
        for (const p of squad) {
          insertPlayer.run(p.id, p.team_id, p.name, p.position, p.shirt_number, p.nationality, p.age, p.photo, p.updated_at);
        }
        squads.set(teamId, squad);
        // Nigerian clubs and the traditional powers get a small strength nudge
        const base = 0.55 + rnd() * 0.4;
        const boost = club && ['epl', 'laliga', 'seriea', 'bundesliga', 'ucl'].includes(c.id) ? 0.06 : 0;
        strengths.set(teamId, Number((base + boost).toFixed(3)));
      }
    }

    /* fixtures + results */
    const referees = ['M. Okonkwo', 'A. Hartley', 'D. Marchetti', 'S. Vardar', 'L. Bergqvist', 'R. Adeyemi', 'P. Lindqvist', 'J. Ferreira'];

    for (const c of competitions) {
      const ids = c.id === 'ucl' ? uclEntrants.map((n) => `t_${db.slug(n)}`) : teamIdsByComp[c.id] || [];
      if (ids.length < 2) continue;
      const rounds = roundRobin(ids, c.doubleRound);
      const start = new Date(today.getTime() - c.roundsPlayed * c.intervalDays * 864e5);

      rounds.forEach((pairs, roundIndex) => {
        const day = new Date(start.getTime() + roundIndex * c.intervalDays * 864e5);
        const isToday = roundIndex === c.roundsPlayed;
        const plan = TODAY_PLAN[c.id] || [];

        pairs.forEach((pair, i) => {
          let kickoff;
          let status = 'scheduled';
          let minute = null;
          let span = 1;

          if (isToday) {
            const slot = plan[i];
            const offsetMin = slot ? slot.o : 90 + (i - plan.length) * 320;
            kickoff = new Date(now.getTime() + offsetMin * 60000);
            status = slot ? slot.s : 'scheduled';
            if (status === 'live') minute = clamp(Math.round(-offsetMin), 1, 96);
            else if (status === 'ht') minute = 45;
            else if (status === 'ft') minute = 90;
            span = clamp((minute || 90) / 90, 0.4, 1);
          } else if (day < today) {
            const hour = KICKOFF_HOURS[i % KICKOFF_HOURS.length];
            const dayDate = new Date(day);
            dayDate.setHours(hour, i % 2 === 0 ? 0 : 30, 0, 0);
            kickoff = dayDate;
            status = 'ft';
            minute = 90;
            span = 1;
          } else {
            const hour = KICKOFF_HOURS[i % KICKOFF_HOURS.length];
            const dayDate = new Date(day);
            dayDate.setHours(hour, i % 2 === 0 ? 30 : 0, 0, 0);
            kickoff = dayDate;
            status = 'scheduled';
            minute = null;
          }

          const matchId = `m_${c.id}_r${roundIndex + 1}_${i}`;
          const home = {
            id: pair.home,
            squad: squads.get(pair.home) || [],
            strength: strengths.get(pair.home) || 0.7,
          };
          const away = {
            id: pair.away,
            squad: squads.get(pair.away) || [],
            strength: strengths.get(pair.away) || 0.7,
          };
          const venue = clubs.find((x) => `t_${db.slug(x.name)}` === pair.home)?.venue || '';

          let hs = 0;
          let as = 0;
          let hsHt = null;
          let asHt = null;

          insertMatch.run(
            matchId,
            c.id,
            String(roundIndex + 1),
            null,
            pair.home,
            pair.away,
            kickoff.toISOString(),
            status,
            minute,
            0,
            hs,
            as,
            null,
            null,
            null,
            null,
            venue,
            pick(referees),
            c.id === 'npfl' ? int(3000, 22000) : int(18000, 74000),
            null,
            nowIso()
          );
          matchCount += 1;

          if (['ft', 'live', 'ht'].includes(status) && home.squad.length && away.squad.length) {
            const sim = simulate(matchId, home, away, { minute: minute || 90, span });
            hs = sim.homeScore;
            as = sim.awayScore;
            hsHt = sim.homeScoreHT;
            asHt = sim.awayScoreHT;
            d.prepare('UPDATE matches SET home_score=?, away_score=?, home_score_ht=?, away_score_ht=? WHERE id=?').run(
              hs,
              as,
              hsHt,
              asHt,
              matchId
            );
            for (const e of sim.events) {
              insertEvent.run(e.match_id, e.type, e.minute, e.added_time, e.team_id, e.player_id, e.secondary_player_id, e.note);
            }
            const write = (lineup, teamId) => {
              lineup.starters.forEach((p, idx) => {
                const sub = sim.events.find((e) => e.type === 'sub' && e.secondary_player_id === p.id);
                insertLineup.run(matchId, teamId, p.id, 1, idx === 2 ? 1 : 0, p.position, p.shirt_number, 0, sub ? sub.minute : null);
              });
              lineup.bench.forEach((p) => {
                const on = sim.events.find((e) => e.type === 'sub' && e.player_id === p.id);
                insertLineup.run(matchId, teamId, p.id, 0, 0, p.position, p.shirt_number, on ? on.minute : null, null);
              });
            };
            write(sim.lineups.home, home.id);
            write(sim.lineups.away, away.id);
            const stats = buildStats(sim, home, away, minute || 90);
            for (const side of ['home', 'away']) {
              const s = stats[side];
              insertStats.run(
                matchId,
                side === 'home' ? home.id : away.id,
                s.possession,
                s.shots,
                s.shots_on_target,
                s.corners,
                s.fouls,
                s.yellow_cards,
                s.red_cards,
                s.offsides,
                s.passes,
                s.pass_accuracy,
                s.tackles,
                s.saves,
                s.big_chances,
                s.xg
              );
            }
            simulated += 1;
          }
        });
      });
    }

    d.exec('PRAGMA foreign_keys = ON');
    console.log(`[LeagueLive] Seeded ${matchCount} matches, simulated ${simulated}.`);
  });

  db.touch();
  return { skipped: false, matches: matchCount, simulated };
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  const result = seedDatabase({ force });
  if (result.skipped) {
    console.log('[LeagueLive] Database already has data. Use `npm run reset` to start over.');
  } else {
    console.log('[LeagueLive] Demo database ready at data/leaguelive.db');
  }
}

module.exports = { seedDatabase };
