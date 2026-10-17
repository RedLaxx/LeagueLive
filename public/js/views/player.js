/* Player page — stats and goal log. */

import * as api from '../api.js';
import { crest } from '../components.js';
import { esc, empty, posLabel, fmtShortDay, toast } from '../util.js';

export async function render({ params, ctx }) {
  const data = await api.player(decodeURIComponent(params[0]));
  if (!data) return empty('Player not found');

  const p = data.player;
  if (ctx) ctx.title = p.name;
  const s = data.stats || {};
  const team = data.team;

  const log = (data.goalLog || [])
    .slice()
    .sort((a, b) => String(b.kickoff).localeCompare(String(a.kickoff)))
    .map((g) => `
        <a class="gl-row" href="#/match/${encodeURIComponent(g.matchId)}">
          <div class="gl-min">${g.minute}'</div>
          <div>
            <div class="gl-vs">vs ${esc(g.opponentName || (g.home ? 'Away' : 'Home'))}</div>
            <div class="gl-sub">${esc(g.competitionName || '')} · ${esc(fmtShortDay(g.kickoff))}${g.type === 'penalty' ? ' · pen' : ''}</div>
          </div>
          <div class="gl-sub nowrap">${esc(g.home ? 'H' : 'A')}</div>
        </a>`)
    .join('');

  const byComp = (data.byCompetition || [])
    .map(
      (c) => `<div class="statbox">
        <b>${c.goals}</b>
        <span>${esc(c.competition?.shortName || c.competition?.name || '')}</span>
      </div>`
    )
    .join('');

  return `
    <div class="pheader">
      <div class="avatar" style="background:${esc(team?.color || '#39414f')}">${esc((p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase())}</div>
      <div>
        <h1>${esc(p.name)}</h1>
        <p>${esc(team?.name || '')}${p.position ? ` · ${esc(posLabel(p.position))}` : ''}${p.shirtNumber ? ` · #${p.shirtNumber}` : ''}</p>
        <p>${esc([p.nationality, p.age ? `${p.age} years` : ''].filter(Boolean).join(' · '))}</p>
      </div>
    </div>

    <div class="statgrid">
      <div class="statbox"><b>${s.goals ?? 0}</b><span>Goals</span></div>
      <div class="statbox"><b>${s.assists ?? 0}</b><span>Assists</span></div>
      <div class="statbox"><b>${s.appearances ?? 0}</b><span>Apps</span></div>
      <div class="statbox"><b>${s.starts ?? 0}</b><span>Starts</span></div>
      <div class="statbox"><b>${s.yellowCards ?? 0}</b><span>Yellow</span></div>
      <div class="statbox"><b>${s.redCards ?? 0}</b><span>Red</span></div>
    </div>

    ${byComp ? `<section class="section"><div class="section-head"><span class="section-title">Goals by competition</span></div><div class="statgrid">${byComp}</div></section>` : ''}

    <section class="section">
      <div class="section-head"><span class="section-title">Goals</span><span class="section-link">${(data.goalLog || []).length}</span></div>
      <div class="card">${log || '<div class="pad muted center" style="padding:24px">No goals recorded yet</div>'}</div>
    </section>

    ${team ? `<section class="section">
      <a class="linkrow card" href="#/team/${encodeURIComponent(team.id)}">
        ${crest(team)}
        <span class="lr-title">${esc(team.name)} squad</span>
        <span class="lr-sub">View team</span>
      </a>
    </section>` : ''}`;
}

export function mount() {
  void toast;
}
