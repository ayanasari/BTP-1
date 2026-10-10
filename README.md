# BTP 1: SDSI Data Entry Portal

A website for entering and reporting IIT Kharagpur sustainability (SDSI) data. It covers
**solid waste** and **sewage treatment**, following the tables published on the
[SDSI pages](https://www.iitkgp.ac.in/navpage/sdsi).

- **One account per division.** Each person signs in and sees only the forms they are
  responsible for. A mess manager's hall is fixed by their account, so they never pick it.
- **Daily entry, monthly reporting.** Workers enter today's weight. The monthly figures the
  SDSI pages publish are added up from those daily rows — nobody types a monthly total.
- **PDF reports per table:** the last N days, months or years, a custom date range, or all
  entries, with every column, its dates, calculated values and a summary.

## The nine accounts

| Username | Enters | How often |
| --- | --- | --- |
| `admin` | everything, plus the monthly summary and the account list | as needed |
| `mess_azad` | food waste, Azad Hall | daily |
| `mess_patel` | food waste, Patel Hall | daily |
| `mess_nehru` | food waste, Nehru Hall | daily |
| `mess_rk` | food waste, RK Hall | daily |
| `sanitation` | dry waste total, recyclables sold, e-waste handed over | daily / per lot / per event |
| `horticulture` | dry leaves and garden waste, composted on site | daily |
| `processing` | organic waste received and compost or gas produced | daily |
| `stp` | daily plant log and laboratory readings, for all 7 plants | daily / per report |

A mess manager's whole screen is: today's date, one number, Save.

## Run it

**1. Install Node.js (one time).** Download the **LTS** version from <https://nodejs.org> and
install it with the default options. Any version from 22.13 up works. To check, open
PowerShell (or Terminal) and run:

```
node --version
```

**2. Get the code.** Either way works:

- **Without Git:** on this page, click the green **Code** button → **Download ZIP**, then extract it.
- **With Git installed:**

```
git clone https://github.com/ayanasari/BTP-1.git
```

**3. Start the server.** Go into the folder and run it. Use `cd BTP-1-main` instead if you
downloaded the ZIP.

```
cd BTP-1
node server.js
```

In Windows PowerShell, run the two lines one at a time. `&&` doesn't work there.

**4. Open <http://localhost:4000>** and sign in. Keep the PowerShell window open while using
the site; closing it or pressing Ctrl+C stops it.

There's nothing to install besides Node: no `npm install` and no internet needed while running.

### First-time passwords

On the first start the site creates the nine accounts with random passwords and writes them to
**`data/initial-passwords.txt`**. Open that file, hand each person only their own line, and then
delete it. Everyone can change their own password from the **Account** page, and the admin can
reset anyone's from the same page.

### Running it for everyone

Logins only do their job when the site runs on **one shared machine** — a campus server, or any
computer that stays on — with everyone opening it at that machine's address. Each copy of the
site keeps its own database, so a copy per laptop means a separate set of data per laptop.

### About the data

- On the first start the site creates `data/sdsi.db` and loads the published list of treatment plants.
- The database isn't uploaded to GitHub. Keep a copy of `data/sdsi.db` if you enter data you care about.
- To start again from scratch, stop the server and delete the `data` folder. New passwords are then generated.
- Entries made by a staff account start as unchecked. The admin sees who entered each row and can mark it checked.
- Upgrading from the earlier version of the portal: rows belonging to the retired categories
  (energy, emissions, education, equality and so on) are moved into an `archived_entries` table
  rather than deleted.

## Files

- `public/schema.js`: every category, section, table, column, calculation and monthly rollup. Add or change sections here.
- `users.js`: the nine divisions, password hashing, sessions and permissions.
- `server.js`: serves the pages and stores entries in SQLite (the built-in `node:sqlite`), checking
  every request against `schema.js` and against what the signed-in account is allowed to touch.
- `seed.js`: the published list of treatment plants, loaded on first start.
- `public/login.html`: the sign-in page.
- `public/app.js`, `public/styles.css`, `public/index.html`: the page.
- `public/report.js`: builds the PDF reports.
- `public/vendor/`: jsPDF and jsPDF-AutoTable (MIT licence, licence files included).
- `docs/`: the column specification taken from the SDSI site tables.

## Adding a hall or a plant

Add the name to `HALLS` or `PLANTS` in `public/schema.js`, then add the account to `DIVISIONS`
in `users.js` with its `scope` set to that name. Restart the server; the new account is created
with a password written to `data/initial-passwords.txt`.
