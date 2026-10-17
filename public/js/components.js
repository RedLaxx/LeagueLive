/* LeagueLive — reusable renderers. */

import { esc, crest, matchTimeCell, formStrip, fmtDayLabel, fmtShortDay, fmtTime, posLabel, empty } from './util.js';

/* ------------------------------- match row ------------------------------ */

export function matchRow(match, { showCompetition = true, showDate = false, footer = '' } = {}) {
  const played = ['live', 'ht', 'ft'].includes(match.status);
  const hw = played && match.home.score > match.away.score;
  const aw = played && match.away.score > match.home.score;

  const comp = showCompetition && match.competition
    ? `<div class="mr-comp"><i class="cdot" style="background:${esc(match.competition.color)}"></i>${esc(match.competition.shortName || match.competition.name)}</div>`
    : '';

  const timeCell = showDate && !played
    ? `<div class="mr-time">${esc(fmtShortDay(match.kickoff))}<span class="mr-date">${esc(fmtTime(match.kickoff))}</span></div>`
    : `<div class="mr-time">${matchTimeCell(match)}</div>`;

  return `
    <a class="matchrow" href="#/match/${encodeURIComponent(match.id)}">
      ${comp}
      <div class="mr-body">
        ${timeCell}
        <div class="mr-teams">
          <div class="mr-team ${hw ? 'win' : played ? 'lose' : ''}">
            ${crest(match.home.team)}
            <span>${esc(match.home.team.shortName || match.home.team.name)}</span>
          </div>
          <div class="mr-team ${aw ? 'win' : played ? 'lose' : ''}">
            ${crest(match.away.team)}
            <span>${esc(match.away.team.shortName || match.away.team.name)}</span>
          </div>
        </div>
        <div class="mr-scores">
          <b class="${played ? 'on' : ''}">${played ? match.home.score : '–'}</b>
          <b class="${played ? 'on' : ''}">${played ? match.away.score : '–'}</b>
        </div>
      </div>
      ${footer ? `<div class="mr-foot">${footer}</div>` : ''}
    </a>`;
}

export function matchList(matches, opts = {}) {
  if (!matches.length) {
    return empty('No matches here', opts.emptyText || 'Try another day or competition.');
  }
  return `<div class="matchlist">${matches.map((m) => matchRow(m, opts)).join('')}</div>`;
}

/* ------------------------------ league table ---------------------------- */

