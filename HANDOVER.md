# Handover

Read this first, then `README.md` for how the portal works and `DEPLOY.md` for how it runs.

## What this is

A data-entry portal for IIT Kharagpur's sustainability figures (SDSI), built as a B.Tech
project by Ayan Ansari, Md Iqbal and Ahsan Equbal, supervised by Prof. Chirodeep Bakli
(Energy Science). It replaces nothing yet — the institute currently publishes these
figures as static pages at `iitkgp.ac.in/navpage/sdsi`.

Two halves:

- **Data entry.** 31 accounts. Each hall mess enters one figure a day for its own hall;
  the sanitation, horticulture, biogas and sewage sections enter theirs. Nobody sees
  anyone else's.
- **A public page.** The same eight topics the institute publishes, with the portal's
  figures where it has them and the institute's published ones where it does not.

## Live

| | |
| --- | --- |
| Site | https://sdsi.alwaysdata.net |
| Host | AlwaysData, free plan, account `sdsi` |
| Panel | admin.alwaysdata.com |
| Terminal | https://ssh-sdsi.alwaysdata.net (the browser one — campus WiFi blocks port 22) |
| Code | `/home/sdsi/BTP-1`, a clone of github.com/ayanasari/BTP-1 |
| Data | `/home/sdsi/sdsi-data` — database, photographs, backups. **Outside the code.** |
| Repo | https://github.com/ayanasari/BTP-1 |

### Deploying a change

```
cd ~/BTP-1 && git pull
```

then **restart the site** in the panel: Web → Sites → the restart icon.

**The restart is not optional and it is the single thing that has wasted the most time on
this project.** `git pull` changes the files; the running Node process keeps the old code
in memory until it is restarted. Three separate "the fix didn't work" rounds were this.

Then hard-refresh (Ctrl+Shift+R) — `/api/public` is cached for 30 seconds.

### Environment variables on the site

```
DATA_DIR=/home/sdsi/sdsi-data
HTTPS=1
TZ=Asia/Kolkata
```

Node 24. Don't set `PORT` — AlwaysData assigns it. `TZ` matters: the server rejects
future-dated entries, and without it a server in France refuses anything entered between
midnight and 05:30 IST.

## Shape of the code

Zero npm dependencies, deliberately. Node's standard library only, including `node:sqlite`,
which is why it needs **Node ≥ 22.13**.

| File | What it is |
| --- | --- |
| `server.js` | The whole server. Routing, auth gate, the API, migrations at startup. |
| `users.js` | Accounts, scrypt passwords, sessions. `DIVISIONS` is the source of truth for who exists. |
| `paths.js` | Where data lives. `DATA_DIR` is the only thing worth changing. |
| `public/schema.js` | **The heart of it.** Every table, field, calculation, summary and the public rollup. Runs in the browser *and* on the server. |
| `public/topics.js` | The eight public topics and their starting text. |
| `public/app.js` | The data-entry site. Hash-routed, no framework. |
| `public/public.js` | The public page. |
| `public/illustrations.js` | Placeholder drawings, shown until photographs are uploaded. |
| `backup.js` | Nightly database copy. Runs as a scheduled task in the panel. |

To add a field or a table, edit `public/schema.js` — the form, the table, the summary and
the PDF all follow from it. To add an account, edit `users.js` and restart.

## Accounts

31. One administrator, 26 hall messes, and sanitation, horticulture, biogas, sewage.

Passwords are scrypt hashes; nobody can read one back. The server writes first-time
passwords to `sdsi-data/initial-passwords.txt` **only for accounts it creates on that
start**, and rewrites the file each time. Every password works once — the site forces the
person to choose their own at first sign-in.

Lost one: `cd ~/BTP-1 && DATA_DIR=~/sdsi-data node reset-password.js <username>`.

## Three levels of access

- **Nobody signed in** → the public page. Served from `/`.
- **A division** → its own section only. Its hall is fixed by the account, not chosen on
  the form, and the server overwrites the field rather than trusting the request.
