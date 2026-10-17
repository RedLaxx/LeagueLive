/* LeagueLive — app shell, hash router and live refresh. */

import * as api from './api.js';
import { bus } from './bus.js';
import { qs, qsa, esc, skeletons, empty, toast } from './util.js';
import { favs } from './favs.js';

import * as homeView from './views/home.js';
import * as competitionView from './views/competition.js';
import * as matchView from './views/match.js';
import * as teamView from './views/team.js';
import * as playerView from './views/player.js';
import { leagues, scorers, search, my } from './views/misc.js';

const view = qs('#view');
const topTitle = qs('#topTitle');
const brand = qs('#brand');
const backBtn = qs('#backBtn');
const statusline = qs('#statusline');

const TOP_LEVEL = ['/', '/leagues', '/scorers', '/search', '/my'];

const routes = [
  { re: /^\/?$/, view: homeView, tab: 'matches', title: 'LeagueLive' },
  { re: /^\/leagues$/, view: leagues, tab: 'leagues', title: 'Leagues' },
  { re: /^\/competition\/([^/?]+)$/, view: competitionView, tab: 'leagues' },
  { re: /^\/match\/([^/?]+)$/, view: matchView },
  { re: /^\/team\/([^/?]+)$/, view: teamView },
  { re: /^\/player\/([^/?]+)$/, view: playerView },
  { re: /^\/scorers$/, view: scorers, tab: 'scorers', title: 'Top scorers' },
  { re: /^\/search$/, view: search, tab: 'search', title: 'Search' },
  { re: /^\/my$/, view: my, tab: 'my', title: 'My Teams' },
];

const ctx = {
  query: {},
  title: '',
  setQuery(patch) {
    const next = { ...ctx.query, ...patch };
    for (const k of Object.keys(patch)) if (patch[k] == null || patch[k] === '') delete next[k];
    const sp = new URLSearchParams(next).toString();
    const path = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
    history.replaceState(null, '', `#${path}${sp ? `?${sp}` : ''}`);
    ctx.query = next;
  },
};

let current = null;
let rendering = false;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, searchPart = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(searchPart));
  return { path: path || '/', query };
}

function markTab(name) {
  qsa('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
}

function updateChrome(route, params) {
  const isTop = TOP_LEVEL.includes(current.path);
  backBtn.hidden = isTop;
  brand.hidden = !isTop;
  topTitle.hidden = isTop;
  const title = ctx.title || (typeof route.title === 'function' ? route.title(params) : route.title);
  if (!isTop) topTitle.textContent = title || 'LeagueLive';
  document.title = `${title || 'LeagueLive'} · LeagueLive`;
  if (route.tab) markTab(route.tab);
}

function updateStatus() {
  const at = api.state.generatedAt ? new Date(api.state.generatedAt) : null;
  const modeLabel = api.state.mode === 'server' ? 'Live server' : 'Snapshot';
  statusline.hidden = false;
  statusline.innerHTML = `
    <b>${esc(modeLabel)}</b>
    <span>·</span>
    <span>Updated ${at ? esc(at.toLocaleString()) : '—'}</span>
    ${api.state.mode === 'server' ? '<span>·</span><a href="admin.html" style="color:var(--accent);font-weight:700">Admin</a>' : ''}`;
}

async function renderRoute({ fresh = false, keepScroll = false, keepFocus = false } = {}) {
  if (rendering) return;
  rendering = true;
  const scroll = window.scrollY;
  const focusId = document.activeElement?.id;
  const focusPos = document.activeElement?.selectionStart;

  const { path, query } = parseHash();
  const route = routes.find((r) => r.re.test(path));
  ctx.query = query;
  ctx.title = '';

  if (!route) {
    view.innerHTML = empty('Page not found', 'Use the tabs below to get back.');
    rendering = false;
    return;
  }

  const params = (path.match(route.re) || []).slice(1);
  current = { path, route, params, query };

  if (!keepScroll) {
    view.innerHTML = skeletons(5);
    window.scrollTo({ top: 0 });
  }

  try {
    if (fresh) api.state.forceFresh = true;
    const html = await route.view.render({ params: params.map(decodeURIComponent), query, ctx });
    view.innerHTML = html;
    route.view.mount?.(view, ctx);
    updateChrome(route, params);
    updateStatus();
  } catch (err) {
    console.error(err);
    view.innerHTML = empty('Could not load this page', err.message || 'Please try again.');
  } finally {
    api.state.forceFresh = false;
    if (keepScroll) window.scrollTo({ top: scroll });
    if (keepFocus && focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (focusPos != null && el.setSelectionRange) {
          try {
            el.setSelectionRange(focusPos, focusPos);
          } catch (_) {}
        }
      }
    }
    rendering = false;
  }
}

/* ------------------------------- listeners ------------------------------ */

window.addEventListener('hashchange', () => renderRoute());

view.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabs [data-tab]');
  if (!tabBtn) return;
  e.preventDefault();
  ctx.setQuery({ tab: tabBtn.dataset.tab });
  renderRoute({ keepScroll: true });
});

bus.on('rerender', (opts) => renderRoute({ keepScroll: true, ...(opts || {}) }));
window.addEventListener('favs:change', () => renderRoute({ keepScroll: true }));

qs('#refreshBtn').addEventListener('click', () => {
  renderRoute({ fresh: true, keepScroll: true });
  toast('Refreshing…');
});

backBtn.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.hash = '#/';
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) {
    e.preventDefault();
    location.hash = '#/search';
  }
  if (e.key === 'r' && (e.metaKey || e.ctrlKey)) return;
});

/* -------------------------------- startup ------------------------------- */

let refreshTimer = null;

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = api.state.mode === 'server' ? 20000 : 180000;
  refreshTimer = setInterval(() => {
    if (document.hidden) return;
    if (!current) return;
    const p = current.path;
    const isLiveish = /^\/($|\?)|^\/match\//.test(p) || p === '/my';
    if (!isLiveish) return;
    renderRoute({ fresh: true, keepScroll: true });
  }, interval);
}

async function boot() {
  await api.detectMode();
  await renderRoute();
  startAutoRefresh();

  // keep the snapshot reasonably warm when hosting statically
  if (api.state.mode === 'static') {
    setInterval(() => {
      if (!document.hidden) api.clearCache();
    }, 10 * 60 * 1000);
  }
}

boot();

// expose a tiny debug handle
window.LeagueLive = { api, favs, render: renderRoute, ctx };
