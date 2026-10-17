/* Competition (league) page — table, fixtures, scorers, teams. */

import * as api from '../api.js';
import { leagueTable, zoneLegend, tabs, matchList, matchRow, scorerList, crest } from '../components.js';
import { esc, empty, toast } from '../util.js';
import { favs } from '../favs.js';
import { bus } from '../bus.js';

const TABS = [
  { id: 'table', label: 'Table' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'scorers', label: 'Top scorers' },
  { id: 'teams', label: 'Teams' },
];

export async function render({ params, query, ctx }) {
  const data = await api.competition(params[0]);
  if (!data) return empty('Competition not found', 'It may have been removed.');
  const comp = data.competition;
  if (ctx) ctx.title = comp.shortName || comp.name;
  const tab = TABS.some((t) => t.id === query.tab) ? query.tab : 'table';
  const isFav = favs.hasCompetition(comp.id);

  const header = `
    <div class="theader">
      <span class="lc-emblem" style="background:${esc(comp.color)}22;width:46px;height:46px;border-radius:12px;display:grid;place-items:center;font-size:23px">${esc(comp.emblem || '🏆')}</span>
      <div class="th-meta">
        <h1>${esc(comp.name)}</h1>
        <p>${esc([comp.stage, comp.country, comp.season].filter(Boolean).join(' · '))}</p>
      </div>
      <button class="fav-toggle ${isFav ? 'on' : ''}" data-fav-comp="${esc(comp.id)}">
        <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0112 6.6a4.7 4.7 0 018.5 2.6c0 5.8-8.5 11.3-8.5 11.3z"/></svg>
        ${isFav ? 'Following' : 'Follow'}
      </button>
    </div>`;

  let body = '';

  if (tab === 'table') {
    body = data.tables
      .map((group) => {
        const multi = data.tables.length > 1;
        return `
          <section class="section">
            ${multi ? `<div class="section-head"><span class="section-title">${esc(group.name)}</span></div>` : ''}
            <div class="card">${leagueTable(group.rows, { zones: comp.zones || [] })}</div>
            ${zoneLegend(comp.zones || [])}
          </section>`;
      })
      .join('');
    if (!body) body = empty('No table yet', 'Play some matches first.');
  }

  if (tab === 'fixtures') {
    const teamIndex = new Map((data.teams || []).map((t) => [t.id, t]));
    for (const m of data.matches || []) {
      if (!m.home.team) m.home.team = teamIndex.get(m.homeTeamId);
      if (!m.away.team) m.away.team = teamIndex.get(m.awayTeamId);
    }
    const nowIso = new Date().toISOString();
    const upcoming = (data.matches || [])
      .filter((m) => !['ft', 'postponed', 'cancelled'].includes(m.status))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    const results = (data.matches || [])
      .filter((m) => ['ft', 'postponed', 'cancelled'].includes(m.status) && m.kickoff <= nowIso)
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff));

    const footOf = (m) =>
      esc(m.round ? (comp.type === 'cup' ? `Matchday ${m.round}` : `Round ${m.round}`) : '') +
      (m.venue ? ` · ${esc(m.venue)}` : '');
    const limit = (list) =>
      list.slice(0, 40).map((m) => matchRow(m, { showCompetition: false, footer: footOf(m) })).join('');

    body = `
      <section class="section">
        <div class="section-head"><span class="section-title">Upcoming</span><span class="section-link">${upcoming.length}</span></div>
        ${upcoming.length ? `<div class="matchlist">${limit(upcoming)}</div>` : empty('Nothing scheduled', 'Generate fixtures from the admin panel.')}
      </section>
      <section class="section">
        <div class="section-head"><span class="section-title">Results</span><span class="section-link">${results.length}</span></div>
        ${results.length ? `<div class="matchlist">${limit(results)}</div>` : empty('No results yet')}
      </section>`;
  }

  if (tab === 'scorers') {
    body = `
      <section class="section">
        <div class="section-head"><span class="section-title">Top scorers</span></div>
        ${scorerList(data.topScorers || [], { limit: 30 })}
      </section>
      <section class="section">
        <div class="section-head"><span class="section-title">Most assists</span></div>
        ${scorerList(
          (data.topAssists || []).filter((p) => p.assists > 0),
          { limit: 30 }
        )}
      </section>`;
  }

  if (tab === 'teams') {
    const rows = (data.tables[0]?.rows || []).reduce((acc, r) => {
      acc[r.teamId] = r;
      return acc;
    }, {});
    body = `<div class="card">${(data.teams || [])
      .map((t) => {
        const row = rows[t.id];
        return `
          <a class="linkrow" href="#/team/${encodeURIComponent(t.id)}">
            ${crest(t)}
            <span class="lr-title">${esc(t.shortName || t.name)}</span>
            <span class="lr-sub">${row ? `${row.position} · ${row.points} pts` : esc(t.city || t.country || '')}</span>
          </a>`;
      })
      .join('')}</div>`;
  }

  return `${header}${tabs(TABS, tab)}${body}`;
}

export function mount(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fav-comp]');
    if (!btn) return;
    e.preventDefault();
    const on = favs.toggleCompetition(btn.dataset.favComp);
    toast(on ? 'Following league' : 'Unfollowed league');
    bus.emit('rerender');
  });
}
