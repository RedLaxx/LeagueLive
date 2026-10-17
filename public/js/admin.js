/* LeagueLive — admin panel. */

import * as api from './api.js';
import { esc, crest, qs, qsa, toast, fmtFullDateTime } from './util.js';

/* ------------------------------------------------------------------ */
/* state & helpers                                                     */
/* ------------------------------------------------------------------ */

const S = {
  overview: null,
  section: 'live',
  filter: { competition: '', status: '', team: '' },
  matchCache: new Map(),
  teamCache: new Map(),
  editing: null,
};

const el = {
  login: qs('#login'),
  panel: qs('#panel'),
  actions: qs('#admActions'),
  status: qs('#admStatus'),
  main: qs('#admMain'),
  nav: qs('#admNav'),
  modal: qs('#modal'),
  modalTitle: qs('#modalTitle'),
  modalBody: qs('#modalBody'),
  loginErr: qs('#loginErr'),
  btnExport: qs('#btnExport'),
  btnPublish: qs('#btnPublish'),
  btnLogout: qs('#btnLogout'),
};

const STATUS = ['scheduled', 'live', 'ht', 'ft', 'postponed', 'cancelled'];
const EVENT_TYPES = ['goal', 'penalty', 'own_goal', 'penalty_missed', 'yellow', 'second_yellow', 'red', 'sub', 'var'];
const POSITIONS = ['GK', 'DF', 'MF', 'FW'];

function field(label, inputHtml, hint = '') {
  return `<div class="field"><label>${esc(label)}</label>${inputHtml}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
}

function textInput(name, value, attrs = '') {
  return `<input name="${esc(name)}" value="${esc(value ?? '')}" ${attrs} />`;
}

function numberInput(name, value, attrs = '') {
  return `<input type="number" name="${esc(name)}" value="${esc(value ?? '')}" ${attrs} />`;
}

function select(name, options, value, attrs = '') {
  return `<select name="${esc(name)}" ${attrs}>${options
    .map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    })
    .join('')}</select>`;
}

function openModal(title, bodyHtml, footerHtml = '') {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHtml;
  let foot = qs('.modal-foot', el.modal);
  if (!foot) {
    foot = document.createElement('div');
    foot.className = 'modal-foot';
    el.modal.querySelector('.modal-card').appendChild(foot);
  }
  foot.innerHTML = footerHtml;
  foot.hidden = !footerHtml;
  el.modal.hidden = false;
}

function closeModal() {
  el.modal.hidden = true;
  el.modalBody.innerHTML = '';
}

async function call(path, options = {}) {
  try {
    const res = await api.admin(path, options);
    toast('Saved');
    return res;
  } catch (err) {
    toast(err.message || 'Request failed');
    throw err;
  }
}

async function loadOverview(fresh = true) {
  S.overview = await api.admin('overview');
  el.status.textContent = `${S.overview.counts.matches} matches · ${S.overview.counts.live} live · ${S.overview.counts.teams} teams`;
  el.btnPublish.hidden = !S.overview.gitPublishEnabled;
  return S.overview;
}

async function getMatch(id) {
  if (!S.matchCache.has(id)) S.matchCache.set(id, await api.match(id));
  return S.matchCache.get(id);
}

function invalidate(id) {
  if (id) S.matchCache.delete(id);
  else S.matchCache.clear();
}

/** Competition payloads ship team ids only — expand them for rendering. */
async function competitionWithTeams(compId) {
  const data = await api.competition(compId);
  const idx = new Map((data.teams || []).map((t) => [t.id, t]));
  for (const m of data.matches || []) {
    if (!m.home.team) m.home.team = idx.get(m.homeTeamId);
    if (!m.away.team) m.away.team = idx.get(m.awayTeamId);
  }
  return data;
}

async function getTeam(id) {
  if (!S.teamCache.has(id)) S.teamCache.set(id, await api.team(id));
  return S.teamCache.get(id);
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

const sections = {};

/* ------------------------------ live ticker ------------------------- */

sections.live = {
  async render() {
    const ov = S.overview;
    const live = ov.liveMatches || [];

    const cards = await Promise.all(live.map((m) => liveCard(m)));

    const upcoming = await todayScheduled();
    const compName = new Map(S.overview.competitions.map((c) => [c.id, c.shortName || c.name]));
    const startOptions = upcoming
      .map(
        (m) =>
          `<option value="${esc(m.id)}">${esc(m.home.team?.shortName || '?')} vs ${esc(
            m.away.team?.shortName || '?'
          )} · ${esc(m.competition?.shortName || compName.get(m.competitionId) || '')}</option>`
      )
      .join('');

    return `
      <div class="ablock">
        <h3>Live ticker <span class="spacer"></span><button class="btn sm" data-act="refresh">Refresh</button></h3>
        <div class="abody">
          ${
            live.length
              ? cards.join('')
              : `<p class="muted">No matches are live. Kick one off below — the app updates instantly.</p>`
          }
        </div>
      </div>

      <div class="ablock">
        <h3>Kick off a match</h3>
        <div class="abody">
          <div class="grid2">
            <div class="field">
              <label>Match (today &amp; next 3 days)</label>
              <select id="kickoffSelect">${startOptions || '<option value="">No scheduled matches</option>'}</select>
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="btn primary" data-act="kickoff" ${upcoming.length ? '' : 'disabled'}>Kick off (1')</button>
            </div>
          </div>
          <p class="hint">Kicking off sets the status to live and minute 1. Use the ticker above to add goals, cards and subs.</p>
        </div>
      </div>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const { act, id } = btn.dataset;

      if (act === 'refresh') return rerender();

      if (act === 'kickoff') {
        const sel = qs('#kickoffSelect', root);
        if (!sel?.value) return;
        await call(`matches/${sel.value}/quick`, { method: 'POST', body: { status: 'live', minute: 1 } });
        invalidate(sel.value);
        return rerender();
      }

      if (act === 'score') {
        const m = await getMatch(id);
        const delta = Number(btn.dataset.delta);
        const side = btn.dataset.side;
        const patch = {
          status: m.status,
          homeScore: m.home.score + (side === 'home' ? delta : 0),
          awayScore: m.away.score + (side === 'away' ? delta : 0),
          minute: m.minute ?? 0,
        };
        await call(`matches/${id}/quick`, { method: 'POST', body: patch });
        invalidate(id);
        return rerender();
      }

      if (act === 'status') {
        const value = btn.dataset.value;
        const patch = { status: value };
        if (value === 'live') patch.minute = Number(qs(`#minute-${cssId(id)}`, root)?.value) || 1;
        if (value === 'scheduled') patch.minute = null;
        await call(`matches/${id}/quick`, { method: 'POST', body: patch });
        invalidate(id);
        return rerender();
      }

      if (act === 'minute') {
        const value = Number(qs(`#minute-${cssId(id)}`, root)?.value) || 0;
        const m = await getMatch(id);
        await call(`matches/${id}/quick`, {
          method: 'POST',
          body: { status: m.status, minute: value, homeScore: m.home.score, awayScore: m.away.score },
        });
        invalidate(id);
        return rerender();
      }

      if (act === 'addevent') {
        return openEventModal(id);
      }

      if (act === 'delevent') {
        await call(`events/${btn.dataset.event}`, { method: 'DELETE' });
        invalidate(id);
        return rerender();
      }

      if (act === 'edit') {
        location.hash = '#/match/' + encodeURIComponent(id);
      }
    });
  },
};

