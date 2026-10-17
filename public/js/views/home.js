/* Matches (home) — live now, date strip, matches by day. */

import * as api from '../api.js';
import { matchList, matchRow } from '../components.js';
import { esc, dateKey, todayKey, fmtDayLabel, groupBy, empty } from '../util.js';

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

function buildDays(feed) {
  const all = dedupe([...(feed.live || []), ...(feed.recent || []), ...(feed.upcoming || [])]);
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const days = [];
  for (let i = -6; i <= 8; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    days.push({ key, count: 0, hasLive: false });
  }
  const byDate = groupBy(all, (m) => dateKey(m.kickoff));
  for (const day of days) {
    const list = byDate.get(day.key) || [];
    day.count = list.length;
    day.hasLive = list.some((m) => ['live', 'ht'].includes(m.status));
  }
  return { days, byDate, all };
}

export async function render({ query }) {
  const feed = await api.home();
  const { days, byDate, all } = buildDays(feed);
  const live = feed.live || [];
  const selected = query.date || todayKey();

  const strip = `<div class="datestrip">${days
    .map((d) => {
      const label = fmtDayLabel(`${d.key}T12:00:00`);
      const short = label === 'Today' ? 'Today' : label.split(' ')[0];
      return `<a class="datechip ${d.key === selected ? 'active' : ''} ${d.hasLive ? 'live-day' : ''}" href="#/?date=${d.key}">
        <span>${esc(short)}</span>
        <span class="dc-num">${Number(d.key.slice(8, 10))}</span>
      </a>`;
    })
    .join('')}</div>`;

  const liveBlock = live.length
    ? `<section class="section">
         <div class="section-head"><span class="section-title">Live now</span><span class="section-link">${live.length} match${live.length > 1 ? 'es' : ''}</span></div>
         <div class="matchlist">${live.map((m) => matchRow(m)).join('')}</div>
       </section>`
    : '';

  let list = (byDate.get(selected) || []).slice();
  list.sort(
    (a, b) =>
      String(a.competition?.name || '').localeCompare(String(b.competition?.name || '')) ||
      String(a.kickoff).localeCompare(String(b.kickoff))
  );

  const byComp = groupBy(list, (m) => m.competition?.id || '?');
  const sections = [...byComp.entries()]
    .map(([, matches]) => {
      const comp = matches[0].competition;
      return `
        <section class="section">
          <div class="section-head">
            <a class="section-title" href="#/competition/${encodeURIComponent(comp.id)}" style="color:var(--text-dim)">${esc(comp.shortName || comp.name)}</a>
          </div>
          ${matchList(matches, { showCompetition: false })}
        </section>`;
    })
    .join('');

  const body = list.length
    ? sections
    : empty('No matches on this day', 'Pick another date, or check the Leagues tab for full fixtures.');

  return `
    ${liveBlock}
    <section class="section">
      <div class="section-head"><span class="section-title">${esc(fmtDayLabel(`${selected}T12:00:00`))}</span><span class="section-link">${all.length} in range</span></div>
      ${strip}
      ${body}
    </section>`;
}

export function mount() {
  /* nothing interactive beyond links */
}
