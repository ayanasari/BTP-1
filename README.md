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

People sign in with **either their email or the short username** — whichever they find easier
to type.

| Signs in with | Or | Enters | How often |
| --- | --- | --- | --- |
| sdsi.admin@iitkgp.ac.in | `admin` | everything, plus the monthly summary and the account list | as needed |
| azad.mess@iitkgp.ac.in | `mess_azad` | food waste, Azad Hall | daily |
| patel.mess@iitkgp.ac.in | `mess_patel` | food waste, Patel Hall | daily |
| nehru.mess@iitkgp.ac.in | `mess_nehru` | food waste, Nehru Hall | daily |
| rk.mess@iitkgp.ac.in | `mess_rk` | food waste, RK Hall | daily |
| sanitation@iitkgp.ac.in | `sanitation` | dry waste total, recyclables sold, e-waste handed over | daily / per lot / per event |
| horticulture@iitkgp.ac.in | `horticulture` | dry leaves and garden waste, composted on site | daily |
| biogas@iitkgp.ac.in | `biogas` | organic waste received and compost or gas produced | daily |
| stp@iitkgp.ac.in | `stp` | daily plant log and laboratory readings, for all 7 plants | daily / per report |

**The addresses above are placeholders.** Change them to the real ones in the `DIVISIONS` list at
the top of `users.js` and restart; the new address is picked up without disturbing anything else.

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

**3. Start the server.** On Windows, double-click **`start.bat`** in the project folder. It
checks that Node is installed and new enough, then starts the site and tells you what to do if
anything is missing.

Or from a terminal:

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
delete it.

Those passwords work exactly once: the first time someone signs in, the site makes them choose a
password of their own before anything else opens, and the handed-out one stops working. The admin
can reset any account from the **Accounts** page, which hands out a new temporary password the
same way.

### If someone forgets their password

The admin resets anyone's from the **Accounts** page. If the **admin** password itself is lost,
there is no way in through the website — so recovery runs from the machine holding the database:

```
node reset-password.js                      list the accounts
node reset-password.js admin                give it a new random password
node reset-password.js admin my-new-pass    or choose one yourself
```

It prints the new password once, signs that account out everywhere, and makes them choose their
own at the next sign-in. Anyone who can run commands on that machine can do this, which is the
point — keep the machine itself locked.

### What the sign-in does and doesn't allow

- Nothing is served before sign-in — not a page, not the menu, not `schema.js`. Every address
  lands on the sign-in page until there is a session.
- Passwords are stored as salted scrypt hashes, never as text.
- Five wrong passwords in a row lock that username for five minutes.
- A session dies after **12 hours without use** and when the browser closes, so a machine left
  signed in overnight is signed out by morning.
- Pages are sent with `no-store`, so nothing stays in the browser's cache or back button after
  sign-out.

### Showing it to someone

An empty site demonstrates badly: monthly totals and reports need history behind them. Fill it
with about a month of plausible figures:

```
node demo-data.js
```

It stops at yesterday, so today is empty and every account has something to enter live.
Afterwards:

```
node demo-data.js --clear
```

removes only what the script added — anything a real account typed stays. `node demo-data.js 60`
fills sixty days instead of thirty.

Before the demonstration, sign in once as each account you plan to show and set a password you
can type in front of people: the random ones are deliberately awkward, and the site makes you
change them on first sign-in anyway.

### Running it for everyone

Logins only do their job when the site runs on **one shared machine** — a campus server, or any
computer that stays on — with everyone opening it at that machine's address. Each copy of the
site keeps its own database, so a copy per laptop means a separate set of data per laptop.

By default the site answers on every network connection, and the address to share is printed when
it starts. To keep it to the one computer while you are testing:

```
HOST=127.0.0.1 node server.js
```

In Windows PowerShell that is `$env:HOST="127.0.0.1"; node server.js`. Behind an HTTPS proxy, set
`HTTPS=1` so the session cookie is marked `Secure`.

### About the data

- On the first start the site creates `data/sdsi.db` and loads the published list of treatment plants.
- The database isn't uploaded to GitHub. Keep a copy of `data/sdsi.db` if you enter data you care about.
- To start again from scratch, stop the server and delete the `data` folder. New passwords are then generated.
- **Nothing waits for approval.** Eight divisions entering daily is a few hundred rows a month,
  and an administrator asked to approve every one would simply rubber-stamp them. Instead
  **Administration → Recent entries** shows everything that has come in, newest first, with who
  entered it and when. Anything wrong can be opened in its section and corrected, or deleted.
- Upgrading from the earlier version of the portal: rows belonging to the retired categories
  (energy, emissions, education, equality and so on) are moved into an `archived_entries` table
  rather than deleted.

## Files

- `public/schema.js`: every category, section, table, column, calculation and monthly rollup. Add or change sections here.
- `users.js`: the nine divisions and their email addresses, password hashing, sessions and permissions.
- `demo-data.js`: fills the site with a month of example figures for a demonstration, and clears them again.
- `reset-password.js`: sets a new password for one account from this computer, for when one is lost.
- `start.bat`: double-click starter for Windows.
- `share.bat`: starts the site and opens a public web address through Cloudflare, for showing people.
- `server.js`: serves the pages and stores entries in SQLite (the built-in `node:sqlite`), checking
  every request against `schema.js` and against what the signed-in account is allowed to touch.
- `seed.js`: the published list of treatment plants, loaded on first start.
- `public/login.html`: the sign-in page.
- `public/app.js`, `public/styles.css`, `public/index.html`: the page.
- `public/report.js`: builds the PDF reports, both per table and for the monthly summary.
- `public/vendor/`: jsPDF and jsPDF-AutoTable (MIT licence, licence files included).
- `docs/`: the column specification taken from the SDSI site tables.

## Adding a hall or a plant

Add the name to `HALLS` or `PLANTS` in `public/schema.js`, then add the account to `DIVISIONS`
in `users.js` with its `scope` set to that name. Restart the server; the new account is created
with a password written to `data/initial-passwords.txt`.
