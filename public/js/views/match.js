/* Match detail — summary, stats, line-ups, head-to-head, table. */

import * as api from '../api.js';
import { tabs, eventsList, statsBlock, lineupsBlock, leagueTable, matchRow, crest } from '../components.js';
import { esc, crest as teamCrest, statusPill, fmtFullDateTime, empty } from '../util.js';
import { favs } from '../favs.js';
import { bus } from '../bus.js';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'stats', label: 'Stats' },
  { id: 'lineups', label: 'Line-ups' },
  { id: 'h2h', label: 'H2H' },
  { id: 'table', label: 'Table' },
];

export async function render({ params, query, ctx }) {
  const m = await api.match(decodeURIComponent(params[0]));
  if (!m) return empty('Match not found', 'It may have been deleted.');

  const tab = TABS.some((t) => t.id === query.tab) ? query.tab : 'summary';
  if (ctx) ctx.title = `${m.home.team.shortName} - ${m.away.team.shortName}`;
  const home = m.home.team;
  const away = m.away.team;
  const followed = favs.hasMatch(m.id);

  const scoreNums = ['live', 'ht', 'ft'].includes(m.status);
  const pens =
    m.homePen != null && m.awayPen != null
      ? `<div class="mh-meta" style="margin-top:2px">Penalties ${m.homePen}–${m.awayPen}</div>`
      : '';

  const header = `
    <div class="mheader">
      <div class="mh-comp">${esc(m.competition?.name || '')}${m.round ? ` · ${esc(m.competition?.type === 'cup' ? `Matchday ${m.round}` : `Round ${m.round}`)}` : ''}</div>
      <div class="mh-score">
        <div class="mh-side">
          <a href="#/team/${encodeURIComponent(home.id)}">${teamCrest(home, 'xl')}</a>
          <div class="mh-name">${esc(home.shortName || home.name)}</div>
        </div>
        <div class="mh-mid">
          <div class="mh-nums">
            <span>${scoreNums ? m.home.score : '–'}</span>
            <span class="mh-sep">:</span>
            <span>${scoreNums ? m.away.score : '–'}</span>
          </div>
          <div class="mh-status">${statusPill(m)}</div>
          ${pens}
        </div>
        <div class="mh-side">
          <a href="#/team/${encodeURIComponent(away.id)}">${teamCrest(away, 'xl')}</a>
          <div class="mh-name">${esc(away.shortName || away.name)}</div>
        </div>
      </div>
      <div class="mh-meta">${esc(fmtFullDateTime(m.kickoff))}${m.venue ? ` · ${esc(m.venue)}` : ''}${m.referee ? ` · Ref ${esc(m.referee)}` : ''}</div>
      <div class="center" style="margin-top:10px">
        <button class="fav-toggle ${followed ? 'on' : ''}" data-follow-match="${esc(m.id)}">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="${followed ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z" fill="none"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
          ${followed ? 'Following match' : 'Follow match'}
        </button>
      </div>
    </div>`;

  let body = '';

  if (tab === 'summary') {
    body = `<div class="card pad">${eventsList(m.events || [], {
      homeTeamId: m.home.team.id,
      awayTeamId: m.away.team.id,
    })}</div>`;
  }

  if (tab === 'stats') {
    body = statsBlock(m.stats, home, away);
  }

  if (tab === 'lineups') {
    body = lineupsBlock(m.lineups, home, away);
  }

  if (tab === 'h2h') {
    const s = m.h2h?.summary || { homeWins: 0, draws: 0, awayWins: 0 };
    const total = s.homeWins + s.draws + s.awayWins;
    body = `
      <div class="card pad" style="margin-bottom:12px">
        <div class="center" style="font-size:12px;color:var(--text-mute);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Previous meetings · ${total}</div>
        <div class="statrow">
          <div class="stat-val hi">${s.homeWins}</div>
          <div><div class="stat-label">${esc(home.code || home.shortName)}</div>
            <div class="stat-bar"><i class="l" style="width:${total ? (s.homeWins / total) * 100 : 0}%"></i><i class="r" style="width:${total ? (s.awayWins / total) * 100 : 0}%"></i></div>
          </div>
          <div class="stat-val hi">${s.awayWins}</div>
        </div>
        <div class="center muted" style="font-size:12px;margin-top:6px">${s.draws} draw${s.draws === 1 ? '' : 's'}</div>
      </div>
      ${(m.h2h?.matches || []).length
        ? `<div class="matchlist">${m.h2h.matches.map((h) => matchRow(h, { showCompetition: true })).join('')}</div>`
        : empty('No previous meetings', 'These two have not met in the current data.')}`;
  }

  if (tab === 'table') {
    try {
      const comp = await api.competition(m.competition.id);
      const group = comp.tables[0];
      body = group ? `<div class="card">${leagueTable(group.rows, {
        highlightTeamId: null,
        zones: comp.competition.zones || [],
      })}</div>` : empty('No table available');
    } catch (_) {
      body = empty('Table unavailable');
    }
  }

  return `${header}${tabs(TABS, tab)}${body}`;
}

export function mount(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-follow-match]');
    if (!btn) return;
    e.preventDefault();
    favs.toggleMatch(btn.dataset.followMatch);
    bus.emit('rerender');
  });
}
