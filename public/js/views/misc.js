/* Leagues, Top scorers, Search and My Teams. */

import * as api from '../api.js';
import { leagueCard, scorerList, matchRow, crest } from '../components.js';
import { esc, empty, toast, debounce } from '../util.js';
import { favs } from '../favs.js';
import { bus } from '../bus.js';

/* ------------------------------- leagues -------------------------------- */

export const leagues = {
  async render() {
    const data = await api.bootstrap();
    const comps = data.competitions || [];
    if (!comps.length) return empty('No competitions yet', 'Create one in the admin panel.');
    return `
      <section class="section">
        <div class="section-head"><span class="section-title">Competitions</span><span class="section-link">${comps.length}</span></div>
        <div class="leaguelist">${comps.map((c) => leagueCard(c)).join('')}</div>
      </section>`;
  },
  mount() {},
};

/* ------------------------------- scorers -------------------------------- */

export const scorers = {
  async render({ query }) {
    const data = await api.bootstrap();
    const comps = data.competitions || [];
    if (!comps.length) return empty('No competitions yet');
    const active = comps.find((c) => c.id === query.comp) || comps[0];

    const selector = `<div class="tabs selector">${comps
      .map(
        (c) =>
          `<button data-comp="${esc(c.id)}" class="${c.id === active.id ? 'active' : ''}">${esc(c.shortName || c.name)}</button>`
      )
      .join('')}</div>`;

    let list = [];
    try {
      list = await api.scorers(active.id);
    } catch (_) {
      list = [];
    }

    return `
      <section class="section">
        <div class="section-head"><span class="section-title">Top scorers</span><span class="section-link">${esc(active.season || '')}</span></div>
        ${selector}
        ${scorerList(list.filter((p) => p.goals > 0), { limit: 40 })}
      </section>`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-comp]');
      if (!btn) return;
      e.preventDefault();
      ctx.setQuery({ comp: btn.dataset.comp });
      bus.emit('rerender');
    });
  },
};

/* -------------------------------- search -------------------------------- */

function scoreMatch(haystack, needle) {
  const h = haystack.toLowerCase();
  if (h === needle) return 100;
  if (h.startsWith(needle)) return 80;
  if (h.includes(` ${needle}`)) return 60;
  if (h.includes(needle)) return 40;
  return 0;
}

export const search = {
  async render({ query }) {
    const q = (query.q || '').trim();
    const box = `
      <div class="searchbox">
        <span class="sb-ico">
          <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <input id="searchInput" type="search" placeholder="Search teams, players, leagues…" value="${esc(q)}" autocomplete="off" />
        ${q ? '<button class="sb-clear" data-clear>Search</button>' : ''}
      </div>`;

    if (!q) {
      const data = await api.bootstrap();
      const top = (data.competitions || []).slice(0, 6);
      return `${box}
        <section class="section">
          <div class="section-head"><span class="section-title">Popular competitions</span></div>
          <div class="leaguelist">${top.map((c) => leagueCard(c)).join('')}</div>
        </section>`;
    }

    const data = await api.bootstrap();
    const needle = q.toLowerCase();
    const teamsById = new Map((data.teams || []).map((t) => [t.id, t]));

    const comps = (data.competitions || [])
      .map((c) => ({ item: c, s: scoreMatch(c.name, needle) + scoreMatch(c.country || '', needle) / 2, kind: 'competition' }))
      .filter((x) => x.s > 0);

    const teams = (data.teams || [])
      .map((t) => ({
        item: t,
        s: Math.max(scoreMatch(t.name, needle), scoreMatch(t.shortName || '', needle), scoreMatch(t.code || '', needle) * 0.9),
        kind: 'team',
      }))
      .filter((x) => x.s > 0);

    const players = (data.players || [])
      .map((p) => ({ item: p, s: scoreMatch(p.name, needle), kind: 'player' }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30);

    const all = [...comps, ...teams].sort((a, b) => b.s - a.s).slice(0, 20).concat(players);

    if (!all.length) {
      return `${box}${empty(`No results for “${q}”`, 'Try the short club name or a surname.')}`;
    }

    const rows = all
      .map(({ item, kind }) => {
        if (kind === 'competition') {
          return `<a class="resrow" href="#/competition/${encodeURIComponent(item.id)}">
            <span class="lc-emblem" style="background:${esc(item.color)}22">${esc(item.emblem || '🏆')}</span>
            <span><span class="res-name">${esc(item.name)}</span><span class="res-sub">${esc(item.country)} · ${esc(item.season)}</span></span>
          </a>`;
        }
        if (kind === 'team') {
          return `<a class="resrow" href="#/team/${encodeURIComponent(item.id)}">
            ${crest(item)}
            <span><span class="res-name">${esc(item.name)}</span><span class="res-sub">${esc(item.country || item.city || 'Club')}</span></span>
          </a>`;
        }
        const t = teamsById.get(item.teamId);
        return `<a class="resrow" href="#/player/${encodeURIComponent(item.id)}">
          ${crest(t || { name: '?', color: '#39414f' }, 'sm')}
          <span><span class="res-name">${esc(item.name)}</span><span class="res-sub">${esc(t?.name || '')} · ${esc(item.position || '')}</span></span>
        </a>`;
      })
      .join('');

    return `${box}<div class="card">${rows}</div>`;
  },

  mount(root, ctx) {
    const input = root.querySelector('#searchInput');
    if (!input) return;
    input.focus();
    const push = debounce((value) => {
      ctx.setQuery(value ? { q: value } : {});
      bus.emit('rerender', { keepFocus: true });
    }, 220);
    input.addEventListener('input', () => push(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        ctx.setQuery(input.value ? { q: input.value } : {});
        bus.emit('rerender');
      }
    });
  },
};

