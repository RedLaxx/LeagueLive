/* LeagueLive — small helpers shared by every view. */

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

/* ------------------------------ formatting ------------------------------ */

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateKey(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDayLabel(iso) {
  const d = new Date(iso);
  const k = dateKey(iso);
  if (k === todayKey()) return 'Today';
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (k === dateKey(t)) return 'Tomorrow';
  t.setDate(t.getDate() - 2);
  if (k === dateKey(t)) return 'Yesterday';
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function fmtShortDay(iso) {
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function fmtFullDateTime(iso) {
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} · ${fmtTime(iso)}`;
}

export function initials(name) {
  const parts = String(name || '')
    .replace(/^(FC|AFC|AS|SS|AC|RB|VfB|SV|CD|UD|CF|IF|IL|BK)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------- rendering ------------------------------ */

export function crest(team, cls = '') {
  const safe = esc(team?.shortName || team?.name || '?');
  const color = esc(team?.color || '#39414f');
  if (team?.emblem && /^(https?:|data:|\/|\.\/)/.test(team.emblem)) {
    return `<span class="crest ${cls}" style="background:${color}" title="${safe}"><img src="${esc(team.emblem)}" alt="${safe}" loading="lazy"></span>`;
  }
  if (team?.emblem && team.emblem.length <= 4 && /\p{Extended_Pictographic}/u.test(team.emblem)) {
    return `<span class="crest ${cls}" style="background:${color}" title="${safe}">${esc(team.emblem)}</span>`;
  }
  return `<span class="crest ${cls}" style="background:${color}" title="${safe}">${esc(initials(team?.name))}</span>`;
}

export function statusPill(match) {
  if (match.status === 'live') {
    const m = match.minute ? `${match.minute}${match.addedTime ? `+${match.addedTime}` : ''}'` : "LIVE";
    return `<span class="pill live"><i class="livedot"></i>${esc(m)}</span>`;
  }
  if (match.status === 'ht') return `<span class="pill ht">HT</span>`;
  if (match.status === 'ft') return `<span class="pill ft">FT</span>`;
  if (match.status === 'postponed') return `<span class="pill ft">POSTP</span>`;
  if (match.status === 'cancelled') return `<span class="pill ft">CANC</span>`;
  return `<span class="pill up">${esc(fmtTime(match.kickoff))}</span>`;
}

export function matchTimeCell(match) {
  if (match.status === 'live') {
    const m = match.minute ? `${match.minute}${match.addedTime ? `+${match.addedTime}` : ''}'` : 'LIVE';
    return `<span class="pill live"><i class="livedot"></i>${esc(m)}</span>`;
  }
  if (match.status === 'ht') return `<span class="pill ht">HT</span>`;
  if (match.status === 'ft') return `<span class="pill ft">FT</span>`;
  return esc(fmtTime(match.kickoff));
}

export function formStrip(form = []) {
  if (!form.length) return '<span class="muted">—</span>';
  return `<span class="formrow">${form.map((f) => `<i class="${esc(f)}">${esc(f)}</i>`).join('')}</span>`;
}

export function groupBy(list, keyFn) {
  const out = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export function empty(title, body) {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body || '')}</p></div>`;
}

export function skeletons(n = 4) {
  return Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

let toastTimer;
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 2200);
}

export function posLabel(n) {
  return { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' }[n] || n || '';
}

/** Brighten/darken a hex colour so white text always reads on it. */
export function readable(hex) {
  const h = String(hex || '#39414f').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.72 ? '#1b2230' : '#ffffff';
}
