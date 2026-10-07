# BTP 1: SDSI Data Entry Portal

A website for entering and reporting IIT Kharagpur sustainability (SDSI) data. The categories, subsections and columns follow the tables published on the [SDSI pages](https://www.iitkgp.ac.in/navpage/sdsi).

- **Data entry:** major categories open into their subsections. Each table has a form to add, edit and delete entries, with checks such as no duplicate months, numbers only, and allowed options.
- **Calculated columns and summaries:** for example total solid waste, STP removal efficiency and NGT limit checks, CO2 from vehicles and LPG, Scope 1 and excess emissions, and solar capacity share.
- **PDF reports per table:** choose the last N days, months or years, a custom date range, or all entries, and download a PDF with every column, its dates, calculated values and a summary.

## Run it on your laptop

**1. Install Node.js (one time).** Download the **LTS** version from https://nodejs.org and install it with the default options. Any version from 22.13 up works. To check, open PowerShell (or Terminal) and run:

```powershell
node --version
```

**2. Get the code.** Either way works:

- **Without Git:** on this page, click the green **Code** button → **Download ZIP**, then extract it.
- **With Git installed:**

  ```powershell
  git clone https://github.com/ayanasari/BTP-1.git
  ```

**3. Start the site.** Go into the folder and run the server. Use `cd BTP-1-main` instead if you downloaded the ZIP.

```powershell
cd BTP-1
node server.js
```

In Windows PowerShell, run the two lines one at a time. `&&` doesn't work there.

**4. Open http://localhost:4000** in Chrome or Edge. Keep the PowerShell window open while using the site; closing it or pressing Ctrl+C stops it.

There's nothing to install besides Node: no `npm install` and no internet needed while running.

### About the data

- On the first start the site creates `data/sdsi.db` and loads the figures already published on the SDSI pages.
- **Each laptop has its own separate database.** Entries made on one laptop don't appear on another, and the database isn't uploaded to GitHub. Keep a copy of `data/sdsi.db` if you enter data you care about.
- To start again from the published figures, stop the server and delete the `data` folder.
- For several people to enter data into the same database, the site has to run on one shared machine, such as a campus server, with everyone opening it by that machine's address.

## Files

- `public/schema.js`: every category, subsection, table, column and calculation. Add or change sections here.
- `server.js`: serves the pages and stores entries in SQLite (the built-in `node:sqlite`), checking each one against `schema.js`.
- `seed.js`: the published figures loaded on first start.
- `public/app.js`, `public/styles.css`, `public/index.html`: the page.
- `public/report.js`: builds the PDF reports.
- `public/vendor/`: jsPDF and jsPDF-AutoTable (MIT licence, licence files included).
- `docs/`: the column specification taken from the SDSI site tables.
