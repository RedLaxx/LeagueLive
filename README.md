# ⚽ LeagueLive

A lightweight, mobile-first **football livescore & league table app** with a proper backend — think a Fotmob-style experience that *you* control: you enter the scores, the players, the goal scorers, and the app updates everywhere.

- **Website** — installable PWA, dark Fotmob-like UI, live scores, league tables, top scorers, match centres, squads, H2H, search, favourites.
- **Backend** — Node + Express + **SQLite** (built into Node, no native modules) with a password-protected admin panel for updating everything in real time.
- **Hosting** — runs anywhere as a tiny server, **and** publishes a static snapshot to **GitHub Pages** so it's reachable at a public URL.

```
Repo size: 1 npm dependency (express). Node ≥ 22.5.
```

---

## 1. Quick start

```bash
git clone https://github.com/RedLaxx/LeagueLive.git
cd LeagueLive
npm install          # installs express + seeds demo data
npm start            # http://localhost:3000
```

| URL | What it is |
| --- | --- |
| <http://localhost:3000> | the app |
| <http://localhost:3000/admin> | the admin panel |

**Default admin password:** `leaguelive`

The first run seeds a ready-made demo database: 6 competitions (Premier League, LaLiga, Serie A, Bundesliga, NPFL, Champions League), 56 clubs, ~1,000 players, 700 fixtures, 9 matches in play right now, full league tables and top scorers. Replace it whenever you like.

### Useful commands

```bash
npm start            # run the server (website + API + admin)
npm run dev          # same, with auto-restart on file changes
npm run seed         # add demo data if the database is empty
npm run reset        # wipe and rebuild the demo data from scratch
npm run export       # rebuild public/data (static snapshot) + data/db.json
```

---

## 2. Hosting it on GitHub Pages (the public URL)

GitHub Pages only serves static files, so LeagueLive works in two modes and the **same** frontend detects which one it's in:

| Mode | Data source | Updates |
| --- | --- | --- |
| **server** | live Express API + SQLite | instantly, as you type in the admin panel |
| **static** | JSON files in `public/data/` | on every push / hourly rebuild |

`.github/workflows/deploy-pages.yml` turns the committed `data/db.json` into the static snapshot and deploys it.

### One-time setup

1. Push to `main`.
2. In the repo: **Settings → Pages → Source → GitHub Pages** (the workflow uploads the artifact automatically). Or run once:

   ```bash
   gh api -X POST repos/RedLaxx/LeagueLive/pages -f build_type=workflow
   ```

3. After the first successful deploy your site lives at:

   ```
   https://redlaxx.github.io/LeagueLive/
   ```

The workflow also re-runs **hourly**, which keeps the "today" window of the static snapshot centred on the current date even between commits.

### Publishing straight from the admin panel

Start the server with git publishing enabled and the **Publish** button will export, commit and push for you:

```bash
ENABLE_GIT_PUBLISH=1 npm start
```

Then hit **Publish** in *Admin → Data*. GitHub Pages redeploys in about a minute.

---

## 3. Configuration

All optional — set them in the environment (or a `.env`-style export) before `npm start`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | bind address |
| `ADMIN_PASSWORD` | `leaguelive` | admin panel password |
| `ENABLE_GIT_PUBLISH` | `0` | set to `1` to allow export + commit + push from the UI |
| `AUTO_EXPORT` | `1` | set to `0` to stop auto-rebuilding the static snapshot on every edit |
| `LEAGUELIVE_DATA` | `./data` | where `db.json` and `leaguelive.db` live |
| `LEAGUELIVE_DB` | `./data/leaguelive.db` | SQLite file path |

---

## 4. What the app does

### Matches
- **Live now** section with pulsing minute badges
- Scrollable 15-day date strip; matches grouped by competition
- Auto-refresh every 20 seconds while a server is available (3 min on static hosting)
- Tap any match for the match centre

### Match centre
Big score header, then five tabs:
- **Summary** — chronological event feed (goals, penalties, own goals, cards, subs, VAR) with a running scoreline
- **Stats** — 14 head-to-head team stats with comparison bars (possession, shots, xG, passes…)
- **Line-ups** — starting XI + bench, captain, subs with minutes
- **H2H** — previous meetings with a win/draw/loss split
- **Table** — the competition table

### Leagues
- Table with **zone colours** (Champions League / Europa / relegation…), form guide (last 5), home/away splits
- **Fixtures** — upcoming + results, per round, with venue
- **Top scorers** — goals, assists, penalties, apps
- **Teams** — jump into any club

