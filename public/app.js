(function () {
  const { tables, categories, overviews, helpers } = window.SDSI;
  const { fmt, fyOfMonth, formatPeriod, formatDate, inRange, isDated } = helpers;

  const $sidebar = document.getElementById('sidebar');
  const $main = document.getElementById('main');
  const $toast = document.getElementById('toast');
  const $menuBtn = document.getElementById('menuBtn');

  const PERIOD_LABEL = { month: 'Month', fy: 'Financial year', year: 'Year', date: 'Date' };
  const openCats = new Set(loadOpenCats());
  let current = null; // { section, rows: {tableId: [...]}, editing: {tableId, id|null} }
  let me = null;      // the signed-in account
  let nav = [];       // categories and sections this account may open

  // ---------- utilities ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const may = id => !!me && me.tables.includes(id);
  // The tables of a section that this account may actually open.
  const tablesOf = section => section.tables.filter(may);
  const findSection = id => {
    for (const cat of nav) for (const s of cat.sections) if (s.id === id) return { cat, section: s };
    return null;
  };

  // Categories and sections reduced to what the account is responsible for. A summary page
  // needs every table it adds up, so it only appears for an account that has all of them.
  function buildNav() {
    return categories.map(cat => {
      const sections = cat.sections
        .filter(s => {
          if (s.adminOnly) return !!(me && me.isAdmin);
          return s.overview ? s.tables.every(may) : s.tables.some(may);
        })
        .map(s => ({ ...s, tables: s.overview || s.recent ? s.tables : tablesOf(s) }));
      return { ...cat, sections };
    }).filter(cat => cat.sections.length);
  }

  // The scope field (hall, plant, facility) is fixed by the account, so it is shown but never asked.
  const lockedField = t => (me && me.scope && t.scopeField) ? t.scopeField : null;
  function loadOpenCats() {
    try { return JSON.parse(localStorage.getItem('sdsi.openCats')) || []; } catch { return []; }
  }
  function saveOpenCats() {
    try { localStorage.setItem('sdsi.openCats', JSON.stringify([...openCats])); } catch { /* storage unavailable */ }
  }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 2200);
  }
  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }
  function currentFy() {
    const d = new Date();
    return fyOfMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  function defaultPeriod(type) {
    const d = new Date();
    if (type === 'month') { d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    if (type === 'fy') { const [y] = currentFy().split('-').map(Number); return fyOfMonth(`${y - 1}-04`); }
    if (type === 'year') return String(d.getFullYear());
    if (type === 'date') return toISO(new Date()); // daily entry starts on today
    return '';
  }
  function fyOptions() {
    const [start] = currentFy().split('-').map(Number);
    const out = [];
    for (let y = start + 1; y >= 2010; y--) out.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`);
    return out;
  }

  // ---------- sidebar ----------
  function renderSidebar() {
    const activeId = current?.section.id;
    $sidebar.innerHTML = `
      <a class="nav-home ${activeId ? '' : 'active'}" href="#/">Home</a>
      ${nav.map(cat => `
        <div class="cat ${openCats.has(cat.id) ? 'open' : ''}" data-cat="${cat.id}">
          <button class="cat-btn" aria-expanded="${openCats.has(cat.id)}">
            <span>${esc(cat.title)}</span><span class="chev" aria-hidden="true">›</span>
          </button>
          <ul class="cat-list">
            ${cat.sections.map(s => `<li><a href="#/s/${s.id}" class="${s.id === activeId ? 'active' : ''}">${esc(s.title)}</a></li>`).join('')}
          </ul>
        </div>`).join('')}`;
  }

  $sidebar.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (btn) {
      const id = btn.parentElement.dataset.cat;
      openCats.has(id) ? openCats.delete(id) : openCats.add(id);
      saveOpenCats();
      renderSidebar();
      return;
    }
    if (e.target.closest('a')) closeMenu();
  });
  $menuBtn.addEventListener('click', () => {
    const open = $sidebar.classList.toggle('open');
    $menuBtn.setAttribute('aria-expanded', open);
  });
  function closeMenu() { $sidebar.classList.remove('open'); $menuBtn.setAttribute('aria-expanded', 'false'); }

  // ---------- home ----------
  function renderHome() {
    current = null;
    document.title = 'SDSI Data Entry · IIT Kharagpur';
    // One section and one table is the ordinary case for a worker: take them straight there.
    const only = nav.length === 1 && nav[0].sections.length === 1 ? nav[0].sections[0] : null;
    if (only) { location.replace(`#/s/${only.id}`); return; }
    $main.innerHTML = `
      <h1>Sustainability data entry</h1>
      <p class="intro">${me && me.isAdmin
        ? 'Every section of the portal, plus the monthly summary built from the daily entries.'
        : 'These are the sections you are responsible for. Open one to add today’s entry.'}</p>
      <div class="cat-cards">
        ${nav.map(cat => `
          <section class="cat-card">
            <h2>${esc(cat.title)}</h2>
            <ul>${cat.sections.map(s => {
              const note = s.recent ? 'everyone' : s.overview ? 'summary'
                : `${s.tables.length} table${s.tables.length > 1 ? 's' : ''}`;
              return `<li><a href="#/s/${s.id}">${esc(s.title)} <span>${note} ›</span></a></li>`;
            }).join('')}</ul>
          </section>`).join('')}
      </div>`;
    renderSidebar();
  }

  // ---------- section ----------
  async function renderSectionPage(id) {
    const found = findSection(id);
    if (!found) return renderHome();
    const { cat, section } = found;
    openCats.add(cat.id);
    saveOpenCats();
    current = { cat, section, rows: {}, editing: null };
    renderSidebar();
    document.title = `${section.title} · SDSI Data Entry`;
    $main.innerHTML = `<div class="crumbs"><a href="#/">Home</a> › ${esc(cat.title)}</div><h1>${esc(section.title)}</h1><p class="empty">Loading…</p>`;
    if (section.recent) return drawRecent();
    try {
      current.rows = await api('GET', `/api/entries?tables=${section.tables.join(',')}`);
    } catch (err) {
      $main.querySelector('.empty').textContent = `Could not load data: ${err.message}`;
      return;
    }
    // A section that is one day's worth of typing opens with the form already up, so
    // there is nothing to click before entering. Not if today is already filled in,
    // which would only greet someone with a duplicate-entry error.
    const only = section.tables.length === 1 ? section.tables[0] : null;
    if (only && tables[only].period === 'date' && !section.overview) {
      const today = toISO(new Date());
      const doneToday = (current.rows[only] || []).some(r => r.period === today);
      if (!doneToday) current.editing = { tableId: only, id: null };
    }
    drawSection();
  }

  function ctxFor() {
    const ctx = { rows: current.rows };
    const cache = new Map();
    ctx.calc = r => {
      if (!cache.has(r)) { const t = tables[r.table]; cache.set(r, t.calc ? t.calc(r, ctx) : {}); }
      return cache.get(r);
    };
    return ctx;
  }

  function drawSection() {
    const { cat, section } = current;
    const ctx = ctxFor();
    if (section.overview) return drawOverview(cat, section, ctx);
    const hasCalc = section.tables.some(id => tables[id].calcCols);
    const scope = me && me.scope;
    $main.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(cat.title)}</div>
      <h1>${esc(section.title)}</h1>
      ${scope && section.tables.some(id => tables[id].scopeField) ? `<p class="scope-note">Entries for <b>${esc(scope)}</b>.</p>` : ''}
      ${hasCalc ? `<div class="legend"><span><i style="background:var(--calc-bg);border:1px solid var(--border)"></i>Calculated automatically</span><span><i style="background:var(--danger-soft)"></i>Needs attention</span></div>` : ''}
      ${section.tables.map(id => tableCard(id, ctx)).join('')}`;
    bindSection();
    bindReportPanel();
  }

  // A read-only page: the published monthly figures, added up from the daily entries.
  function miniTable(t) {
    return `<div class="table-wrap"><table class="mini">
      <thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function drawOverview(cat, section, ctx) {
    const o = overviews[section.overview](ctx);
    $main.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(cat.title)}</div>
      <h1>${esc(section.title)}</h1>
      <section class="card">
        <div class="card-head">
          <h2>${esc(o.title)}</h2>
          <div class="head-actions">
            <button class="btn btn-primary" id="overviewPdf">Get report (PDF)</button>
          </div>
        </div>
        <p class="card-note">${esc(o.intro)}</p>
        ${o.rows.length ? miniTable(o) : '<p class="empty">No entries yet, so there is nothing to add up.</p>'}
      </section>
      ${o.extra && o.extra.rows.length ? `
        <section class="card">
          <div class="card-head"><h2>${esc(o.extra.title)}</h2></div>
          ${miniTable(o.extra)}
        </section>` : ''}`;

    // The summary has no date range to pick: it is every entry, added up.
    document.getElementById('overviewPdf').addEventListener('click', () => {
      try {
        const name = window.SDSIReport.buildOverview({ cat, section, overview: o });
        toast(`Downloaded ${name}`);
      } catch (err) {
        console.error(err);
        toast('Could not create the PDF');
      }
    });
  }

  // ---------- report panel ----------
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const QUICK = [[7, 'days', 'Last 7 days'], [1, 'months', 'Last month'], [3, 'months', 'Last 3 months'], [6, 'months', 'Last 6 months'], [1, 'years', 'Last year']];

  function reportState() {
    if (!current.report) {
      const today = toISO(new Date());
      current.report = { mode: 'last', n: 1, unit: 'months', from: '', to: today };
    }
    return current.report;
  }

  function computeRange(s) {
    const today = new Date();
    if (s.mode === 'all') return { from: null, to: null, label: 'All entries' };
    if (s.mode === 'custom') {
      if (!s.from || !s.to) return { error: 'Choose both a start and an end date.' };
      if (s.from > s.to) return { error: 'The start date is after the end date.' };
      return { from: s.from, to: s.to, label: `${formatDate(s.from)} to ${formatDate(s.to)}` };
    }
    const n = Math.floor(Number(s.n));
    if (!(n >= 1 && n <= 999)) return { error: 'Enter how many days, months or years (1 or more).' };
    const start = new Date(today);
    if (s.unit === 'days') start.setDate(start.getDate() - n);
    if (s.unit === 'months') start.setMonth(start.getMonth() - n);
    if (s.unit === 'years') start.setFullYear(start.getFullYear() - n);
    const from = toISO(start), to = toISO(today);
    const unit = n === 1 ? s.unit.slice(0, -1) : s.unit;
    return { from, to, label: `Last ${n} ${unit} (${formatDate(from)} to ${formatDate(to)})` };
  }

  function reportPanelHtml() {
    const s = reportState();
    return `
      <div class="report-panel">
        <h3>Report for “${esc(tables[current.reportFor].title)}”</h3>
        <form class="report-form" novalidate>
          <div class="quick" role="group" aria-label="Quick ranges">
            ${QUICK.map(([n, unit, label]) => `<button type="button" class="chip ${s.mode === 'last' && +s.n === n && s.unit === unit ? 'on' : ''}" data-quick="${n},${unit}">${label}</button>`).join('')}
          </div>
          <div class="range-options">
            <label class="range-opt">
              <input type="radio" name="mode" value="last" ${s.mode === 'last' ? 'checked' : ''}>
              <span>Last</span>
              <input type="number" name="n" min="1" max="999" step="1" value="${esc(s.n)}" aria-label="How many">
              <select name="unit" aria-label="Unit">
                ${['days', 'months', 'years'].map(u => `<option value="${u}" ${s.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            </label>
            <label class="range-opt">
              <input type="radio" name="mode" value="custom" ${s.mode === 'custom' ? 'checked' : ''}>
              <span>From</span>
              <input type="date" name="from" value="${esc(s.from)}" aria-label="From date">
              <span>to</span>
              <input type="date" name="to" value="${esc(s.to)}" aria-label="To date">
            </label>
            <label class="range-opt">
              <input type="radio" name="mode" value="all" ${s.mode === 'all' ? 'checked' : ''}>
              <span>All entries</span>
            </label>
          </div>
          <div class="range-preview" aria-live="polite"></div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Download PDF</button>
            <button type="button" class="btn" data-act="toggle-report">Close</button>
          </div>
        </form>
      </div>`;
  }

  function updateReportPreview(form) {
    const s = reportState();
    const r = computeRange(s);
    const $p = form.querySelector('.range-preview');
    const $btn = form.querySelector('[type=submit]');
    if (r.error) { $p.innerHTML = `<span class="form-error">${esc(r.error)}</span>`; $btn.disabled = true; return; }
    $btn.disabled = false;
    const t = tables[current.reportFor], all = current.rows[current.reportFor] || [];
    let detail;
    if (!isDated(t)) {
      detail = `This is a standing list with no dates, so all <b>${all.length}</b> entries are included, each with its last-updated date.`;
    } else {
      const picked = all.filter(row => inRange(t, row, r.from, r.to));
      const periods = t.period ? [...new Set(picked.map(row => formatPeriod(t.period, row.period)))] : [];
      detail = `<b>${picked.length}</b> of ${all.length} entr${all.length === 1 ? 'y' : 'ies'} included`
        + (periods.length ? `: ${esc(periods.join(', '))}` : '');
    }
    $p.innerHTML = `<div class="range-label">${esc(r.label)}</div><div>${detail}</div>`;
  }

  function bindReportPanel() {
    const form = $main.querySelector('.report-form');
    if (!form) return;
    const sync = () => {
      const s = reportState();
      s.mode = form.elements.mode.value;
      s.n = form.elements.n.value;
      s.unit = form.elements.unit.value;
      s.from = form.elements.from.value;
      s.to = form.elements.to.value;
      form.querySelectorAll('.chip').forEach(c => {
        const [n, unit] = c.dataset.quick.split(',');
        c.classList.toggle('on', s.mode === 'last' && +s.n === +n && s.unit === unit);
      });
      updateReportPreview(form);
    };
    // Typing in a range's inputs selects that range.
    form.addEventListener('focusin', e => {
      const opt = e.target.closest('.range-opt');
      if (opt && e.target.name !== 'mode') { opt.querySelector('[name=mode]').checked = true; sync(); }
    });
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    form.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
      const [n, unit] = chip.dataset.quick.split(',');
      form.elements.mode.value = 'last';
      form.elements.n.value = n;
      form.elements.unit.value = unit;
      sync();
    }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const r = computeRange(reportState());
      if (r.error) return;
      try {
        const name = window.SDSIReport.build({
          cat: current.cat, section: current.section, tableId: current.reportFor,
          rows: current.rows, from: r.from, to: r.to, rangeLabel: r.label,
        });
        toast(`Downloaded ${name}`);
      } catch (err) {
        console.error(err);
        toast('Could not create the PDF');
      }
    });
    sync();
  }

  function tableCard(tableId, ctx) {
    const t = tables[tableId];
    const rows = current.rows[tableId] || [];
    const editing = current.editing && current.editing.tableId === tableId ? current.editing : null;
    const reporting = current.reportFor === tableId;
    return `
      <section class="card" data-table="${tableId}">
        <div class="card-head">
          <h2>${esc(t.title)}<span class="count">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}</span></h2>
          <div class="head-actions">
            ${reporting ? '' : `<button class="btn" data-act="toggle-report">Get report (PDF)</button>`}
            ${editing ? '' : `<button class="btn btn-primary" data-act="add">+ Add entry</button>`}
          </div>
        </div>
        ${reporting ? reportPanelHtml() : ''}
        ${t.note ? `<p class="card-note">${esc(t.note)}</p>` : ''}
        ${editing ? formHtml(tableId, editing.id ? rows.find(r => r.id === editing.id) : null) : ''}
        ${rows.length ? rowsTable(tableId, rows, ctx) : `<p class="empty">No entries yet. Use “+ Add entry” to add the first one.</p>`}
        ${reportHtml(tableId, rows, ctx)}
      </section>`;
  }

  function periodLabel(t) { return t.periodLabel || PERIOD_LABEL[t.period]; }


  function cell(field, v) {
    if (v == null || v === '') return { cls: field.type === 'number' ? 'num' : '', html: '—' };
    if (field.type === 'number') return { cls: 'num', html: field.plain ? esc(v) : fmt(v, 3) };
    if (field.type === 'date') return { cls: 'nowrap', html: esc(formatDate(v)) };
    if (field.type === 'url') return { cls: '', html: `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, ''))}</a>` };
    const s = String(v);
    if (field.type === 'textarea' || s.length > 60) return { cls: 'long', html: esc(s) };
    return { cls: '', html: esc(s) };
  }

  function rowsTable(tableId, rows, ctx) {
    const t = tables[tableId];
    const calcCols = t.calcCols || [];
    const locked = lockedField(t);                  // same value on every row, so not worth a column
    const fields = t.fields.filter(f => f.key !== locked);
    const showWho = !!(me && me.isAdmin);
    const head = [
      t.serial ? `<th class="num">${esc(t.serial)}</th>` : '',
      t.period ? `<th>${esc(periodLabel(t))}</th>` : '',
      ...fields.map(f => `<th class="${f.type === 'number' ? 'num' : ''}">${esc(f.label)}${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}</th>`),
      ...calcCols.map(c => `<th class="calc ${c.text ? '' : 'num'}">${esc(c.label)}${c.unit ? `<span class="unit">${esc(c.unit)}</span>` : ''}</th>`),
      showWho ? '<th>Entered by</th>' : '',
      '<th><span class="sr-only"></span></th>',
    ].join('');
    const body = rows.map((r, i) => {
      const c = ctx.calc(r);
      return `<tr class="${c._flag ? 'flag' : ''}">
        ${t.serial ? `<td class="num">${i + 1}</td>` : ''}
        ${t.period ? `<td class="nowrap">${esc(formatPeriod(t.period, r.period))}</td>` : ''}
        ${fields.map(f => { const x = cell(f, r.data[f.key]); return `<td class="${x.cls}">${x.html}</td>`; }).join('')}
        ${calcCols.map(cc => cc.text ? `<td class="calc">${esc(c[cc.key] ?? '—')}</td>` : `<td class="calc num">${fmt(c[cc.key], cc.digits ?? 2)}</td>`).join('')}
        ${showWho ? `<td class="nowrap who-cell">${esc(r.created_by || '—')}</td>` : ''}
        <td class="actions">
          <button class="btn-link" data-act="edit" data-id="${r.id}">Edit</button>
          <button class="btn-link danger" data-act="delete" data-id="${r.id}">Delete</button>
        </td>
      </tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function reportHtml(tableId, rows, ctx) {
    const t = tables[tableId];
    if (!t.summary || !rows.length) return '';
    const s = t.summary(rows, ctx);
    if (!s || (!s.items?.length && !s.table?.rows?.length)) return '';
    return `
      <div class="report">
        <div class="report-title">Report</div>
        ${s.items?.length ? `<div class="stats">${s.items.map(it => `<div class="stat ${it.flag ? 'flag' : ''}"><div class="v">${esc(it.value)}</div><div class="l">${esc(it.label)}</div></div>`).join('')}</div>` : ''}
        ${s.table?.rows?.length ? `<div class="table-wrap"><table class="mini"><thead><tr>${s.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${s.table.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      </div>`;
  }

  // ---------- form ----------
  function inputHtml(f, value) {
    const v = value ?? '';
    const name = `name="${f.key}" id="f_${f.key}"`;
    const req = f.required ? 'required' : '';
    if (f.type === 'select') {
      return `<select ${name} ${req}><option value="">Select…</option>${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    if (f.type === 'textarea') return `<textarea ${name} ${req}>${esc(v)}</textarea>`;
    if (f.type === 'number') return `<input type="number" step="any" min="0" ${name} value="${esc(v)}" ${req}>`;
    if (f.type === 'date') return `<input type="date" ${name} value="${esc(v)}" ${req}>`;
    if (f.type === 'url') return `<input type="url" ${name} value="${esc(v)}" placeholder="https://" ${req}>`;
    return `<input type="text" ${name} value="${esc(v)}" ${req}>`;
  }

  function periodInputHtml(t, value) {
    const v = value ?? defaultPeriod(t.period);
    const base = `name="__period" id="f___period" required`;
    if (t.period === 'month') return `<input type="month" ${base} value="${esc(v)}">`;
    if (t.period === 'fy') return `<select ${base}>${fyOptions().map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    if (t.period === 'year') return `<input type="number" min="1950" max="2100" step="1" ${base} value="${esc(v)}">`;
    return `<input type="date" ${base} value="${esc(v)}">`;
  }

  function formHtml(tableId, row) {
    const t = tables[tableId];
    const locked = lockedField(t);
    return `
      <form class="entry-form" novalidate>
        <h3>${row ? 'Edit entry' : 'New entry'}</h3>
        <div class="form-grid">
          ${t.period ? `<div class="field"><label for="f___period">${esc(periodLabel(t))} <span class="req">*</span></label>${periodInputHtml(t, row ? row.period : null)}</div>` : ''}
          ${locked ? `<div class="field"><label>${esc(t.fields.find(f => f.key === locked).label)}</label><div class="fixed-value">${esc(me.scope)}</div></div>` : ''}
          ${t.fields.filter(f => f.key !== locked).map(f => `
            <div class="field ${f.type === 'textarea' ? 'wide' : ''}">
              <label for="f_${f.key}">${esc(f.label)}${f.unit ? ` <span class="unit">(${esc(f.unit)})</span>` : ''}${f.required ? ' <span class="req">*</span>' : ''}</label>
              ${inputHtml(f, row ? row.data[f.key] : null)}
            </div>`).join('')}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${row ? 'Save changes' : 'Save entry'}</button>
          <button type="button" class="btn" data-act="cancel">Cancel</button>
          <span class="form-error" hidden></span>
        </div>
      </form>`;
  }

  // Suggest standard values (emission factors, cylinder weights) without overwriting what the user typed.
  function applyAutofill(form, t) {
    if (!t.autofill) return;
    const data = Object.fromEntries(new FormData(form));
    const suggestions = t.autofill(data);
    for (const [key, val] of Object.entries(suggestions)) {
      const input = form.elements[key];
      if (!input || val == null) continue;
      if (input.value === '' || input.dataset.auto === '1') {
        input.value = val;
        input.dataset.auto = '1';
        input.classList.add('auto');
      }
    }
  }

  function bindSection() {
    $main.querySelectorAll('.card[data-table]').forEach(card => {
      const tableId = card.dataset.table;
      const t = tables[tableId];
      const form = card.querySelector('form.entry-form');
      if (form) {
        applyAutofill(form, t);
        form.addEventListener('input', e => {
          if (e.target.dataset.auto) { delete e.target.dataset.auto; e.target.classList.remove('auto'); }
        });
        form.addEventListener('change', () => applyAutofill(form, t));
        form.addEventListener('submit', e => { e.preventDefault(); submitForm(form, tableId); });
        // Put the cursor in the first thing still to be filled in: the date and the hall
        // are already right, so a worker types the number and presses Save.
        const inputs = [...form.querySelectorAll('input, select, textarea')];
        const first = inputs.find(el => !String(el.value).trim()) || inputs[0];
        if (first) first.focus();
      }
    });
  }

  $main.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !current) return;
    const tableId = btn.closest('.card')?.dataset.table;
    const act = btn.dataset.act;
    if (act === 'toggle-report') { current.reportFor = current.reportFor === tableId ? null : tableId; redraw(tableId); return; }
    if (act === 'add') { current.editing = { tableId, id: null }; redraw(tableId); }
    if (act === 'edit') { current.editing = { tableId, id: Number(btn.dataset.id) }; redraw(tableId); }
    if (act === 'cancel') { current.editing = null; redraw(tableId); }
    if (act === 'delete') {
      if (!window.confirm('Delete this entry? This cannot be undone.')) return;
      try {
        await api('DELETE', `/api/entries/${btn.dataset.id}`);
        current.rows[tableId] = current.rows[tableId].filter(r => r.id !== Number(btn.dataset.id));
        if (current.editing?.id === Number(btn.dataset.id)) current.editing = null;
        drawSection();
        toast('Entry deleted');
      } catch (err) { toast(err.message); }
    }
  });

  // Redraw and keep the card in view.
  function redraw(tableId) {
    drawSection();
    const card = $main.querySelector(`.card[data-table="${tableId}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function submitForm(form, tableId) {
    const t = tables[tableId];
    const $err = form.querySelector('.form-error');
    $err.hidden = true;
    const missing = [...form.elements].filter(el => el.required && !String(el.value).trim());
    if (missing.length) {
      const label = form.querySelector(`label[for="${missing[0].id}"]`);
      $err.textContent = `Please fill in “${label ? label.textContent.replace(/[*(].*$/, '').trim() : 'required fields'}”.`;
      $err.hidden = false;
      missing[0].focus();
      return;
    }
    const fd = Object.fromEntries(new FormData(form));
    const period = t.period ? fd.__period : null;
    const data = {};
    t.fields.forEach(f => { data[f.key] = fd[f.key] ?? ''; });
    const editingId = current.editing?.id;
    try {
      const saved = editingId
        ? await api('PUT', `/api/entries/${editingId}`, { period, data })
        : await api('POST', '/api/entries', { table: tableId, period, data });
      const list = current.rows[tableId] || (current.rows[tableId] = []);
      const i = list.findIndex(r => r.id === saved.id);
      if (i >= 0) list[i] = saved; else list.push(saved);
      list.sort((a, b) => (b.period || '').localeCompare(a.period || '') || a.id - b.id);
      current.editing = null;
      redraw(tableId);
      toast(editingId ? 'Changes saved' : 'Entry saved');
    } catch (err) {
      $err.textContent = err.message;
      $err.hidden = false;
    }
  }

  // ---------- account page ----------
  async function renderAccount() {
    current = null;
    document.title = 'Account · SDSI Data Entry';
    renderSidebar();
    $main.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a></div>
      <h1>Account</h1>
      <section class="card">
        <div class="card-head"><h2>${esc(me.name)}<span class="count">${esc(me.email || me.username)}</span></h2></div>
        <p class="card-note">${me.isAdmin ? 'Administrator — every section of the portal.'
          : `You enter: ${esc(me.tables.map(id => tables[id].title).join(', '))}${me.scope ? ` · ${esc(me.scope)}` : ''}`}</p>
        <form class="entry-form" id="pwForm" novalidate>
          <h3>Change your password</h3>
          <div class="form-grid">
            <div class="field"><label for="f_current">Current password <span class="req">*</span></label>
              <input type="password" id="f_current" name="current" autocomplete="current-password" required></div>
            <div class="field"><label for="f_new">New password <span class="req">*</span></label>
              <input type="password" id="f_new" name="password" autocomplete="new-password" minlength="8" required></div>
            <div class="field"><label for="f_again">Repeat new password <span class="req">*</span></label>
              <input type="password" id="f_again" name="again" autocomplete="new-password" required></div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Change password</button>
            <span class="form-error" hidden></span>
          </div>
        </form>
      </section>
      ${me.isAdmin ? '<section class="card" id="usersCard"><div class="card-head"><h2>Accounts</h2></div><p class="empty">Loading…</p></section>' : ''}`;

    const form = document.getElementById('pwForm');
    const $err = form.querySelector('.form-error');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      $err.hidden = true;
      const fd = Object.fromEntries(new FormData(form));
      if (String(fd.password).length < 8) { $err.textContent = 'Use at least 8 characters.'; $err.hidden = false; return; }
      if (fd.password !== fd.again) { $err.textContent = 'The two new passwords are different.'; $err.hidden = false; return; }
      try {
        await api('POST', '/api/password', { current: fd.current, password: fd.password });
        form.reset();
        toast('Password changed');
      } catch (err) { $err.textContent = err.message; $err.hidden = false; }
    });

    if (me.isAdmin) await renderUsers();
  }

  async function renderUsers() {
    const card = document.getElementById('usersCard');
    if (!card) return;
    let list;
    try { ({ users: list } = await api('GET', '/api/users')); }
    catch (err) { card.querySelector('.empty').textContent = err.message; return; }
    card.innerHTML = `
      <div class="card-head"><h2>Accounts<span class="count">${list.length}</span></h2></div>
      <p class="card-note">Resetting a password shows it once. Write it down and hand it over.</p>
      <div class="table-wrap"><table class="data"><thead><tr>
        <th>Signs in with</th><th>Division</th><th>Enters</th><th>Status</th><th></th>
      </tr></thead><tbody>
        ${list.map(u => `<tr data-user="${u.id}">
          <td class="nowrap"><b>${esc(u.email || u.username)}</b><br><span class="unit">or ${esc(u.username)}</span></td>
          <td>${esc(u.name)}${u.scope ? `<br><span class="unit">${esc(u.scope)}</span>` : ''}</td>
          <td class="long">${u.tables === '*' ? 'Everything' : esc(u.tables.map(id => tables[id] ? tables[id].title : id).join(', '))}</td>
          <td class="nowrap">${u.active ? '<span class="tag ok">active</span>' : '<span class="tag off">switched off</span>'}</td>
          <td class="actions nowrap">
            <button class="btn-link" data-act="reset" data-id="${u.id}">Reset password</button>
            ${u.username === 'admin' ? '' : `<button class="btn-link ${u.active ? 'danger' : ''}" data-act="active" data-id="${u.id}" data-to="${u.active ? '0' : '1'}">${u.active ? 'Switch off' : 'Switch on'}</button>`}
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;

    if (card.dataset.bound) return;
    card.dataset.bound = '1';
    card.addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      try {
        if (btn.dataset.act === 'reset') {
          if (!window.confirm('Reset this password? The person will be signed out everywhere.')) return;
          const { password } = await api('POST', '/api/users', { userId: id, action: 'reset' });
          const cell = btn.closest('td');
          cell.insertAdjacentHTML('afterbegin', `<div class="new-pw">New password: <code>${esc(password)}</code></div>`);
        } else if (btn.dataset.act === 'active') {
          await api('POST', '/api/users', { userId: id, action: 'active', active: btn.dataset.to === '1' });
          await renderUsers();
        }
      } catch (err) { toast(err.message); }
    });
  }

  // ---------- recent entries, for the admin ----------
  // Who entered what, across every section, newest first.
  function entrySummary(t, row) {
    const locked = t.scopeField;
    const parts = [];
    if (locked && row.data[locked]) parts.push(`<b>${esc(row.data[locked])}</b>`);
    t.fields.forEach(f => {
      if (f.key === locked) return;
      const v = row.data[f.key];
      if (v == null || v === '') return;
      // f.plain marks a number that is not a quantity — a year takes no thousands separator.
      const shown = (f.type === 'number' && !f.plain) ? fmt(v, 3) : String(v);
      parts.push(`${esc(f.label)} ${esc(shown)}${f.unit ? ` ${esc(f.unit)}` : ''}`);
    });
    return parts.join(' · ');
  }

  const whenShort = iso => {
    if (!iso) return '—';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return esc(iso);
    const mins = Math.round((Date.now() - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
    return formatDate(d.toISOString().slice(0, 10));
  };

  async function drawRecent() {
    const { cat, section } = current;
    let data;
    try {
      data = await api('GET', '/api/recent?limit=150');
    } catch (err) {
      $main.innerHTML = `<h1>${esc(section.title)}</h1><p class="empty">${esc(err.message)}</p>`;
      return;
    }
    const rows = data.entries.filter(r => tables[r.table]);
    $main.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(cat.title)}</div>
      <h1>${esc(section.title)}</h1>
      <p class="intro">Everything entered across all nine divisions, newest first. Nothing here
        needs approving — it is a record of what came in, and anything wrong can be removed.</p>
      <section class="card">
        <div class="card-head"><h2>All entries<span class="count">${rows.length} shown</span></h2></div>
        ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr>
          <th>Entered</th><th>By</th><th>Section</th><th>For</th><th>What</th><th></th>
        </tr></thead><tbody>
          ${rows.map(r => {
            const t = tables[r.table];
            return `<tr>
              <td class="nowrap">${esc(whenShort(r.created_at))}</td>
              <td class="nowrap"><b>${esc(r.created_by || '—')}</b></td>
              <td class="nowrap">${esc(t.title)}</td>
              <td class="nowrap">${t.period ? esc(formatPeriod(t.period, r.period)) : '—'}</td>
              <td class="long">${entrySummary(t, r)}</td>
              <td class="actions nowrap">
                <a class="btn-link" href="#/s/${esc(sectionIdFor(r.table))}">Open section</a>
                <button class="btn-link danger" data-recent-delete="${r.id}">Delete</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody></table></div>`
        : '<p class="empty">No entries yet.</p>'}
      </section>`;

    $main.querySelectorAll('[data-recent-delete]').forEach(b =>
      b.addEventListener('click', async () => {
        if (!window.confirm('Delete this entry? This cannot be undone.')) return;
        try {
          await api('DELETE', `/api/entries/${b.dataset.recentDelete}`);
          toast('Entry deleted');
          drawRecent();
        } catch (err) { toast(err.message); }
      }));
  }

  // Which section page holds a given table, so the admin can jump there to correct it.
  function sectionIdFor(tableId) {
    for (const cat of categories) {
      for (const s of cat.sections) if (!s.overview && !s.recent && s.tables.includes(tableId)) return s.id;
    }
    return '';
  }

  // ---------- first sign-in ----------
  function renderFirstPassword() {
    document.title = 'Choose your password · SDSI Data Entry';
    $sidebar.innerHTML = '';
    const min = me.minPassword || 8;
    $main.innerHTML = `
      <h1>Choose your own password</h1>
      <p class="intro">You signed in with the password you were given. Pick one that only you
        know, and the site will open. You will use it every day from now on.</p>
      <section class="card" style="max-width:520px">
        <div class="card-head"><h2>${esc(me.name)}<span class="count">${esc(me.username)}</span></h2></div>
        <form class="entry-form" id="firstPw" novalidate>
          <div class="form-grid">
            <div class="field wide"><label for="f_current">The password you were given <span class="req">*</span></label>
              <input type="password" id="f_current" name="current" autocomplete="current-password" required></div>
            <div class="field wide"><label for="f_new">Your new password <span class="req">*</span>
              <span class="unit">(at least ${min} characters)</span></label>
              <input type="password" id="f_new" name="password" autocomplete="new-password" required></div>
            <div class="field wide"><label for="f_again">Type it again <span class="req">*</span></label>
              <input type="password" id="f_again" name="again" autocomplete="new-password" required></div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save and open the site</button>
            <span class="form-error" hidden></span>
          </div>
        </form>
      </section>`;
    const form = document.getElementById('firstPw');
    const $err = form.querySelector('.form-error');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      $err.hidden = true;
      const fd = Object.fromEntries(new FormData(form));
      if (String(fd.password).length < min) { $err.textContent = `Use at least ${min} characters.`; $err.hidden = false; return; }
      if (fd.password !== fd.again) { $err.textContent = 'The two new passwords are different.'; $err.hidden = false; return; }
      try {
        await api('POST', '/api/password', { current: fd.current, password: fd.password });
        location.reload();
      } catch (err) { $err.textContent = err.message; $err.hidden = false; }
    });
    form.querySelector('input').focus();
  }

  // ---------- routing ----------
  function route() {
    if (!me) return;
    if (location.hash.startsWith('#/account')) { renderAccount(); }
    else {
      const m = location.hash.match(/^#\/s\/([\w-]+)/);
      if (m) renderSectionPage(m[1]); else renderHome();
    }
    $main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- start ----------
  async function boot() {
    try {
      const res = await api('GET', '/api/me');
      me = res.user;
    } catch { me = null; }
    if (!me) { location.replace('/login.html'); return; }

    nav = buildNav();
    const $who = document.getElementById('who');
    document.getElementById('whoName').textContent = me.scope ? `${me.name}` : me.name;
    $who.hidden = false;
    document.getElementById('signOut').addEventListener('click', async () => {
      try { await api('POST', '/api/logout'); } catch { /* sign out anyway */ }
      location.replace('/login.html');
    });

    // A handed-out password gets replaced before anything else opens.
    if (me.mustChange) { renderFirstPassword(); return; }

    if (!nav.length) {
      renderSidebar();
      $main.innerHTML = `<h1>Nothing assigned yet</h1>
        <p class="intro">This account has no sections to enter. Ask the administrator to assign one.</p>`;
      return;
    }
    window.addEventListener('hashchange', route);
    route();
  }

  boot();
})();