function cssId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function todayScheduled() {
  const comps = S.overview.competitions;
  const out = [];
  for (const c of comps) {
    try {
      const data = await competitionWithTeams(c.id);
      const soon = (data.matches || []).filter(
        (m) =>
          m.status === 'scheduled' &&
          new Date(m.kickoff) > new Date(Date.now() - 6 * 3600e3) &&
          new Date(m.kickoff) < new Date(Date.now() + 3 * 864e5)
      );
      out.push(...soon);
    } catch (_) {}
  }
  return out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

async function liveCard(m) {
  const detail = await getMatch(m.id);
  const events = (detail.events || []).slice(-6).reverse();
  const evRows = events.length
    ? events
        .map(
          (e) => `<div class="lu-p" style="font-size:12px">
            <span class="lu-n">${e.minute}'</span>
            <span class="lu-name">${esc(e.type.replace(/_/g, ' '))} — ${esc(e.playerName || '')}${e.secondaryName ? ` (${esc(e.secondaryName)})` : ''}</span>
            <span class="spacer" style="margin-left:auto"></span>
            <button class="btn sm danger" data-act="delevent" data-id="${esc(m.id)}" data-event="${e.id}">✕</button>
          </div>`
        )
        .join('')
    : '<p class="muted" style="font-size:12px;margin:0">No events yet</p>';

  return `
    <div class="live-card">
      <div class="lc-head">
        <span class="lc-comp">${esc(m.competition?.shortName || '')}${m.round ? ` · ${esc(m.round)}` : ''}</span>
        <span class="pill ${m.status === 'live' ? 'live' : m.status === 'ht' ? 'ht' : 'ft'}">${esc(m.status.toUpperCase())}</span>
        <span class="sep" style="flex:1"></span>
        <button class="btn sm" data-act="addevent" data-id="${esc(m.id)}">+ Event</button>
      </div>
      <div class="lc-teams">
        <div class="lc-side">
          ${crest(m.home.team, 'sm')}
          <span class="lc-name">${esc(m.home.team?.shortName || m.homeTeamId)}</span>
        </div>
        <div class="lc-score">
          <button data-act="score" data-id="${esc(m.id)}" data-side="home" data-delta="-1">−</button>
          <span>${m.home.score}</span>
          <span class="muted">:</span>
          <span>${m.away.score}</span>
          <button data-act="score" data-id="${esc(m.id)}" data-side="away" data-delta="-1">−</button>
        </div>
        <div class="lc-side right">
          ${crest(m.away.team, 'sm')}
          <span class="lc-name">${esc(m.away.team?.shortName || m.awayTeamId)}</span>
        </div>
      </div>
      <div class="lc-row" style="margin-bottom:10px">
        <button class="btn sm" data-act="score" data-id="${esc(m.id)}" data-side="home" data-delta="1">+1 ${esc(m.home.team?.code || 'H')}</button>
        <button class="btn sm" data-act="score" data-id="${esc(m.id)}" data-side="away" data-delta="1">+1 ${esc(m.away.team?.code || 'A')}</button>
        <span class="sep"></span>
        <button class="btn sm" data-act="status" data-id="${esc(m.id)}" data-value="live">Live</button>
        <button class="btn sm" data-act="status" data-id="${esc(m.id)}" data-value="ht">HT</button>
        <button class="btn sm" data-act="status" data-id="${esc(m.id)}" data-value="ft">FT</button>
      </div>
      <div class="lc-row">
        <input class="minute-input" type="number" id="minute-${cssId(m.id)}" value="${m.minute ?? 0}" />
        <button class="btn sm" data-act="minute" data-id="${esc(m.id)}">Set minute</button>
        <span class="sep"></span>
        <span class="muted" style="font-size:11.5px">${esc(fmtFullDateTime(m.kickoff))}</span>
      </div>
      <div style="margin-top:10px;border-top:1px solid var(--border-soft);padding-top:8px">${evRows}</div>
    </div>`;
}

/* -------------------------------- matches ---------------------------- */

sections.matches = {
  async render() {
    const comps = S.overview.competitions;
    const compId = S.filter.competition || comps[0]?.id;
    if (!compId) return '<div class="ablock"><div class="abody">Create a league first.</div></div>';

    const data = await competitionWithTeams(compId);
    let matches = data.matches || [];
    if (S.filter.status) matches = matches.filter((m) => m.status === S.filter.status);
    const nowIso = new Date().toISOString();
    const near = matches
      .filter((m) => m.status !== 'ft' || m.kickoff > new Date(Date.now() - 30 * 864e5).toISOString())
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, 60);
    void nowIso;

    const rows = near
      .map(
        (m) => `
        <tr>
          <td class="nowrap" style="font-size:11.5px;color:var(--text-mute)">${esc(fmtFullDateTime(m.kickoff))}</td>
          <td>${esc(m.round || '')}</td>
          <td>${crest(m.home.team, 'sm')} ${esc(m.home.team?.shortName || m.homeTeamId)}</td>
          <td>${crest(m.away.team, 'sm')} ${esc(m.away.team?.shortName || m.awayTeamId)}</td>
          <td class="tnum"><b>${m.home.score} : ${m.away.score}</b></td>
          <td>${esc(m.status)}</td>
          <td class="actions">
            <button class="btn sm" data-act="edit" data-id="${esc(m.id)}">Edit</button>
            <button class="btn sm" data-act="events" data-id="${esc(m.id)}">Events</button>
            <button class="btn sm" data-act="stats" data-id="${esc(m.id)}">Stats</button>
            <button class="btn sm" data-act="lineups" data-id="${esc(m.id)}">XI</button>
          </td>
        </tr>`
      )
      .join('');

    return `
      <div class="ablock">
        <h3>Matches
          <span class="spacer"></span>
          <button class="btn sm primary" data-act="new">+ Add match</button>
        </h3>
        <div class="abody tight">
          <div class="grid3" style="padding:6px 6px 12px">
            <div class="field"><label>League</label>${select('comp', comps.map((c) => ({ value: c.id, label: c.shortName || c.name })), compId, 'id="filterComp"')}</div>
            <div class="field"><label>Status</label>${select('status', [{ value: '', label: 'All' }, ...STATUS], S.filter.status, 'id="filterStatus"')}</div>
          </div>
          <table class="atable">
            <thead><tr><th>Kick-off</th><th>Rd</th><th>Home</th><th>Away</th><th>Score</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" class="muted">No matches</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  },
  mount(root) {
    root.addEventListener('change', (e) => {
      if (e.target.id === 'filterComp') {
        S.filter.competition = e.target.value;
        rerender();
      }
      if (e.target.id === 'filterStatus') {
        S.filter.status = e.target.value;
        rerender();
      }
    });
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const { act, id } = btn.dataset;
      if (act === 'new') return openMatchModal(null, S.filter.competition || S.overview.competitions[0]?.id);
      if (act === 'edit') return openMatchModal(id);
      if (act === 'events') return openEventModal(id, true);
      if (act === 'stats') return openStatsModal(id);
      if (act === 'lineups') return openLineupsModal(id);
    });
  },
};

/* -------------------------------- fixtures --------------------------- */

sections.fixtures = {
  async render() {
    const comps = S.overview.competitions;
    return `
      <div class="ablock">
        <h3>Generate fixtures (round robin)</h3>
        <div class="abody">
          <div class="grid3">
            <div class="field"><label>League</label>${select('competitionId', comps.map((c) => ({ value: c.id, label: c.shortName || c.name })), comps[0]?.id, 'id="fxComp"')}</div>
            <div class="field"><label>First matchday</label><input type="date" id="fxStart" /></div>
            <div class="field"><label>Days between rounds</label><input type="number" id="fxInterval" value="7" /></div>
            <div class="field"><label>Kick-off hour (0-23)</label><input type="number" id="fxHour" value="15" /></div>
            <div class="field check"><input type="checkbox" id="fxDouble" checked /><label for="fxDouble">Home &amp; away</label></div>
            <div class="field check"><input type="checkbox" id="fxClear" /><label for="fxClear">Delete existing fixtures</label></div>
          </div>
          <div style="margin-top:12px"><button class="btn primary" data-act="generate">Generate</button></div>
          <p class="hint">Uses the circle method so every team plays every other team. Re-running with “delete existing” rebuilds the calendar from scratch.</p>
        </div>
      </div>

      <div class="ablock">
        <h3>Quick team import</h3>
        <div class="abody">
          <div class="field"><label>League</label>${select('competitionId', comps.map((c) => ({ value: c.id, label: c.shortName || c.name })), comps[0]?.id, 'id="impComp"')}</div>
          <div class="field" style="margin-top:10px"><label>Club names (one per line)</label><textarea id="impNames" placeholder="Arsenal&#10;Liverpool&#10;…"></textarea></div>
          <div style="margin-top:10px"><button class="btn" data-act="import-teams">Add teams</button></div>
        </div>
      </div>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'generate') {
        const body = {
          competitionId: qs('#fxComp', root).value,
          startDate: qs('#fxStart', root).value || undefined,
          intervalDays: Number(qs('#fxInterval', root).value) || 7,
          kickoffHour: Number(qs('#fxHour', root).value) || 15,
          doubleRound: qs('#fxDouble', root).checked,
          clearExisting: qs('#fxClear', root).checked,
        };
        await call('fixtures', { method: 'POST', body });
        invalidate();
        return rerender();
      }
      if (btn.dataset.act === 'import-teams') {
        const body = {
          competitionId: qs('#impComp', root).value,
          names: qs('#impNames', root).value,
        };
        await call('teams/import', { method: 'POST', body });
        return rerender();
      }
    });
  },
};

