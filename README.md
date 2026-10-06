# BTP 1: SDSI Data Entry Portal

A website for entering and reporting IIT Kharagpur sustainability (SDSI) data. The categories, subsections and columns follow the tables published on the [SDSI pages](https://www.iitkgp.ac.in/navpage/sdsi).

- **Data entry:** major categories open into their subsections. Each table has a form to add, edit and delete entries, with checks such as no duplicate months, numbers only, and allowed options.
- **Calculated columns and summaries:** for example total solid waste, STP removal efficiency and NGT limit checks, CO2 from vehicles and LPG, Scope 1 and excess emissions, and solar capacity share.
- **PDF reports per table:** choose the last N days, months or years, a custom date range, or all entries, and download a PDF with every column, its dates, calculated values and a summary.

## Run it

Needs Node.js 22.13 or newer. There's nothing to install.

```powershell
node server.js
```

Then open http://localhost:4000

On first start it creates `data/sdsi.db` and loads the figures already published on the SDSI pages. To start again from those figures, stop the server and delete the `data` folder.

## Files

- `public/schema.js`: every category, subsection, table, column and calculation. Add or change sections here.
- `server.js`: serves the pages and stores entries in SQLite (the built-in `node:sqlite`), checking each one against `schema.js`.
- `seed.js`: the published figures loaded on first start.
- `public/app.js`, `public/styles.css`, `public/index.html`: the page.
- `public/report.js`: builds the PDF reports.
- `public/vendor/`: jsPDF and jsPDF-AutoTable (MIT licence, licence files included).
- `docs/`: the column specification taken from the SDSI site tables.