/* ------------------------------- my teams ------------------------------- */

export const my = {
  async render() {
    const [boot, feed] = await Promise.all([api.bootstrap(), api.home()]);
    const favTeams = (boot.teams || []).filter((t) => favs.hasTeam(t.id));
    const favComps = (boot.competitions || []).filter((c) => favs.hasCompetition(c.id));
    const all = [...(feed.live || []), ...(feed.recent || []), ...(feed.upcoming || [])];
    const seen = new Set();
    const pool = [];
    for (const m of all) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      pool.push(m);
    }

    const teamIds = new Set(favTeams.map((t) => t.id));
    const compIds = new Set(favComps.map((c) => c.id));
    const followIds = favs.all().matches;

    const relevant = pool
      .filter(
        (m) =>
          teamIds.has(m.home.team.id) ||
          teamIds.has(m.away.team.id) ||
          compIds.has(m.competition?.id) ||
          followIds.includes(m.id)
      )
      .sort((a, b) => {
        const rank = (x) => (['live', 'ht'].includes(x.status) ? 0 : x.status === 'scheduled' ? 1 : 2);
        return rank(a) - rank(b) || String(a.kickoff).localeCompare(String(b.kickoff));
      })
      .slice(0, 30);

    if (!favTeams.length && !favComps.length && !followIds.length) {
      return empty(
        'Nothing followed yet',
        'Tap Follow on a team or league (or a match) and it will show up here with live scores.'
      );
    }

    const chips = [
      ...favTeams.map(
        (t) => `<a class="linkrow" href="#/team/${encodeURIComponent(t.id)}">
          ${crest(t)}<span class="lr-title">${esc(t.name)}</span>
          <button class="fav-toggle on" data-unteam="${esc(t.id)}">Following</button>
        </a>`
      ),
      ...favComps.map(
        (c) => `<a class="linkrow" href="#/competition/${encodeURIComponent(c.id)}">
          <span class="lc-emblem" style="background:${esc(c.color)}22">${esc(c.emblem || '🏆')}</span>
          <span class="lr-title">${esc(c.name)}</span>
          <button class="fav-toggle on" data-uncomp="${esc(c.id)}">Following</button>
        </a>`
      ),
    ].join('');

    const adminCard =
      api.state.mode === 'server'
        ? `<section class="section">
             <div class="section-head"><span class="section-title">Backend</span></div>
             <div class="card">
               <a class="linkrow" href="admin.html">
                 <span class="lc-emblem">⚙️</span>
                 <span class="lr-title">Open admin panel</span>
                 <span class="lr-sub">Update scores, players, fixtures</span>
               </a>
             </div>
           </section>`
        : '';

    return `
      ${adminCard}
      ${chips ? `<section class="section"><div class="card">${chips}</div></section>` : ''}
      <section class="section">
        <div class="section-head"><span class="section-title">Your matches</span><span class="section-link">${relevant.length}</span></div>
        ${relevant.length
          ? `<div class="matchlist">${relevant.map((m) => matchRow(m)).join('')}</div>`
          : empty('No matches right now', 'Nothing scheduled for the teams you follow.')}
      </section>`;
  },

  mount(root) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-unteam]');
      const c = e.target.closest('[data-uncomp]');
      if (t) {
        e.preventDefault();
        favs.toggleTeam(t.dataset.unteam);
        toast('Removed from My Teams');
        bus.emit('rerender');
      } else if (c) {
        e.preventDefault();
        favs.toggleCompetition(c.dataset.uncomp);
        toast('Unfollowed league');
        bus.emit('rerender');
      }
    });
  },
};