/* ------------------------------ teams -------------------------------- */

sections.teams = {
  async render() {
    let teams = S.overview.teams;
    if (S.filter.competition) {
      teams = teams.filter((t) => (t.competitions || []).includes(S.filter.competition));
    }
    const rows = teams
      .map(
        (t) => `
        <tr>
          <td>${crest(t, 'sm')}</td>
          <td><b>${esc(t.name)}</b><br><span class="muted" style="font-size:11px">${esc([t.country, t.city].filter(Boolean).join(' · '))}</span></td>
          <td>${esc(t.code || '')}</td>
          <td class="actions">
            <button class="btn sm" data-act="squad" data-id="${esc(t.id)}">Squad</button>
            <button class="btn sm" data-act="edit" data-id="${esc(t.id)}">Edit</button>
            <button class="btn sm danger" data-act="delete" data-id="${esc(t.id)}">Delete</button>
          </td>
        </tr>`
      )
      .join('');

    return `
      <div class="ablock">
        <h3>Teams <span class="spacer"></span><button class="btn sm primary" data-act="new">+ Add team</button></h3>
        <div class="abody tight">
          <div class="field" style="padding:6px 6px 12px;max-width:260px">
            <label>Filter by league</label>
            ${select(
              'comp',
              [{ value: '', label: 'All leagues' }, ...S.overview.competitions.map((c) => ({ value: c.id, label: c.shortName || c.name }))],
              S.filter.competition || '',
              'id="teamFilter"'
            )}
          </div>
          <table class="atable">
            <thead><tr><th></th><th>Team</th><th>Code</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="muted">No teams yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  },
  mount(root) {
    root.addEventListener('change', (e) => {
      if (e.target.id === 'teamFilter') {
        S.filter.competition = e.target.value;
        rerender();
      }
    });
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const { act, id } = btn.dataset;
      if (act === 'new') return openTeamModal(null);
      if (act === 'edit') return openTeamModal(id);
      if (act === 'squad') return openSquadModal(id);
      if (act === 'delete') {
        if (!confirm('Delete this team and all of its players?')) return;
        await call(`teams/${id}`, { method: 'DELETE' });
        return rerender();
      }
    });
  },
};

/* ------------------------------ leagues ------------------------------ */

sections.leagues = {
  async render() {
    const rows = S.overview.competitions
      .map(
        (c) => `
        <tr>
          <td><span class="lc-emblem" style="background:${esc(c.color)}22">${esc(c.emblem || '🏆')}</span></td>
          <td><b>${esc(c.name)}</b><br><span class="muted" style="font-size:11px">${esc([c.country, c.season, c.type].filter(Boolean).join(' · '))}</span></td>
          <td>${esc(c.stage || '')}</td>
          <td class="actions">
            <button class="btn sm" data-act="edit" data-id="${esc(c.id)}">Edit</button>
            <button class="btn sm danger" data-act="delete" data-id="${esc(c.id)}">Delete</button>
          </td>
        </tr>`
      )
      .join('');

    return `
      <div class="ablock">
        <h3>Competitions <span class="spacer"></span><button class="btn sm primary" data-act="new">+ Add league</button></h3>
        <div class="abody tight">
          <table class="atable">
            <thead><tr><th></th><th>League</th><th>Stage</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="muted">No competitions yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const { act, id } = btn.dataset;
      if (act === 'new') return openCompetitionModal(null);
      if (act === 'edit') return openCompetitionModal(id);
      if (act === 'delete') {
        if (!confirm('Delete this competition, its fixtures and table?')) return;
        await call(`competitions/${id}`, { method: 'DELETE' });
        return rerender();
      }
    });
  },
};

