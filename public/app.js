(function () {
  const { tables, categories, helpers } = window.SDSI;
  const { fmt, fyOfMonth, formatPeriod, formatDate, inRange, isDated } = helpers;

  const $sidebar = document.getElementById('sidebar');
  const $main = document.getElementById('main');
  const $toast = document.getElementById('toast');
  const $menuBtn = document.getElementById('menuBtn');

  const PERIOD_LABEL = { month: 'Month', fy: 'Financial year', year: 'Year', date: 'Date' };
  const openCats = new Set(loadOpenCats());
  let current = null; // { section, rows: {tableId: [...]}, editing: {tableId, id|null} }

  // ---------- utilities ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const findSection = id => {
    for (const cat of categories) for (const s of cat.sections) if (s.id === id) return { cat, section: s };
    return null;
  };
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
      ${categories.map(cat => `
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
    $main.innerHTML = `
      <h1>Sustainability data entry</h1>
      <p class="intro">Pick a category, then the section you are responsible for. Each section shows its tables, a form to add entries, and the figures calculated for the report.</p>
      <div class="cat-cards">
        ${categories.map(cat => `
          <section class="cat-card">
            <h2>${esc(cat.title)}</h2>
            <ul>${cat.sections.map(s => `<li><a href="#/s/${s.id}">${esc(s.title)} <span>${s.tables.length} table${s.tables.length > 1 ? 's' : ''} ›</span></a></li>`).join('')}</ul>
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
    try {
      current.rows = await api('GET', `/api/entries?tables=${section.tables.join(',')}`);
    } catch (err) {
      $main.querySelector('.empty').textContent = `Could not load data: ${err.message}`;
      return;
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
    const hasCalc = section.tables.some(id => tables[id].calcCols);
    $main.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(cat.title)}</div>
      <h1>${esc(section.title)}</h1>
      ${hasCalc ? `<div class="legend"><span><i style="background:var(--calc-bg);border:1px solid var(--border)"></i>Calculated automatically</span><span><i style="background:var(--danger-soft)"></i>Needs attention</span></div>` : ''}
      ${section.tables.map(id => tableCard(id, ctx)).join('')}`;
    bindSection();
    bindReportPanel();
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
    const head = [
      t.serial ? `<th class="num">${esc(t.serial)}</th>` : '',
      t.period ? `<th>${esc(periodLabel(t))}</th>` : '',
      ...t.fields.map(f => `<th class="${f.type === 'number' ? 'num' : ''}">${esc(f.label)}${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}</th>`),
      ...calcCols.map(c => `<th class="calc ${c.text ? '' : 'num'}">${esc(c.label)}${c.unit ? `<span class="unit">${esc(c.unit)}</span>` : ''}</th>`),
      '<th><span class="sr-only"></span></th>',
    ].join('');
    const body = rows.map((r, i) => {
      const c = ctx.calc(r);
      return `<tr class="${c._flag ? 'flag' : ''}">
        ${t.serial ? `<td class="num">${i + 1}</td>` : ''}
        ${t.period ? `<td class="nowrap">${esc(formatPeriod(t.period, r.period))}</td>` : ''}
        ${t.fields.map(f => { const x = cell(f, r.data[f.key]); return `<td class="${x.cls}">${x.html}</td>`; }).join('')}
        ${calcCols.map(cc => cc.text ? `<td class="calc">${esc(c[cc.key] ?? '—')}</td>` : `<td class="calc num">${fmt(c[cc.key], cc.digits ?? 2)}</td>`).join('')}
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
    return `
      <form class="entry-form" novalidate>
        <h3>${row ? 'Edit entry' : 'New entry'}</h3>
        <div class="form-grid">
          ${t.period ? `<div class="field"><label for="f___period">${esc(periodLabel(t))} <span class="req">*</span></label>${periodInputHtml(t, row ? row.period : null)}</div>` : ''}
          ${t.fields.map(f => `
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
        const first = form.querySelector('input, select, textarea');
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

  // ---------- routing ----------
  function route() {
    const m = location.hash.match(/^#\/s\/([\w-]+)/);
    if (m) renderSectionPage(m[1]); else renderHome();
    $main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