### Teams & players
- Club page: manager, stadium, founded, form, fixtures, results, full squad with season stats, standings per competition
- Player page: goals, assists, apps, cards, goals split by competition, and a dated **goal log** linking back to each match

### Search & My Teams
- Instant search across clubs, players and leagues
- **Follow** any team, league or individual match — everything you follow collects in **My Teams** with live scores

---

## 5. The admin backend

Sign in at `/admin`.

### Live ticker
The fast path for matchday. For every match in play:
- `+1 / −1` buttons for either side
- minute input (or **Live / HT / FT** shortcuts)
- add events: goal, penalty, own goal, missed penalty, yellow, second yellow, red, sub, VAR — pick the player from the squad
- delete any event

> The scoreline is **derived from the goal events**, so the score and the commentary can never drift apart. Use the `+1` buttons when you just want to change the number without logging a scorer.

### Matches
Add, edit, delete fixtures — teams, kick-off, round, venue, referee, attendance, status, minute, score.

### Fixtures
Generate a full round-robin calendar (circle method, home & away optional) with a start date, interval between rounds and kick-off hour. Also a **quick team import** — paste club names, one per line.

### Teams & squads
Add clubs (name, short name, code, colour, emblem emoji/URL, stadium, city, country, manager, founded) and assign them to competitions. The squad editor lets you add, edit and delete players (shirt number, name, position, nationality, age).

### Leagues
Create competitions with name, country, season, type (league/cup), stage, colour, emblem, points per win/draw, sort order, and **table zones** as JSON:

```json
[
  { "from": 1,  "to": 4,  "color": "#2f7cf6", "label": "Champions League" },
  { "from": 5,  "to": 5,  "color": "#f6a723", "label": "Europa League"   },
  { "from": 18, "to": 20, "color": "#ef4444", "label": "Relegation"      }
]
```

### Data
- **Export snapshot** — writes `public/data/*.json` + `data/db.json`
- **Publish** — export, commit and push (when `ENABLE_GIT_PUBLISH=1`)
- **Import** — replace the whole database from a `db.json` payload

---

## 6. How the data is stored

```
data/db.json          ← committed master copy of the whole database (plain JSON)
data/leaguelive.db    ← SQLite working copy (gitignored, rebuilt from db.json)
public/data/*.json    ← generated static snapshot (gitignored, built by CI)
```

`data/db.json` is the single source of truth: it's what the GitHub Pages workflow reads, and it's what you'd copy to another machine. SQLite is the live working set the server reads and writes. Every admin change touches SQLite and then re-exports `db.json` + the snapshot automatically.

> Only `data/db.json` is committed, so a busy season will grow the repo by ~2.5 MB per full rewrite. If that bothers you, keep `data/` out of git and deploy from the server instead.

## 7. REST API

Everything the website uses is available to you:

```
GET  /api/health
GET  /api/bootstrap               competitions + teams + players (one shot)
GET  /api/home                    live + recent + upcoming
GET  /api/live                    matches in play
GET  /api/competitions
GET  /api/competition/:id         table, fixtures, scorers, assists, teams
GET  /api/match/:id               events, line-ups, stats, H2H
GET  /api/team/:id                squad, fixtures, results, standings
GET  /api/player/:id              stats + goal log
GET  /api/scorers?competition=&limit=
GET  /api/search
GET  /api/matches?competition=&team=
```

Admin routes live under `/api/admin/*` and need `Authorization: Bearer <token>` from `POST /api/admin/login`.

---

## 8. Project layout

```
server/
  index.js          Express app, static hosting, boot
  db.js             SQLite connection + schema
  store.js          standings, aggregations, serializers
  transfer.js       import/export the whole DB as JSON
  exporter.js       writes the static snapshot
  auth.js           admin token auth
  routes/public.js  read API
  routes/admin.js   write API
scripts/
  seed.js           demo-data generator
  seed-data.js      clubs, competitions and name pools
  export-static.js  CI entry point
public/
  index.html        app shell
  admin.html        admin panel
  css/ js/          frontend (vanilla ES modules, no build step)
.github/workflows/
  deploy-pages.yml  GitHub Pages deployment
```

---

## 9. Notes

- Requires **Node 22.5+** (uses the built-in `node:sqlite`; there is nothing to compile).
- No build step — the frontend is plain ES modules, so editing a file and refreshing is all it takes.
- Works offline-ish: a service worker caches the shell and the last known data.
- Player and manager names in the demo data are fictional; the clubs and competitions are real.

MIT licensed.