/* -------------------------------- data -------------------------------- */

sections.data = {
  async render() {
    const publishBlock = S.overview.gitPublishEnabled
      ? `<button class="btn primary" data-act="publish">Export &amp; push to GitHub</button>`
      : `<p class="hint">Git publishing is off. Restart the server with <code>ENABLE_GIT_PUBLISH=1</code> to push the snapshot straight to GitHub Pages.</p>`;

    return `
      <div class="ablock">
        <h3>Snapshot &amp; publishing</h3>
        <div class="abody">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button class="btn" data-act="export">Export static snapshot</button>
            ${publishBlock}
          </div>
          <p class="hint">
            Export writes <code>public/data/*.json</code> (used by GitHub Pages) and <code>data/db.json</code>
            (the committed master copy of your database). The site refreshes from those files automatically.
          </p>
        </div>
      </div>

      <div class="ablock">
        <h3>Import data</h3>
        <div class="abody">
          <div class="field">
            <label>Paste a data/db.json payload or choose a file</label>
            <textarea id="importText" placeholder='{"version":1,"tables":{…}}'></textarea>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <input type="file" id="importFile" accept="application/json" />
            <button class="btn" data-act="import">Import &amp; replace database</button>
          </div>
          <p class="hint">This replaces every competition, team, player and match. Export first if you want a backup.</p>
        </div>
      </div>

      <div class="ablock">
        <h3>Public site</h3>
        <div class="abody">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn" href="./" target="_blank" rel="noopener">Open the site</a>
            <a class="btn" href="data/db.json" target="_blank" rel="noopener">Download db.json</a>
          </div>
        </div>
      </div>`;
  },
  mount(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'export') {
        const res = await call('export', { method: 'POST' });
        toast(`Exported ${res.exported?.files} files`);
        return;
      }
      if (btn.dataset.act === 'publish') {
        if (!confirm('Commit and push the updated data to GitHub?')) return;
        const res = await call('publish', { method: 'POST', body: { message: 'Update LeagueLive data' } });
        toast(res.push ? 'Pushed to GitHub' : 'Committed');
        return;
      }
      if (btn.dataset.act === 'import') {
        const file = qs('#importFile', root).files?.[0];
        let text = qs('#importText', root).value;
        if (!text && file) text = await file.text();
        if (!text) return toast('Nothing to import');
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (_) {
          return toast('Invalid JSON');
        }
        if (!confirm('Replace the entire database?')) return;
        await call('import', { method: 'POST', body: { data: parsed } });
        invalidate();
        return rerender();
      }
    });
  },
};