export function leagueTable(rows, { highlightTeamId = null, zones = [], showForm = true } = {}) {
  if (!rows || !rows.length) return empty('Table not available yet', 'It appears once matches have been played.');

  const head = `
    <tr>
      <th class="tname">#</th>
      <th class="tname">Team</th>
      <th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th>
      ${showForm ? '<th>Form</th>' : ''}
      <th>Pts</th>
    </tr>`;

  const body = rows
    .map((r) => {
      const zone = zones.find((z) => r.position >= z.from && r.position <= z.to);
      const bar = zone ? `<i style="background:${esc(zone.color)}"></i>` : '';
      return `
      <tr class="${r.team && r.team.id === highlightTeamId ? 'me' : ''}">
        <td class="pos">${r.position}${bar}</td>
        <td class="tname"><span class="tcell">${crest(r.team, 'sm')}<span>${esc(r.team.shortName || r.team.name)}</span></span></td>
        <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
        <td>${r.gf}</td><td>${r.ga}</td><td>${r.gd > 0 ? `+${r.gd}` : r.gd}</td>
        ${showForm ? `<td>${formStrip(r.form)}</td>` : ''}
        <td class="pts">${r.points}</td>
      </tr>`;
    })
    .join('');

  return `<div class="tablewrap"><table class="ltable"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function zoneLegend(zones = []) {
  if (!zones.length) return '';
  return `<div class="zonelegend">${zones
    .map((z) => `<span><i style="background:${esc(z.color)}"></i>${esc(z.label)}</span>`)
    .join('')}</div>`;
}

/* --------------------------------- tabs --------------------------------- */

export function tabs(items, active) {
  return `<div class="tabs">${items
    .map((t) => `<button data-tab="${esc(t.id)}" class="${t.id === active ? 'active' : ''}">${esc(t.label)}</button>`)
    .join('')}</div>`;
}

/* -------------------------------- events -------------------------------- */

const ICONS = {
  goal: '<svg class="ev-ico goal" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4.5a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zM8.2 18.4l.7-3.2h2.5l3.5-5.5h-2.2l-.6 2.2H9.6l-.5 2.2h3l-.7 3.1h2.4l.5-2.2h1.9l.6-2.6h-1.9l1-1.7H8.5l-.3 1.4H6.8L6 14.7h2.2z"/></svg>',
  penalty: '<svg class="ev-ico goal" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 6.6v10.8M7.4 12h9.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  own_goal: '<svg class="ev-ico red" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l8.5 15.5h-17L12 3zm0 5.5v6m0 2.2v.6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  yellow: '<svg class="ev-ico yellow" viewBox="0 0 24 24"><rect x="6.5" y="3.5" width="11" height="17" rx="1.6" fill="currentColor"/></svg>',
  red: '<svg class="ev-ico red" viewBox="0 0 24 24"><rect x="6.5" y="3.5" width="11" height="17" rx="1.6" fill="currentColor"/></svg>',
  second_yellow: '<svg class="ev-ico red" viewBox="0 0 24 24"><rect x="4" y="3.5" width="8" height="17" rx="1.6" fill="#f6a723"/><rect x="12" y="3.5" width="8" height="17" rx="1.6" fill="#ef4444"/></svg>',
  sub: '<svg class="ev-ico sub" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10L4 7l3-3"/><path d="M4 7h9a5 5 0 015 5v5"/><path d="M17 14l3 3-3 3"/></svg>',
  var: '<svg class="ev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h3l1.5-3 1.5 6 1.5-3h3"/></svg>',
  penalty_missed: '<svg class="ev-ico red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M8 8l8 8"/></svg>',
};

export function eventIcon(type) {
  return ICONS[type] || ICONS.goal;
}

export function eventsList(events, { homeTeamId, awayTeamId }) {
  if (!events.length) {
    return empty('Nothing yet', 'Goals, cards and substitutions will show up here as they happen.');
  }
  const minute = (e) => `${e.minute}${e.addedTime ? `+${e.addedTime}` : ''}`;

  return `<div class="events">${events
    .map((e) => {
      const isHome = e.teamId === homeTeamId;
      let title = '';
      let sub = '';

      if (e.type === 'goal' || e.type === 'penalty') {
        title = `<b>${esc(e.playerName || 'Goal')}</b>${e.type === 'penalty' ? ' <span class="muted">(pen)</span>' : ''}`;
        sub = e.secondaryName ? `Assist: ${esc(e.secondaryName)}` : '';
      } else if (e.type === 'own_goal') {
        title = `<b>${esc(e.playerName || 'Player')}</b> <span class="muted">(own goal)</span>`;
      } else if (e.type === 'yellow') {
        title = `<b>${esc(e.playerName)}</b> <span class="muted">Yellow card</span>`;
      } else if (e.type === 'second_yellow') {
        title = `<b>${esc(e.playerName)}</b> <span class="muted">Second yellow</span>`;
      } else if (e.type === 'red') {
        title = `<b>${esc(e.playerName)}</b> <span class="muted">Red card</span>`;
      } else if (e.type === 'sub') {
        title = `<span class="ev-ico sub" style="display:inline-block"></span> <b>${esc(e.playerName)}</b> <span class="muted">for</span> ${esc(e.secondaryName || '—')}`;
      } else if (e.type === 'var') {
        title = `<b>VAR</b> <span class="muted">${esc(e.note || 'Decision review')}</span>`;
      } else if (e.type === 'penalty_missed') {
        title = `<b>${esc(e.playerName)}</b> <span class="muted">missed penalty</span>`;
      } else {
        title = esc(e.note || e.type);
      }

      const score = e.scoreAfter
        ? `<span class="muted tnum">${e.scoreAfter.home}–${e.scoreAfter.away}</span>`
        : '';

      return `
        <div class="ev">
          <div class="ev-min">${minute(e)}'<small>${isHome ? '' : ''}</small></div>
          <div class="ev-body">
            <div class="ev-title">${eventIcon(e.type)}${title} ${score}</div>
            ${sub ? `<div class="ev-sub">${sub}</div>` : ''}
          </div>
        </div>`;
    })
    .join('')}</div>`;
}

/* --------------------------------- stats -------------------------------- */

const STAT_ROWS = [
  ['Possession', 'possession', '%'],
  ['Shots', 'shots'],
  ['Shots on target', 'shotsOnTarget'],
  ['Big chances', 'bigChances'],
  ['Corners', 'corners'],
  ['Offsides', 'offsides'],
  ['Fouls', 'fouls'],
  ['Yellow cards', 'yellowCards'],
  ['Red cards', 'redCards'],
  ['Passes', 'passes'],
  ['Pass accuracy', 'passAccuracy', '%'],
  ['Tackles', 'tackles'],
  ['Saves', 'saves'],
  ['Expected goals (xG)', 'xg'],
];

export function statsBlock(stats, homeTeam, awayTeam) {
  if (!stats || (!stats.home && !stats.away)) {
    return empty('No stats yet', 'Team statistics appear once the match is under way.');
  }
  const h = stats.home || {};
  const a = stats.away || {};

  const rows = STAT_ROWS.map(([label, key, suffix = '']) => {
    const hv = h[key];
    const av = a[key];
    if (hv == null && av == null) return '';
    const hn = Number(hv) || 0;
    const an = Number(av) || 0;
    const total = hn + an || 1;
    const hp = Math.round((hn / total) * 100);
    const ap = 100 - hp;
    const fmt = (v) => (v == null ? '–' : key === 'xg' ? Number(v).toFixed(2) : `${v}${suffix}`);
    return `
      <div class="statrow">
        <div class="stat-val ${hn >= an ? 'hi' : ''}">${fmt(hv)}</div>
        <div>
          <div class="stat-label">${esc(label)}</div>
          <div class="stat-bar"><i class="l" style="width:${hp}%"></i><i class="r" style="width:${ap}%"></i></div>
        </div>
        <div class="stat-val ${an >= hn ? 'hi' : ''}">${fmt(av)}</div>
      </div>`;
  }).join('');

  const head = `
    <div class="statrow" style="border-bottom:1px solid var(--border)">
      <div style="text-align:center">${crest(homeTeam, 'sm')}</div>
      <div class="stat-label" style="color:var(--text-dim)">Match stats</div>
      <div style="text-align:center">${crest(awayTeam, 'sm')}</div>
    </div>`;

  return `<div class="card pad">${head}${rows}</div>`;
}

/* -------------------------------- lineups ------------------------------- */

export function lineupColumn(team, entries = []) {
  const starters = entries.filter((e) => e.isStarting);
  const subs = entries.filter((e) => !e.isStarting);

  const player = (p) => `
    <div class="lu-p ${p.isStarting ? '' : 'lu-sub'}">
      <span class="lu-n">${p.shirtNumber ?? '–'}</span>
      ${p.isCaptain ? '<span class="lu-cap">C</span>' : ''}
      <span class="lu-name">${esc(p.name)}</span>
      ${!p.isStarting && p.minuteOn ? `<span class="lu-tag">${p.minuteOn}'</span>` : ''}
      ${p.isStarting && p.minuteOff ? `<span class="lu-tag">${p.minuteOff}'</span>` : ''}
    </div>`;

  return `
    <div class="lu-col">
      <h4>${crest(team, 'sm')} ${esc(team.shortName || team.name)}</h4>
      <div class="lu-list">${starters.map(player).join('')}</div>
      ${subs.length ? `<div class="lu-subhead">Substitutes</div><div class="lu-list">${subs.map(player).join('')}</div>` : ''}
    </div>`;
}

export function lineupsBlock(lineups, homeTeam, awayTeam) {
  const h = lineups?.home || [];
  const a = lineups?.away || [];
  if (!h.length && !a.length) {
    return empty('No line-ups yet', 'Line-ups are published before kick-off.');
  }
  return `<div class="card pad"><div class="lu-grid">
    ${lineupColumn(homeTeam, h)}
    ${lineupColumn(awayTeam, a)}
  </div></div>`;
}

/* -------------------------------- scorers ------------------------------- */

export function scorerRow(entry, rank) {
  return `
    <a class="scorerrow" href="#/player/${encodeURIComponent(entry.player.id)}">
      <div class="sr-rank ${rank <= 3 ? 'top' : ''}">${rank}</div>
      <div>
        <div class="sr-name">${crest(entry.team, 'sm')}<span>${esc(entry.player.name)}</span></div>
        <div class="sr-club">${esc(entry.team?.shortName || entry.team?.name || '')}${entry.appearances ? ` · ${entry.appearances} apps` : ''}</div>
      </div>
      <div class="sr-goals">${entry.goals}<small>${entry.assists ? `${entry.assists} ast` : ''}${entry.penalties ? ` · ${entry.penalties} pen` : ''}</small></div>
    </a>`;
}

export function scorerList(entries, { limit = 25 } = {}) {
  if (!entries.length) return empty('No goals yet', 'Scorers appear once matches have been played.');
  return `<div class="card">${entries.slice(0, limit).map((e, i) => scorerRow(e, i + 1)).join('')}</div>`;
}

/* --------------------------------- squad -------------------------------- */

export function squadList(squad) {
  if (!squad.length) return empty('No squad listed', 'Add players from the admin panel.');
  return `<div class="card">${squad
    .map(
      (p) => `
      <a class="sq-row" href="#/player/${encodeURIComponent(p.id)}">
        <div class="sq-num">${p.shirtNumber ?? '–'}</div>
        <div>
          <div class="sq-name">${esc(p.name)}<span class="sq-pos">${esc(posLabel(p.position))}</span></div>
          <div class="sr-club">${esc(p.nationality || '')}${p.age ? ` · ${p.age} yrs` : ''}</div>
        </div>
        <div class="sq-stats">${p.stats?.appearances ?? 0} apps<br><b>${p.stats?.goals ?? 0}</b> G <b>${p.stats?.assists ?? 0}</b> A</div>
      </a>`
    )
    .join('')}</div>`;
}

/* ------------------------------- competitions --------------------------- */

export function leagueCard(comp, { matchCount = null } = {}) {
  return `
    <a class="leaguecard" href="#/competition/${encodeURIComponent(comp.id)}">
      <span class="lc-emblem" style="background:${esc(comp.color)}22">${esc(comp.emblem || '🏆')}</span>
      <div>
        <div class="lc-name">${esc(comp.shortName || comp.name)}</div>
        <div class="lc-sub">${esc(comp.country)}${comp.season ? ` · ${esc(comp.season)}` : ''}${matchCount != null ? ` · ${matchCount} matches` : ''}</div>
      </div>
    </a>`;
}

/* -------------------------------- date strip ---------------------------- */

export function dateStrip(days, activeKey, liveCount = 0) {
  return `<div class="datestrip">${days
    .map((d) => {
      const label = fmtDayLabel(d.key + 'T12:00:00');
      const isToday = label === 'Today';
      return `<a class="datechip ${d.key === activeKey ? 'active' : ''} ${isToday && liveCount ? 'live-day' : ''}" href="#/?date=${d.key}">
        <span class="dc-day">${esc(isToday ? 'Today' : label.split(' ')[0])}</span>
        <span class="dc-num">${Number(d.key.slice(8, 10))}</span>
      </a>`;
    })
    .join('')}</div>`;
}

export { empty, crest, esc };
