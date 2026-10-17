/* Team page — fixtures, results, squad. */

import * as api from '../api.js';
import { tabs, matchRow, squadList, leagueTable, crest } from '../components.js';
import { esc, empty, formStrip, toast } from '../util.js';
import { favs } from '../favs.js';
import { bus } from '../bus.js';

const TABS = [
  { id: 'fixtures', label: 'Matches' },
  { id: 'squad', label: 'Squad' },
  { id: 'table', label: 'Standings' },
];

export async function render({ params, query, ctx }) {
  const data = await api.team(decodeURIComponent(params[0]));
  if (!data) return empty('Team not found', 'It may have been removed.');

  const team = data.team;
  if (ctx) ctx.title = team.name;
  const tab = TABS.some((t) => t.id === query.tab) ? query.tab : 'fixtures';
  const isFav = favs.hasTeam(team.id);

  const header = `
    <div class="theader">
      ${crest(team, 'lg')}
      <div class="th-meta">
        <h1>${esc(team.name)}</h1>
        <p>${esc([team.country, team.city, team.venue].filter(Boolean).join(' · '))}</p>
      </div>
      <button class="fav-toggle ${isFav ? 'on' : ''}" data-fav-team="${esc(team.id)}">
        <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0112 6.6a4.7 4.7 0 018.5 2.6c0 5.8-8.5 11.3-8.5 11.3z"/></svg>
        ${isFav ? 'Following' : 'Follow'}
      </button>
    </div>
    <dl class="infogrid" style="margin-bottom:14px">
      ${team.manager ? `<div><dt>Manager</dt><dd>${esc(team.manager)}</dd></div>` : ''}
      ${team.founded ? `<div><dt>Founded</dt><dd>${team.founded}</dd></div>` : ''}
      ${team.venue ? `<div><dt>Stadium</dt><dd>${esc(team.venue)}</dd></div>` : ''}
      <div><dt>Form</dt><dd>${formStrip(data.form)}</dd></div>
    </dl>`;

  let body = '';

  if (tab === 'fixtures') {
    const live = (data.upcoming || []).filter((m) => ['live', 'ht'].includes(m.status));
    const next = (data.upcoming || []).filter((m) => !['live', 'ht'].includes(m.status)).slice(0, 12);
    const results = (data.results || []).slice(0, 12);

    const block = (title, list, emptyText) => `
      <section class="section">
        <div class="section-head"><span class="section-title">${esc(title)}</span></div>
        ${list.length
          ? `<div class="matchlist">${list
              .map((m) =>
                matchRow(m, {
                  showCompetition: true,
                  footer: esc(m.competition?.shortName || '') + (m.round ? ` · ${esc(m.competition?.type === 'cup' ? `Matchday ${m.round}` : `Round ${m.round}`)}` : ''),
                })
              )
              .join('')}</div>`
          : empty(emptyText)}
      </section>`;

    body =
      (live.length ? block('In progress', live, '') : '') +
      block('Upcoming', next, 'No scheduled matches') +
      block('Results', results, 'No results yet');
  }

  if (tab === 'squad') {
    const order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const squad = (data.squad || [])
      .slice()
      .sort((a, b) => (order[a.position] - order[b.position]) || (a.shirtNumber || 99) - (b.shirtNumber || 99));
    body = squadList(squad);
  }

  if (tab === 'table') {
    body = (data.competitions || [])
      .map((c) => {
        if (!c.tableRow) return '';
        return `<section class="section">
          <div class="section-head"><a class="section-title" href="#/competition/${encodeURIComponent(c.id)}">${esc(c.name)}</a></div>
          <div class="card">${leagueTable([c.tableRow], { zones: c.zones || [], showForm: true })}</div>
        </section>`;
      })
      .filter(Boolean)
      .join('');
    if (!body) body = empty('Not in a table yet', 'This team has no competition table yet.');
  }

  const comps = (data.competitions || [])
    .map(
      (c) => `<a class="linkrow" href="#/competition/${encodeURIComponent(c.id)}">
        ${crest(team, 'sm')}
        <span class="lr-title">${esc(c.name)}</span>
        <span class="lr-sub">${c.tableRow ? `${c.tableRow.position}${c.tableRow.zone ? ` · ${esc(c.tableRow.zone.label)}` : ''}` : esc(c.stage || '')}</span>
      </a>`
    )
    .join('');

  return `${header}${tabs(TABS, tab)}${body}${
    comps ? `<section class="section"><div class="section-head"><span class="section-title">Competitions</span></div><div class="card">${comps}</div></section>` : ''
  }`;
}

export function mount(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fav-team]');
    if (!btn) return;
    e.preventDefault();
    const on = favs.toggleTeam(btn.dataset.favTeam);
    toast(on ? 'Added to My Teams' : 'Removed from My Teams');
    bus.emit('rerender');
  });
}