/* ------------------------------------------------------------------ */
/* modals                                                              */
/* ------------------------------------------------------------------ */

async function openMatchModal(id, defaultCompId) {
  const comps = S.overview.competitions;
  const teams = S.overview.teams;
  const compId = defaultCompId || comps[0]?.id;
  const teamOptions = (compId ? teams.filter((t) => (t.competitions || []).includes(compId)) : teams).map(
    (t) => ({ value: t.id, label: t.name })
  );
  const existing = id ? await getMatch(id) : null;

  const body = `
    <div class="grid2">
      ${field('League', select('competitionId', comps.map((c) => ({ value: c.id, label: c.shortName || c.name })), existing?.competitionId || compId, 'id="mComp"'))}
      ${field('Round', textInput('round', existing?.round || ''))}
      ${field('Home team', select('homeTeamId', teamOptions, existing?.home?.team?.id || '', 'id="mHome"'))}
      ${field('Away team', select('awayTeamId', teamOptions, existing?.away?.team?.id || '', 'id="mAway"'))}
      ${field('Kick-off', `<input type="datetime-local" name="kickoff" value="${existing ? toLocalInput(existing.kickoff) : toLocalInput(new Date().toISOString())}" />`)}
      ${field('Status', select('status', STATUS, existing?.status || 'scheduled'))}
      ${field('Minute', numberInput('minute', existing?.minute ?? ''))}
      ${field('Home goals', numberInput('homeScore', existing?.home?.score ?? 0))}
      ${field('Away goals', numberInput('awayScore', existing?.away?.score ?? 0))}
      ${field('Venue', textInput('venue', existing?.venue || ''))}
      ${field('Referee', textInput('referee', existing?.referee || ''))}
      ${field('Attendance', numberInput('attendance', existing?.attendance ?? ''))}
      ${field('Note', textInput('note', existing?.note || ''))}
    </div>`;

  openModal(id ? 'Edit match' : 'Add match', body, `
    ${id ? `<button class="btn danger" id="mDelete">Delete</button>` : ''}
    <span style="flex:1"></span>
    <button class="btn ghost" data-close>Cancel</button>
    <button class="btn primary" id="mSave">Save</button>
  `);

  qs('#mComp', el.modalBody).addEventListener('change', async (e) => {
    const list = teams.filter((t) => (t.competitions || []).includes(e.target.value));
    const opts = list.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    qs('#mHome', el.modalBody).innerHTML = opts;
    qs('#mAway', el.modalBody).innerHTML = opts;
  });

  qs('#mSave', el.modal).onclick = async () => {
    const f = formValues(el.modalBody);
    const payload = {
      competitionId: f.competitionId,
      round: f.round,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      kickoff: f.kickoff ? new Date(f.kickoff).toISOString() : undefined,
      status: f.status,
      minute: f.minute === '' ? null : Number(f.minute),
      homeScore: Number(f.homeScore) || 0,
      awayScore: Number(f.awayScore) || 0,
      venue: f.venue,
      referee: f.referee,
      attendance: f.attendance === '' ? null : Number(f.attendance),
      note: f.note,
    };
    try {
      if (id) await call(`matches/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
      else await call('matches', { method: 'POST', body: payload });
      invalidate(id);
      closeModal();
      rerender();
    } catch (_) {}
  };

  if (id) {
    qs('#mDelete', el.modal).onclick = async () => {
      if (!confirm('Delete this match?')) return;
      await call(`matches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      invalidate(id);
      closeModal();
      rerender();
    };
  }
}

async function openEventModal(matchId, showList = false) {
  const m = await getMatch(matchId);
  const [homeSquad, awaySquad] = await Promise.all([getTeam(m.homeTeamId), getTeam(m.awayTeamId)]);
  const options = (team) =>
    (team?.squad || []).map((p) => ({ value: p.id, label: `${p.shirtNumber ?? '–'} ${p.name}` }));

  const list = (m.events || [])
    .map(
      (e) => `<tr>
        <td>${e.minute}'</td>
        <td>${esc(e.type)}</td>
        <td>${esc(e.playerName || '')}</td>
        <td>${esc(e.secondaryName || '')}</td>
        <td class="actions"><button class="btn sm danger" data-del="${e.id}">✕</button></td>
      </tr>`
    )
    .join('');

  const body = `
    <div class="ablock">
      <h3>${esc(m.home.team?.shortName || m.homeTeamId)} vs ${esc(m.away.team?.shortName || m.awayTeamId)}</h3>
      <div class="abody">
        <div class="grid3">
          ${field('Type', select('type', EVENT_TYPES, 'goal', 'id="eType"'))}
          ${field('Team', select('teamId', [{ value: m.homeTeamId, label: m.home.team.shortName }, { value: m.awayTeamId, label: m.away.team.shortName }], m.homeTeamId, 'id="eTeam"'))}
          ${field('Minute', numberInput('minute', m.minute ?? 1))}
          ${field('Player (scorer / on)', select('playerId', options(homeSquad), '', 'id="ePlayer"'))}
          ${field('Secondary (assist / off)', select('secondaryPlayerId', [{ value: '', label: '— none —' }, ...options(homeSquad)], '', 'id="eSecond"'))}
          ${field('Note', textInput('note', ''))}
        </div>
        <p class="hint">The scoreline is recalculated from these events, so goals, penalties and own goals update it automatically. Use the ticker's +1 buttons when you want to change a score without logging an event.</p>
      </div>
    </div>
    ${showList || (m.events || []).length
      ? `<div class="ablock"><h3>Events</h3><div class="abody tight">
          <table class="atable"><thead><tr><th>Min</th><th>Type</th><th>Player</th><th>2nd</th><th></th></tr></thead>
          <tbody>${list || '<tr><td colspan="5" class="muted">No events</td></tr>'}</tbody></table>
        </div></div>`
      : ''}`;

  openModal('Match events', body, `
    <button class="btn ghost" data-close>Close</button>
    <button class="btn primary" id="eAdd">Add event</button>
  `);

  const resync = (teamId) => {
    const squad = teamId === m.homeTeamId ? homeSquad : awaySquad;
    const opts = [{ value: '', label: '— none —' }, ...options(squad)].map(
      (o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`
    ).join('');
    const main = [{ value: '', label: '— pick player —' }, ...options(squad)].map(
      (o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`
    ).join('');
    qs('#ePlayer', el.modalBody).innerHTML = main;
    qs('#eSecond', el.modalBody).innerHTML = opts;
  };
  resync(m.homeTeamId);

  qs('#eTeam', el.modalBody).addEventListener('change', (e) => resync(e.target.value));

  el.modalBody.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    await call(`events/${del.dataset.del}`, { method: 'DELETE' });
    invalidate(matchId);
    openEventModal(matchId, true);
  });

  qs('#eAdd', el.modal).onclick = async () => {
    const f = formValues(el.modalBody);
    if (!f.playerId) return toast('Pick a player');
    const payload = {
      type: f.type,
      teamId: f.teamId,
      playerId: f.playerId,
      secondaryPlayerId: f.secondaryPlayerId || null,
      minute: Number(f.minute) || 1,
      addedTime: Number(f.addedTime) || 0,
      note: f.note,
    };
    try {
      await call(`matches/${encodeURIComponent(matchId)}/events`, { method: 'POST', body: payload });
      invalidate(matchId);
      closeModal();
      rerender();
    } catch (_) {}
  };
}

