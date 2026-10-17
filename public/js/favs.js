/* LeagueLive — local favourites (teams, leagues, followed matches). */

const KEY = 'leaguelive.favourites.v1';

const defaults = { teams: [], competitions: [], matches: [] };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch (_) {
    return { ...defaults };
  }
}

function write(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('favs:change'));
}

export const favs = {
  all: () => read(),

  hasTeam: (id) => read().teams.includes(id),
  toggleTeam(id) {
    const s = read();
    s.teams = s.teams.includes(id) ? s.teams.filter((x) => x !== id) : [...s.teams, id];
    write(s);
    return s.teams.includes(id);
  },

  hasCompetition: (id) => read().competitions.includes(id),
  toggleCompetition(id) {
    const s = read();
    s.competitions = s.competitions.includes(id)
      ? s.competitions.filter((x) => x !== id)
      : [...s.competitions, id];
    write(s);
    return s.competitions.includes(id);
  },

  hasMatch: (id) => read().matches.includes(id),
  toggleMatch(id) {
    const s = read();
    s.matches = s.matches.includes(id) ? s.matches.filter((x) => x !== id) : [...s.matches, id];
    write(s);
    return s.matches.includes(id);
  },

  clear() {
    write({ ...defaults });
  },
};
