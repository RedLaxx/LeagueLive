/**
 * LeagueLive — data access.
 *
 * The same frontend runs in two modes:
 *   • "server" — talking to the Express API (instant live updates)
 *   • "static" — reading the JSON snapshot in ./data (GitHub Pages)
 * It detects which one it is on start-up.
 */

const cache = new Map();

export const state = {
  mode: 'static',
  ready: false,
  generatedAt: null,
  /** when true, the next read bypasses the in-memory cache (used by auto-refresh) */
  forceFresh: false,
};

const serverPaths = {
  bootstrap: 'api/bootstrap',
  home: 'api/home',
  live: 'api/live',
  competition: (id) => `api/competition/${encodeURIComponent(id)}`,
  match: (id) => `api/match/${encodeURIComponent(id)}`,
  team: (id) => `api/team/${encodeURIComponent(id)}`,
  player: (id) => `api/player/${encodeURIComponent(id)}`,
  players: 'api/scorers?limit=100000',
  scorers: (cid) => `api/scorers?competition=${encodeURIComponent(cid)}&limit=60`,
  search: 'api/search',
};

const staticPaths = {
  bootstrap: 'data/bootstrap.json',
  home: 'data/home.json',
  live: 'data/live.json',
  competition: (id) => `data/competition-${id}.json`,
  match: (id) => `data/match-${id}.json`,
  team: (id) => `data/team-${id}.json`,
  player: (id) => `data/player-${id}.json`,
  players: 'data/players.json',
  scorers: (cid) => `data/competition-${cid}.json`,
  search: 'data/search.json',
};

function paths() {
  return state.mode === 'server' ? serverPaths : staticPaths;
}

async function fetchJson(url, { noStore = true } = {}) {
  const res = await fetch(url, { cache: noStore ? 'no-store' : 'default' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function detectMode() {
  try {
    const res = await fetch('api/health', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.mode === 'server') {
        state.mode = 'server';
        state.ready = true;
        return state.mode;
      }
    }
  } catch (_) {
    /* no server — fall through to static */
  }
  state.mode = 'static';
  state.ready = true;
  return state.mode;
}

async function get(key, urlFn, { fresh = false } = {}) {
  if (!fresh && !state.forceFresh && cache.has(key)) return cache.get(key);
  const url = typeof urlFn === 'function' ? urlFn() : urlFn;
  const data = await fetchJson(url);
  if (data?.generatedAt) state.generatedAt = data.generatedAt;
  cache.set(key, data);
  return data;
}

export function clearCache() {
  cache.clear();
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export const bootstrap = (fresh) => get('bootstrap', paths().bootstrap, { fresh });
export const home = (fresh) => get('home', paths().home, { fresh });
export const live = (fresh) => get('live', paths().live, { fresh });
export const searchIndex = (fresh) => get('search', paths().search, { fresh });

export const competition = (id, fresh) => get(`competition:${id}`, () => paths().competition(id), { fresh });
export const match = (id, fresh) => get(`match:${id}`, () => paths().match(id), { fresh });
export const team = (id, fresh) => get(`team:${id}`, () => paths().team(id), { fresh });
export const player = (id, fresh) => get(`player:${id}`, () => paths().player(id), { fresh });

/** Full player detail (with goal log) for the scorers page. */
export async function allPlayers(fresh = false) {
  if (state.mode === 'server') {
    const data = await get('players', serverPaths.players, { fresh });
    return data.players || [];
  }
  const data = await get('players', staticPaths.players, { fresh });
  return Array.isArray(data) ? data : data.players || [];
}

export async function scorers(competitionId, fresh = false) {
  if (state.mode === 'server') {
    const data = await fetchJson(paths().scorers(competitionId));
    return data.players || [];
  }
  const data = await competition(competitionId, fresh);
  return data.topScorers || [];
}

/* ------------------------------------------------------------------ */
/* admin API (server mode only)                                        */
/* ------------------------------------------------------------------ */

const TOKEN_KEY = 'leaguelive.admin.token';

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function admin(path, { method = 'GET', body } = {}) {
  const res = await fetch(`api/admin/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken.get() ? { Authorization: `Bearer ${adminToken.get()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    json = {};
  }
  if (!res.ok) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}