async function openStatsModal(matchId) {
  const m = await getMatch(matchId);
  const keys = [
    ['Possession %', 'possession'],
    ['Shots', 'shots'],
    ['Shots on target', 'shotsOnTarget'],
    ['Corners', 'corners'],
    ['Fouls', 'fouls'],
    ['Yellow cards', 'yellowCards'],
    ['Red cards', 'redCards'],
    ['Offsides', 'offsides'],
    ['Passes', 'passes'],
    ['Pass accuracy %', 'passAccuracy'],
    ['Tackles', 'tackles'],
    ['Saves', 'saves'],
    ['Big chances', 'bigChances'],
    ['xG', 'xg'],
  ];
  const h = m.stats?.home || {};
  const a = m.stats?.away || {};

  const body = `
    <div class="ablock">
      <h3>${esc(m.home.team?.shortName || m.homeTeamId)} <span style="color:var(--text-mute)">vs</span> ${esc(m.away.team?.shortName || m.awayTeamId)}</h3>
      <div class="abody tight">
        <table class="atable">
          <thead><tr><th>Stat</th><th class="num">${esc(m.home.team.code || 'Home')}</th><th class="num">${esc(m.away.team.code || 'Away')}</th></tr></thead>
          <tbody>
            ${keys
              .map(
                ([label, key]) => `<tr>
                  <td>${esc(label)}</td>
                  <td><input type="number" step="${key === 'xg' ? '0.01' : '1'}" name="home.${key}" value="${esc(h[key] ?? '')}" /></td>
                  <td><input type="number" step="${key === 'xg' ? '0.01' : '1'}" name="away.${key}" value="${esc(a[key] ?? '')}" /></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  openModal('Match stats', body, `
    <button class="btn ghost" data-close>Cancel</button>
    <button class="btn primary" id="sSave">Save stats</button>
  `);

  qs('#sSave', el.modal).onclick = async () => {
    const f = formValues(el.modalBody);
    const build = (side) => {
      const out = {};
      for (const [, key] of keys) {
        const v = f[`${side}.${key}`];
        out[key] = v === '' || v == null ? null : Number(v);
      }
      return out;
    };
    try {
      await call(`matches/${encodeURIComponent(matchId)}/stats`, {
        method: 'PUT',
        body: { home: build('home'), away: build('away') },
      });
      invalidate(matchId);
      closeModal();
      rerender();
    } catch (_) {}
  };
}

async function openLineupsModal(matchId) {
  const m = await getMatch(matchId);
  const body = `
    <div class="ablock">
      <h3>${esc(m.home.team?.shortName || m.homeTeamId)} vs ${esc(m.away.team?.shortName || m.awayTeamId)}</h3>
      <div class="abody">
        <p class="hint" style="margin-top:0">
          “Auto pick” builds a 4-3-3 starting eleven plus a bench from the squad list.
          After that, use the events tab to record substitutions — they show up in the line-ups.
        </p>
        <button class="btn primary" id="luAuto">Auto pick line-ups</button>
      </div>
    </div>`;
  openModal('Line-ups', body, '<button class="btn ghost" data-close>Close</button>');
  qs('#luAuto', el.modalBody).onclick = async () => {
    try {
      await call(`matches/${encodeURIComponent(matchId)}/lineups/auto`, { method: 'POST' });
      invalidate(matchId);
      closeModal();
      rerender();
    } catch (_) {}
  };
}