- **Administrator** → everything, plus who entered what, the reports, and the wording and
  photographs on the public page.

`/api/public` is the only route that answers without a session. The rollup happens **on
the server** so that no daily figure, hall or account name is ever sent to a visitor. If
you change it, keep that true.

## Open, in rough priority

1. **No photographs yet.** The upload works (Administration → Public page wording). The
   institute's own photos are at `iitkgp.ac.in/assets/sdsi/solid-waste-management1..3.png`
   and `rainwater1.png`, `rainwater3.png`. Using them is Prof. Bakli's call.
2. **All 31 email addresses are placeholders** (`llr.mess@iitkgp.ac.in` and so on). One
   line each in `users.js`.
3. **Nobody has actually used it.** One 5 kg test entry. The most useful next step is
   giving one mess manager their login and seeing whether a figure appears unaided.
4. **Campus VM.** Free, and institute data belongs on institute infrastructure. A request
   to CIC through Prof. Bakli. `DEPLOY.md` covers a plain Linux server.
5. **Supabase + Render**, suggested by Prof. Bakli. Real but not small: `node:sqlite` is
   synchronous and every Postgres client is async, so all ~51 call sites and everything
   calling them become async. Render's free tier also sleeps after 15 minutes, which hurts
   people entering one number a day. A persistent-disk host avoids the whole question.
6. **Campus-wide wet waste.** Only the 26 hall messes are counted. The blue bins elsewhere
   on campus are not, so "wet waste" understates the real figure. Ayan deferred this.
7. **`composted_kg`** is collected from horticulture but feeds no published column.
8. **Demo data.** `node demo-data.js 150` fills a realistic few months; `--clear` removes
   it. While present the public page says the figures are demonstration data — leave that
   alone, the page is reachable by anyone.

## The institute's published figures contradict themselves

Four places, all verified against their pages in November 2026. The portal reproduces
their figures as published and flags them rather than silently correcting them. **Somebody
at SDSI needs to rule on these**, and they are a good argument for the portal existing.

1. **"Total Solid Waste" excludes horticulture.** 2024-25: total 298, but horticulture 620,
   dry 225, wet 73. Dry + wet = 298 exactly, in all three years. Our monthly summary adds
   horticulture in, so the two disagree.
2. **Wet waste, per day against per year.** 2,000 kg/day for 2023-24 is about 730 tons a
   year; their annual table gives 32 tons for the same year. A factor of 23.
3. **Solar capacity.** The table sums to 5,304 kWp against a stated 5,558. The 254 gap is
   exactly the cycle-parking row, so it looks double-counted.
4. **Green cover** has fallen 54% → 40% since 2021-22 while carbon uptake fell with it.
   Not a contradiction, but it is the finding on that page and it is not stated plainly.

## Things that have already bitten, so you don't repeat them

- **Restart after every pull.** See above.
- `/api/public` was cached for five minutes, which made correct deploys look broken. Now 30
  seconds. Don't raise it without thinking about who reloads immediately after a change.
- A CSS grid column will not shrink below its widest child. A wide table pushed the whole
  page sideways on a phone until `min-width: 0` was set on the grid children.
- `drawPages()` re-attached its listeners on every render and renders after every upload,
  so the second upload fired twice. Guarded now — watch for the same pattern elsewhere.
- Photo serving was wired inside the `/api/` router, so every photograph came back as HTML
  and a path-traversal request returned 200. It is a separate route now.
- Two copies of the repo exist on Ayan's laptop: `Documents\BTP-1` (runs the site) and
  `Documents\BTP-1-repo` (pushes to GitHub). Each has its own database. Starting the server
  in the wrong one cost an hour.

## Testing

There is no test suite in the repo. What has been used throughout is a script driving the
real site in a real browser with `playwright-core` — sign in as each kind of account, click
through, assert on what the page actually shows, and check that a division cannot reach
what it should not. Install it temporarily, run it, then remove it and the dependency from
`package.json`; the zero-dependency property is worth keeping.

Always test with a division account, not just the administrator. Scoping bugs only show up
there.