async function openTeamModal(id) {
  const existing = id ? S.overview.teams.find((t) => t.id === id) : null;
  const comps = S.overview.competitions;
  const body = `
    <div class="grid2">
      ${field('Club name', textInput('name', existing?.name || ''))}
      ${field('Short name', textInput('shortName', existing?.shortName || ''))}
      ${field('Code (3 letters)', textInput('code', existing?.code || ''))}
      ${field('Colour', `<input type="color" name="color" value="${esc(existing?.color || '#8a94a6')}" />`)}
      ${field('Emblem (emoji or image URL)', textInput('emblem', existing?.emblem || ''))}
      ${field('Stadium', textInput('venue', existing?.venue || ''))}
      ${field('City', textInput('city', existing?.city || ''))}
      ${field('Country', textInput('country', existing?.country || ''))}
      ${field('Manager', textInput('manager', existing?.manager || ''))}
      ${field('Founded', numberInput('founded', existing?.founded ?? ''))}
    </div>
    <div class="field" style="margin-top:10px">
      <label>Competitions</label>
      <div class="tags">
        ${comps
          .map(
            (c) => `<label class="tag ${existing && (existing.competitions || []).includes(c.id) ? 'on' : ''}">
              <input type="checkbox" name="competitions" value="${esc(c.id)}" ${existing && (existing.competitions || []).includes(c.id) ? 'checked' : ''} style="width:auto" />
              ${esc(c.shortName || c.name)}
            </label>`
          )
          .join('')}
      </div>
    </div>`;

  openModal(id ? 'Edit team' : 'Add team', body, `
    <button class="btn ghost" data-close>Cancel</button>
    <button class="btn primary" id="tSave">Save</button>
  `);

  qs('#tSave', el.modal).onclick = async () => {
    const f = formValues(el.modalBody);
    const compsSelected = qsa('input[name="competitions"]:checked', el.modalBody).map((i) => i.value);
    const payload = {
      name: f.name,
      shortName: f.shortName,
      code: f.code,
      color: f.color,
      emblem: f.emblem,
      venue: f.venue,
      city: f.city,
      country: f.country,
      manager: f.manager,
      founded: f.founded === '' ? null : Number(f.founded),
      competitions: compsSelected,
    };
    try {
      if (id) await call(`teams/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
      else await call('teams', { method: 'POST', body: payload });
      S.teamCache.clear();
      closeModal();
      rerender();
    } catch (_) {}
  };
}

async function openSquadModal(teamId) {
  const team = S.overview.teams.find((t) => t.id === teamId);
  const detail = await getTeam(teamId);
  const rows = (detail.squad || [])
    .map(
      (p) => `<tr data-player="${esc(p.id)}">
        <td><input type="number" name="shirtNumber" value="${esc(p.shirtNumber ?? '')}" class="num" /></td>
        <td><input name="name" value="${esc(p.name)}" /></td>
        <td>${select('position', POSITIONS, p.position)}</td>
        <td><input name="nationality" value="${esc(p.nationality || '')}" /></td>
        <td><input type="number" name="age" value="${esc(p.age ?? '')}" class="num" /></td>
        <td class="actions">
          <button class="btn sm" data-act="save-player">Save</button>
          <button class="btn sm danger" data-act="del-player">✕</button>
        </td>
      </tr>`
    )
    .join('');

  const body = `
    <div class="ablock">
      <h3>${esc(team?.name || 'Squad')}</h3>
      <div class="abody tight">
        <table class="atable">
          <thead><tr><th>No</th><th>Player</th><th>Pos</th><th>Nationality</th><th>Age</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted">No players yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="ablock">
      <h3>Add player</h3>
      <div class="abody">
        <div class="grid3">
          ${field('Shirt no.', numberInput('new.shirtNumber', ''))}
          ${field('Name', textInput('new.name', ''))}
          ${field('Position', select('new.position', POSITIONS, 'MF'))}
          ${field('Nationality', textInput('new.nationality', ''))}
          ${field('Age', numberInput('new.age', ''))}
        </div>
        <div style="margin-top:10px"><button class="btn primary" id="pAdd">Add player</button></div>
      </div>
    </div>`;

  openModal('Squad', body, '<button class="btn ghost" data-close>Close</button>');

  el.modalBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const tr = btn.closest('[data-player]');
    const pid = tr.dataset.player;
    if (btn.dataset.act === 'save-player') {
      const inputs = qsa('input,select', tr);
      const payload = { teamId };
      for (const i of inputs) payload[i.name] = i.value;
      payload.shirtNumber = payload.shirtNumber === '' ? null : Number(payload.shirtNumber);
      payload.age = payload.age === '' ? null : Number(payload.age);
      try {
        await call(`players/${encodeURIComponent(pid)}`, { method: 'PUT', body: payload });
        S.teamCache.clear();
      } catch (_) {}
    }
    if (btn.dataset.act === 'del-player') {
      if (!confirm('Delete this player?')) return;
      await call(`players/${encodeURIComponent(pid)}`, { method: 'DELETE' });
      S.teamCache.clear();
      openSquadModal(teamId);
    }
  });

  qs('#pAdd', el.modalBody).onclick = async () => {
    const f = formValues(el.modalBody);
    const payload = {
      teamId,
      name: f['new.name'],
      position: f['new.position'],
      shirtNumber: f['new.shirtNumber'] === '' ? null : Number(f['new.shirtNumber']),
      nationality: f['new.nationality'],
      age: f['new.age'] === '' ? null : Number(f['new.age']),
    };
    if (!payload.name) return toast('Name required');
    try {
      await call('players', { method: 'POST', body: payload });
      S.teamCache.clear();
      const detail2 = await getTeam(teamId);
      S.teamCache.set(teamId, detail2);
      openSquadModal(teamId);
    } catch (_) {}
  };
}

async function openCompetitionModal(id) {
  const comps = S.overview.competitions;
  const existing = id ? comps.find((c) => c.id === id) : null;
  const zones = existing?.zones || [];
  const body = `
    <div class="grid2">
      ${field('Name', textInput('name', existing?.name || ''))}
      ${field('Short name', textInput('shortName', existing?.shortName || ''))}
      ${field('Country / region', textInput('country', existing?.country || ''))}
      ${field('Season', textInput('season', existing?.season || ''))}
      ${field('Type', select('type', ['league', 'cup'], existing?.type || 'league'))}
      ${field('Stage', textInput('stage', existing?.stage || ''))}
      ${field('Colour', `<input type="color" name="color" value="${esc(existing?.color || '#00e07a')}" />`)}
      ${field('Emblem (emoji or URL)', textInput('emblem', existing?.emblem || ''))}
      ${field('Points for a win', numberInput('pointsWin', existing?.pointsWin ?? 3))}
      ${field('Points for a draw', numberInput('pointsDraw', existing?.pointsDraw ?? 1))}
      ${field('Sort order', numberInput('sortOrder', existing?.sortOrder ?? 0))}
    </div>
    <div class="field" style="margin-top:10px">
      <label>Table zones (JSON)</label>
      <textarea name="zones">${esc(JSON.stringify(zones, null, 2))}</textarea>
      <span class="hint">e.g. <code>[{"from":1,"to":4,"color":"#2f7cf6","label":"Champions League"}]</code></span>
    </div>`;

  openModal(id ? 'Edit league' : 'Add league', body, `
    <button class="btn ghost" data-close>Cancel</button>
    <button class="btn primary" id="cSave">Save</button>
  `);

  qs('#cSave', el.modal).onclick = async () => {
    const f = formValues(el.modalBody);
    let parsedZones = [];
    try {
      parsedZones = JSON.parse(f.zones || '[]');
    } catch (_) {
      return toast('Invalid zones JSON');
    }
    const payload = {
      name: f.name,
      shortName: f.shortName,
      country: f.country,
      season: f.season,
      type: f.type,
      stage: f.stage,
      color: f.color,
      emblem: f.emblem,
      pointsWin: Number(f.pointsWin) || 3,
      pointsDraw: Number(f.pointsDraw) || 1,
      sortOrder: Number(f.sortOrder) || 0,
      zones: parsedZones,
    };
    try {
      if (id) await call(`competitions/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
      else await call('competitions', { method: 'POST', body: payload });
      closeModal();
      rerender();
    } catch (_) {}
  };
}

/* ------------------------------------------------------------------ */
/* form helpers                                                        */
/* ------------------------------------------------------------------ */

function formValues(root) {
  const out = {};
  qsa('input,select,textarea', root).forEach((i) => {
    if (!i.name) return;
    if (i.type === 'checkbox') out[i.name] = i.checked;
    else out[i.name] = i.value;
  });
  return out;
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */

let rendering = false;

async function rerender() {
  if (rendering) return;
  rendering = true;
  try {
    await loadOverview();
    const section = sections[S.section];
    el.main.innerHTML = await section.render();
    section.mount?.(el.main);
  } catch (err) {
    console.error('[admin] section failed', err);
    el.main.innerHTML = `<div class="ablock"><div class="abody"><p class="muted">${esc(err.message)}</p></div></div>`;
  } finally {
    rendering = false;
  }
}

el.nav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-section]');
  if (!btn) return;
  S.section = btn.dataset.section;
  qsa('button', el.nav).forEach((b) => b.classList.toggle('active', b === btn));
  window.scrollTo({ top: 0 });
  rerender();
});

el.modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

el.btnExport.addEventListener('click', async () => {
  try {
    const res = await api.admin('export', { method: 'POST' });
    toast(`Exported ${res.exported?.files} files`);
  } catch (err) {
    toast(err.message);
  }
});

el.btnPublish.addEventListener('click', async () => {
  try {
    const res = await api.admin('publish', { method: 'POST', body: { message: 'Update LeagueLive data' } });
    toast('Pushed to GitHub');
    void res;
  } catch (err) {
    toast(err.message);
  }
});

el.btnLogout.addEventListener('click', () => {
  api.adminToken.clear();
  el.panel.hidden = true;
  el.actions.hidden = true;
  el.login.hidden = false;
});

qs('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginErr.hidden = true;
  const password = qs('#password').value;
  try {
    const res = await api.admin('login', { method: 'POST', body: { password } });
    api.adminToken.set(res.token);
    el.login.hidden = true;
    el.panel.hidden = false;
    el.actions.hidden = false;
    await rerender();
  } catch (err) {
    el.loginErr.textContent = err.message || 'Sign-in failed';
    el.loginErr.hidden = false;
  }
});

/* ------------------------------- startup ---------------------------- */

(async function boot() {
  await api.detectMode();
  if (api.state.mode !== 'server') {
    el.login.innerHTML = `
      <h1>Static mode</h1>
      <p class="muted">
        This copy of LeagueLive is served as static files (e.g. GitHub Pages), so there is no
        backend to sign in to. Run the server locally with <code>npm start</code> and open
        <code>http://localhost:3000/admin</code> to update scores and data.
      </p>`;
    return;
  }
  if (api.adminToken.get()) {
    try {
      await api.admin('session');
      el.login.hidden = true;
      el.panel.hidden = false;
      el.actions.hidden = false;
      await rerender();
    } catch (_) {
      api.adminToken.clear();
    }
  }
})();
