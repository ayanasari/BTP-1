// Categories, subsections, tables and columns for the SDSI data-entry portal.
// Scope: solid waste and sewage only. Entry is daily; the monthly figures published on
// https://www.iitkgp.ac.in/navpage/sdsi are rolled up from the daily rows, never typed in.
// Loaded by the browser (window.SDSI) and by the server (require).
(function (root) {
  // ---------- helpers ----------
  const num = v => (v === '' || v == null || !isFinite(+v)) ? null : +v;
  const add = (...vals) => vals.every(v => v == null) ? null : vals.reduce((s, v) => s + (v || 0), 0);
  const pct = (part, whole) => (part == null || !whole) ? null : part / whole * 100;
  const groupBy = (rows, keyFn) => rows.reduce((m, r) => { const k = keyFn(r); (m[k] = m[k] || []).push(r); return m; }, {});
  const sumOf = (rows, key) => add(...rows.map(r => num(r.data[key])));
  const fmt = (v, digits = 2) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits });
  const tons = kg => kg == null ? null : kg / 1000;
  // '2025-04' -> '2025-26' (financial year runs April to March)
  const fyOfMonth = m => {
    const [y, mo] = m.split('-').map(Number);
    const start = mo >= 4 ? y : y - 1;
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  };
  const byKeyDesc = obj => Object.keys(obj).sort().reverse();

  // ---------- ISO weeks ----------
  // Horticulture and e-waste are weighed once a week rather than daily, so those entries
  // are stored as an ISO week, '2026-W47', which is also what <input type="week"> gives.
  // ISO 8601: weeks run Monday to Sunday, and a week belongs to the year containing its
  // Thursday — so the first days of January can fall in week 52 or 53 of the year before.
  const isoDow = d => d.getUTCDay() || 7;          // Monday 1 … Sunday 7
  const utc = s => new Date(`${s}T00:00:00Z`);
  const isoDate = d => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

  // The Monday of ISO week w of year y.
  function weekStart(y, w) {
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const week1Monday = addDays(jan4, 1 - isoDow(jan4));
    return addDays(week1Monday, (w - 1) * 7);
  }
  // '2026-03-11' -> '2026-W11'
  function isoWeekOf(dateStr) {
    const d = utc(dateStr);
    const thursday = addDays(d, 4 - isoDow(d));    // the week's Thursday decides the year
    const y = thursday.getUTCFullYear();
    const w = Math.round((thursday - weekStart(y, 1)) / (7 * 86400000)) + 1;
    return `${y}-W${String(w).padStart(2, '0')}`;
  }
  const weekParts = p => { const m = /^(\d{4})-W(\d{2})$/.exec(p || ''); return m && { y: +m[1], w: +m[2] }; };

  // A week can straddle two months, so it is counted in the month holding its Thursday —
  // the same majority rule ISO uses to assign a week to a year.
  function monthOfWeek(p) {
    const q = weekParts(p);
    if (!q) return '';
    return isoDate(addDays(weekStart(q.y, q.w), 3)).slice(0, 7);
  }

  // The month an entry counts towards, whether it was entered by date, month or week.
  const monthOf = r => {
    const p = r.period || '';
    return p.includes('W') ? monthOfWeek(p) : p.slice(0, 7);
  };
  // First and last day ('YYYY-MM-DD') covered by a period value of the given type.
  const periodRange = (type, p) => {
    if (!p) return null;
    if (type === 'month') {
      const [y, m] = p.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return [`${p}-01`, `${p}-${String(last).padStart(2, '0')}`];
    }
    if (type === 'fy') { const y = Number(p.slice(0, 4)); return [`${y}-04-01`, `${y + 1}-03-31`]; }
    if (type === 'year') return [`${p}-01-01`, `${p}-12-31`];
    if (type === 'week') {
      const q = weekParts(p);
      if (!q) return null;
      const mon = weekStart(q.y, q.w);
      return [isoDate(mon), isoDate(addDays(mon, 6))];
    }
    return [p, p];
  };
  // Does an entry fall inside [from, to]? Tables with no date are standing lists.
  const inRange = (table, row, from, to) => {
    if (!from || !to) return true;
    let span = null;
    if (table.period) span = periodRange(table.period, row.period);
    else if (table.dateField) {
      const s = row.data[table.dateField];
      span = s ? [s, (table.endDateField && row.data[table.endDateField]) || s] : null;
    } else return true;
    if (!span) return false;
    const [start, end] = span;
    return (start >= from && start <= to) || (start <= to && end >= to);
  };
  const isDated = table => !!(table.period || table.dateField);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // '2025-07-30' -> '30 Jul 2025'
  const formatDate = iso => {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${+d} ${MONTHS[+m - 1]} ${y}`;
  };
  const formatPeriod = (type, p) => {
    if (!p) return '—';
    if (type === 'month') { const [y, m] = p.split('-'); return `${MONTHS[+m - 1]} ${y}`; }
    if (type === 'date') return formatDate(p);
    // A bare 'W47' means nothing to the person weighing the leaves, so the dates are shown.
    if (type === 'week') {
      const span = periodRange('week', p);
      if (!span) return p;
      const [a, b] = span.map(d => utc(d));
      const sameMonth = a.getUTCMonth() === b.getUTCMonth();
      const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
      const from = `${a.getUTCDate()}${sameMonth ? '' : ' ' + MONTHS[a.getUTCMonth()]}${sameYear ? '' : ' ' + a.getUTCFullYear()}`;
      return `${from} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
    }
    return p;
  };
  const formatMonth = m => formatPeriod('month', m);

  // ---------- fixed lists ----------
  // Every hall of residence on campus, plus the three research blocks that have boarders
  // but are not called halls (VSRC-1, VSRC-2, PDF Block). Savitribai Phule is one entry
  // even though HMC lists two blocks, because the two blocks share one kitchen.
  //
  // These strings are stored inside every entry, so DO NOT reword one that is already in
  // use — an entry made against the old wording would stop matching. To rename a hall,
  // add the new wording and migrate the rows, or leave it alone. The short forms below are
  // what people on campus actually say; the full name sits on the account in users.js.
  const HALLS = [
    'ABV Hall', 'Ambedkar Hall', 'Azad Hall', 'BC Roy Hall', 'Gokhale Hall',
    'HJB Hall', 'JCB Hall', 'LBS Hall', 'LLR Hall', 'MMM Hall',
    'Meghnad Saha Hall', 'Mother Teresa Hall', 'Nehru Hall', 'Nivedita Hall',
    'Patel Hall', 'RK Hall', 'RP Hall', 'Rani Laxmibai Hall', 'SAM Hall',
    'SNIG Hall', 'Savitribai Phule Hall', 'Vidyasagar Hall', 'Zakir Hussain Hall',
    'VSRC-1', 'VSRC-2', 'PDF Block',
  ];
  const PLANTS = [
    'STP-1', 'STP at Pump house 3', 'STP at SPMS Hospital',
    'STP for Diamond Jubilee Complex (DJC)', 'STP at Nehru Hall',
    'ETP in Chemical Eng. Annex', 'ETP for DJC',
  ];
  const MATERIALS = ['Cartons', 'Paper', 'Iron scrap', 'Plastics', 'Glass', 'Other'];
  const FACILITIES = ['Biogas plant', 'Compost pit', 'Vermicompost'];

  // ---------- tables ----------
  const tables = {
    // ===== Solid waste: generation =====
    mess_waste: {
      title: 'Mess food waste',
      period: 'date',
      periodLabel: 'Date',
      unique: ['period', 'hall'],
      scopeField: 'hall',          // staff accounts are locked to one hall
      fields: [
        { key: 'hall', label: 'Hall', type: 'select', options: HALLS, required: true },
        { key: 'food_kg', label: 'Food waste', unit: 'kg', type: 'number', required: true },
      ],
      summary(rows) {
        const byMonth = groupBy(rows.filter(r => r.period), monthOf);
        const months = byKeyDesc(byMonth);
        const latest = months[0];
        const days = rs => new Set(rs.map(r => r.period)).size;
        // A mess account only ever sees its own hall, so it gets no hall breakdown. The
        // administrator sees many, and at this many halls the breakdown has to be rows:
        // one column per hall was readable at four and is not at twenty-six.
        const multi = HALLS.filter(h => rows.some(r => r.data.hall === h)).length > 1;

        const monthly = {
          head: ['Month', 'Days entered', ...(multi ? ['Halls reporting'] : []), 'Total, kg', 'Total, Tons'],
          rows: months.map(m => {
            const rs = byMonth[m];
            const total = sumOf(rs, 'food_kg');
            return [formatMonth(m), days(rs),
              ...(multi ? [new Set(rs.map(r => r.data.hall)).size] : []),
              fmt(total, 0), fmt(tons(total), 3)];
          }),
        };

        // Every hall, including the ones that entered nothing — a blank row is the point,
        // because it shows the administrator who still has to be chased.
        const byHall = multi && latest ? {
          caption: `By hall, ${formatMonth(latest)}`,
          head: ['Hall', 'Days entered', 'Food waste, kg'],
          rows: HALLS.map(h => {
            const rs = byMonth[latest].filter(r => r.data.hall === h);
            return rs.length ? [h, days(rs), fmt(sumOf(rs, 'food_kg'), 0)] : [h, '—', '—'];
          }),
        } : null;

        return {
          items: latest ? [
            { label: `Total, ${formatMonth(latest)}`, value: `${fmt(sumOf(byMonth[latest], 'food_kg'), 0)} kg` },
            { label: 'Days entered that month', value: days(byMonth[latest]) },
            ...(multi ? [{ label: 'Halls reporting that month', value: `${new Set(byMonth[latest].map(r => r.data.hall)).size} of ${HALLS.length}` }] : []),
          ] : [],
          tables: byHall ? [monthly, byHall] : [monthly],
        };
      },
    },

    dry_waste: {
      title: 'Dry waste collected',
      period: 'date',
      periodLabel: 'Date',
      unique: ['period'],
      fields: [
        { key: 'dry_kg', label: 'Dry waste, campus total', unit: 'kg', type: 'number', required: true },
      ],
      summary(rows) {
        const byMonth = groupBy(rows.filter(r => r.period), monthOf);
        const months = byKeyDesc(byMonth);
        const latest = months[0];
        return {
          items: latest ? [
            { label: `Total, ${formatMonth(latest)}`, value: `${fmt(tons(sumOf(byMonth[latest], 'dry_kg')), 3)} Tons` },
            { label: 'Days entered that month', value: byMonth[latest].length },
          ] : [],
          table: {
            head: ['Month', 'Days entered', 'Total, kg', 'Total, Tons', 'Average, kg/day'],
            rows: months.map(m => {
              const rs = byMonth[m], total = sumOf(rs, 'dry_kg');
              return [formatMonth(m), rs.length, fmt(total, 0), fmt(tons(total), 3), fmt(total / rs.length, 0)];
            }),
          },
        };
      },
    },

    horticulture_waste: {
      title: 'Horticulture waste',
      // Weighed once a week, not daily: the grounds staff clear and weigh leaves across
      // several days, so a weekly figure is both easier to give and more honest than
      // pretending each day was measured separately.
      period: 'week',
      periodLabel: 'Week',
      unique: ['period'],
      fields: [
        { key: 'leaves_kg', label: 'Dry leaves', unit: 'kg', type: 'number' },
        { key: 'other_kg', label: 'Grass, clippings and other garden waste', unit: 'kg', type: 'number' },
        { key: 'composted_kg', label: 'Of which composted on site', unit: 'kg', type: 'number' },
      ],
      calcCols: [{ key: 'total_kg', label: 'Total', unit: 'kg', digits: 0 }],
      calc(r) { return { total_kg: add(num(r.data.leaves_kg), num(r.data.other_kg)) }; },
      summary(rows, ctx) {
        const byMonth = groupBy(rows.filter(r => r.period), monthOf);
        const months = byKeyDesc(byMonth);
        const monthTotal = m => add(...byMonth[m].map(r => ctx.calc(r).total_kg));
        const latest = months[0];
        return {
          items: latest ? [{ label: `Total, ${formatMonth(latest)}`, value: `${fmt(tons(monthTotal(latest)), 3)} Tons` }] : [],
          table: {
            head: ['Month', 'Days entered', 'Dry leaves, kg', 'Other, kg', 'Total, Tons', 'Composted on site, kg'],
            rows: months.map(m => {
              const rs = byMonth[m];
              return [formatMonth(m), rs.length, fmt(sumOf(rs, 'leaves_kg'), 0), fmt(sumOf(rs, 'other_kg'), 0),
                fmt(tons(monthTotal(m)), 3), fmt(sumOf(rs, 'composted_kg'), 0)];
            }),
          },
        };
      },
    },

    // ===== Solid waste: processing and recycling =====
    waste_processed: {
      title: 'Organic waste processed',
      period: 'date',
      periodLabel: 'Date',
      unique: ['period', 'facility'],
      scopeField: 'facility',
      fields: [
        { key: 'facility', label: 'Facility', type: 'select', options: FACILITIES, required: true },
        { key: 'input_kg', label: 'Waste received', unit: 'kg', type: 'number', required: true },
        { key: 'output_kg', label: 'Compost or gas produced', unit: 'kg', type: 'number' },
      ],
      calcCols: [{ key: 'yield_pct', label: 'Output of input', unit: '%', digits: 1 }],
      calc(r) { return { yield_pct: pct(num(r.data.output_kg), num(r.data.input_kg)) }; },
      summary(rows) {
        const byMonth = groupBy(rows.filter(r => r.period), monthOf);
        const months = byKeyDesc(byMonth);
        const latest = months[0];
        return {
          items: latest ? [
            { label: `Processed, ${formatMonth(latest)}`, value: `${fmt(tons(sumOf(byMonth[latest], 'input_kg')), 3)} Tons` },
          ] : [],
          table: {
            head: ['Month', 'Received, kg', 'Received, Tons', 'Produced, kg'],
            rows: months.map(m => {
              const rs = byMonth[m], input = sumOf(rs, 'input_kg');
              return [formatMonth(m), fmt(input, 0), fmt(tons(input), 3), fmt(sumOf(rs, 'output_kg'), 0)];
            }),
          },
        };
      },
    },

    recyclables_sold: {
      title: 'Recyclables sold',
      period: 'date',
      periodLabel: 'Date of lot',
      unique: ['period', 'material'],
      fields: [
        { key: 'material', label: 'Material', type: 'select', options: MATERIALS, required: true },
        { key: 'qty_kg', label: 'Quantity', unit: 'kg', type: 'number', required: true },
        { key: 'vendor', label: 'Vendor', type: 'text' },
      ],
      summary(rows) {
        const byMonth = groupBy(rows.filter(r => r.period), monthOf);
        const months = byKeyDesc(byMonth);
        const used = MATERIALS.filter(mat => rows.some(r => r.data.material === mat));
        return {
          items: months[0] ? [
            { label: `Sold, ${formatMonth(months[0])}`, value: `${fmt(tons(sumOf(byMonth[months[0]], 'qty_kg')), 3)} Tons` },
          ] : [],
          table: {
            head: ['Month', ...used.map(mat => `${mat}, kg`), 'Total, kg', 'Total, Tons'],
            rows: months.map(m => {
              const rs = byMonth[m], total = sumOf(rs, 'qty_kg');
              return [formatMonth(m),
                ...used.map(mat => fmt(sumOf(rs.filter(r => r.data.material === mat), 'qty_kg'), 0)),
                fmt(total, 0), fmt(tons(total), 3)];
            }),
          },
        };
      },
    },

    ewaste_disposal: {
      title: 'Electronic waste handed over',
      // Recorded by the week it was handed over. Lots go out every few weeks rather than
      // daily, and the published figure is a yearly total, so the week is precise enough.
      period: 'week',
      periodLabel: 'Week',
      fields: [
        { key: 'description', label: 'Items', type: 'text', required: true },
        { key: 'qty_kg', label: 'Quantity', unit: 'kg', type: 'number', required: true },
        { key: 'vendor', label: 'Authorised vendor', type: 'text' },
      ],
      summary(rows) {
        // monthOf, not a slice: these periods are weeks now, and a week that straddles
        // two months counts in the one holding its Thursday.
        const byFy = groupBy(rows.filter(r => r.period), r => fyOfMonth(monthOf(r)));
        return {
          items: [{ label: 'Total handed over', value: `${fmt(sumOf(rows, 'qty_kg'), 0)} kg` }],
          table: {
            head: ['Financial year', 'Handovers', 'Quantity, kg'],
            rows: byKeyDesc(byFy).map(fy => [fy, byFy[fy].length, fmt(sumOf(byFy[fy], 'qty_kg'), 0)]),
          },
        };
      },
    },

    // ===== Sewage =====
    stp_plants: {
      title: 'Sewage and effluent treatment plants',
      period: null,
      serial: 'S. No.',
      fields: [
        { key: 'description', label: 'Description', type: 'text', required: true },
        { key: 'year_commissioned', label: 'Year of commissioning', type: 'number', plain: true },
        { key: 'capacity_mld', label: 'Capacity', unit: 'Million litres per day', type: 'number', required: true },
      ],
      summary(rows) {
        return { items: [
          { label: 'Number of plants', value: rows.length },
          { label: 'Total Capacity', value: `${fmt(sumOf(rows, 'capacity_mld'), 3)} MLD` },
        ] };
      },
    },

    stp_daily: {
      title: 'Daily plant log',
      period: 'date',
      periodLabel: 'Date',
      unique: ['period', 'plant'],
      scopeField: 'plant',
      fields: [
        { key: 'plant', label: 'Plant', type: 'select', options: PLANTS, required: true },
        { key: 'flow_mld', label: 'Sewage treated', unit: 'MLD', type: 'number', required: true },
        { key: 'ph_in', label: 'pH, Inlet', type: 'number' },
        { key: 'ph_out', label: 'pH, Outlet', type: 'number' },
      ],
      note: 'Regulatory limit, NGT 2018: pH 5.5 to 9.0',
      calcCols: [{ key: 'ph_ok', label: 'Outlet pH within limit', text: true }],
      calc(r) {
        const ph = num(r.data.ph_out);
        if (ph == null) return { ph_ok: '—' };
        const ok = ph >= 5.5 && ph <= 9.0;
        return { ph_ok: ok ? 'Yes' : 'No', _flag: !ok };
      },
      summary(rows) {
        const byMonth = groupBy(rows.filter(r => r.period), monthOf);
        const months = byKeyDesc(byMonth);
        const latest = months[0];
        return {
          items: latest ? [
            { label: `Average flow, ${formatMonth(latest)}`, value: `${fmt(sumOf(byMonth[latest], 'flow_mld') / byMonth[latest].length, 3)} MLD` },
            { label: 'Logs that month', value: byMonth[latest].length },
          ] : [],
          table: {
            head: ['Month', 'Logs', 'Total treated, ML', 'Average, MLD'],
            rows: months.map(m => {
              const rs = byMonth[m], total = sumOf(rs, 'flow_mld');
              return [formatMonth(m), rs.length, fmt(total, 2), fmt(total / rs.length, 3)];
            }),
          },
        };
      },
    },

    stp_lab: {
      title: 'Laboratory readings',
      period: 'date',
      periodLabel: 'Sample date',
      unique: ['period', 'plant'],
      scopeField: 'plant',
      fields: [
        { key: 'plant', label: 'Plant', type: 'select', options: PLANTS, required: true },
        { key: 'ph_in', label: 'pH, Inlet', type: 'number' },
        { key: 'ph_out', label: 'pH, Outlet', type: 'number' },
        { key: 'cod_in', label: 'COD, Inlet', unit: 'mg/L', type: 'number' },
        { key: 'cod_out', label: 'COD, Outlet', unit: 'mg/L', type: 'number' },
        { key: 'bod_in', label: 'BOD3 at 27 °C, Inlet', unit: 'mg/L', type: 'number' },
        { key: 'bod_out', label: 'BOD3 at 27 °C, Outlet', unit: 'mg/L', type: 'number' },
        { key: 'tss_in', label: 'TSS, Inlet', unit: 'mg/L', type: 'number' },
        { key: 'tss_out', label: 'TSS, Outlet', unit: 'mg/L', type: 'number' },
      ],
      note: 'Regulatory limit, NGT 2018: pH 5.5 to 9.0 · COD 50 mg/L · BOD3 10 mg/L · TSS 20 mg/L',
      calcCols: [
        { key: 'cod_rem', label: 'COD removal', unit: '%', digits: 1 },
        { key: 'bod_rem', label: 'BOD3 removal', unit: '%', digits: 1 },
        { key: 'tss_rem', label: 'TSS removal', unit: '%', digits: 1 },
        { key: 'within', label: 'Outlet within limit', text: true },
      ],
      limits: { ph: [5.5, 9.0], cod: 50, bod: 10, tss: 20 },
      calc(r) {
        const d = r.data, L = tables.stp_lab.limits;
        const rem = p => { const i = num(d[p + '_in']), o = num(d[p + '_out']); return (i == null || o == null || !i) ? null : (i - o) / i * 100; };
        const over = [];
        const ph = num(d.ph_out);
        if (ph != null && (ph < L.ph[0] || ph > L.ph[1])) over.push('pH');
        if (num(d.cod_out) != null && num(d.cod_out) > L.cod) over.push('COD');
        if (num(d.bod_out) != null && num(d.bod_out) > L.bod) over.push('BOD3');
        if (num(d.tss_out) != null && num(d.tss_out) > L.tss) over.push('TSS');
        const anyOut = ['ph_out', 'cod_out', 'bod_out', 'tss_out'].some(k => num(d[k]) != null);
        return {
          cod_rem: rem('cod'), bod_rem: rem('bod'), tss_rem: rem('tss'),
          within: !anyOut ? '—' : over.length ? `No: ${over.join(', ')}` : 'Yes',
          _flag: over.length > 0,
        };
      },
      summary(rows, ctx) {
        const dated = rows.filter(r => r.period).sort((a, b) => b.period.localeCompare(a.period));
        const failing = dated.filter(r => ctx.calc(r)._flag);
        const byPlant = groupBy(dated, r => r.data.plant || '—');
        return {
          items: [
            { label: 'Samples entered', value: dated.length },
            { label: 'Samples exceeding a limit', value: failing.length, flag: failing.length > 0 },
            { label: 'Latest sample', value: dated[0] ? `${formatDate(dated[0].period)}: ${ctx.calc(dated[0]).within}` : '—' },
          ],
          table: {
            head: ['Plant', 'Samples', 'Exceeding a limit', 'Latest sample'],
            rows: Object.keys(byPlant).sort().map(p => {
              const rs = byPlant[p];
              return [p, rs.length, rs.filter(r => ctx.calc(r)._flag).length, formatDate(rs[0].period)];
            }),
          },
        };
      },
    },
  };

  // ---------- cross-table overviews (read-only pages) ----------
  // The monthly figures published on the SDSI pages, rolled up from the daily rows.
  const overviews = {
    waste_monthly(ctx) {
      const all = ['mess_waste', 'dry_waste', 'horticulture_waste', 'waste_processed', 'recyclables_sold', 'ewaste_disposal'];
      const months = new Set();
      all.forEach(id => (ctx.rows[id] || []).forEach(r => { if (r.period) months.add(monthOf(r)); }));
      const list = [...months].sort().reverse();
      const monthRows = (id, m) => (ctx.rows[id] || []).filter(r => monthOf(r) === m);
      const hortTotal = m => add(...monthRows('horticulture_waste', m).map(r => tables.horticulture_waste.calc(r).total_kg));

      const body = list.map(m => {
        // Food waste weighed by the four hall messes.
        const food = sumOf(monthRows('mess_waste', m), 'food_kg');
        // Wet waste as the institute publishes it. The messes are the only wet waste the
        // portal collects today, so the two are equal; wet waste gathered from bins
        // elsewhere on campus is added here once it is weighed separately.
        const wet = food;
        const dry = sumOf(monthRows('dry_waste', m), 'dry_kg');
        const hort = hortTotal(m);
        return {
          month: m,
          horticulture: tons(hort), dry: tons(dry), wet: tons(wet), food: tons(food),
          total: tons(add(hort, dry, wet)),
          recycled: tons(sumOf(monthRows('recyclables_sold', m), 'qty_kg')),
          processed: tons(sumOf(monthRows('waste_processed', m), 'input_kg')),
          ewaste: sumOf(monthRows('ewaste_disposal', m), 'qty_kg'),
        };
      });

      const fyRows = Object.entries(groupBy(body, b => fyOfMonth(b.month)))
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([fy, bs]) => [fy, bs.length,
          fmt(add(...bs.map(b => b.horticulture)), 3), fmt(add(...bs.map(b => b.dry)), 3),
          fmt(add(...bs.map(b => b.wet)), 3), fmt(add(...bs.map(b => b.food)), 3),
          fmt(add(...bs.map(b => b.total)), 3), fmt(add(...bs.map(b => b.recycled)), 3),
          fmt(add(...bs.map(b => b.processed)), 3), fmt(add(...bs.map(b => b.ewaste)), 0)]);

      return {
        title: 'Waste generated, monthly',
        intro: 'Every figure here is added up from the daily entries. Nothing on this page is typed in by hand.',
        head: ['Month', 'Horticulture Waste, Tons', 'Dry Waste, Tons', 'Wet Waste, Tons',
               'Food Waste, Tons', 'Total Solid Waste, Tons',
               'Dry Waste Recycled, Tons', 'Bio/Food Waste Processed, Tons', 'Electronic Waste, Kg'],
        rows: body.map(b => [formatMonth(b.month), fmt(b.horticulture, 3), fmt(b.dry, 3), fmt(b.wet, 3),
          fmt(b.food, 3), fmt(b.total, 3), fmt(b.recycled, 3), fmt(b.processed, 3), fmt(b.ewaste, 0)]),
        extra: fyRows.length ? {
          title: 'By financial year',
          head: ['Financial year', 'Months with data', 'Horticulture, Tons', 'Dry, Tons', 'Wet, Tons', 'Food, Tons',
                 'Total, Tons', 'Recycled, Tons', 'Processed, Tons', 'E-waste, Kg'],
          rows: fyRows,
        } : null,
      };
    },
  };

  // ---------- figures the institute already publishes ----------
  // Copied from iitkgp.ac.in/solid-waste-management and /sewage-treatment-and-cleanliness-
  // initiatives. They are history: the portal did not collect them, and nobody enters them
  // here. They sit on the public page so it is continuous with what the institute already
  // reports, and a year the portal has its own entries for replaces the published row.
  //
  // NOTE on "Total Solid Waste": on the institute's table the total is dry + wet and
  // EXCLUDES horticulture waste, in all three years. That is their definition, so the
  // public page follows it. Confirm with SDSI before changing it — our own monthly
  // summary adds horticulture in, so the two will not agree until this is settled.
  const PUBLISHED_WASTE = [
    // fy,        total,  horticulture, dry,  wet, recycled, processed, ewaste kg
    ['2024-25', 298.00, 620.00, 225.00, 73.00, 2.50, 6.00, 4230],
    ['2023-24', 247.00, 650.00, 215.00, 32.00, 1.50, 5.50, 3964],
    ['2022-23', 222.00, 638.00, 180.00, 42.00, 4.00, 4.80, 3686],
  ].map(([fy, total, horticulture, dry, wet, recycled, processed, ewaste]) =>
    ({ fy, total, horticulture, dry, wet, recycled, processed, ewaste, published: true }));

  // The inlet/outlet sample published for the 1.35 MLD plant. The institute gives no
  // sampling date, so none is shown.
  const PUBLISHED_LAB = {
    plant: 'STP-1 (1.35 MLD)',
    rows: [
      ['pH', '—', '6.9', '7.5', '5.5 to 9.0'],
      ['COD', 'mg/L', '567', '5', '50'],
      ['BOD3 at 27 °C', 'mg/L', '121', '3', '10'],
      ['TSS', 'mg/L', '156', '10', '20'],
    ],
  };

  // ---------- the public page ----------
  // What anyone may see without signing in. It mirrors the figures the institute already
  // publishes on its Solid Waste Management and Sewage Treatment pages, so the shape is
  // theirs: financial years, tonnes, and the plant list with capacities in MLD.
  //
  // This runs ON THE SERVER and returns only finished totals. No daily entry, no hall
  // breakdown, no account name and no date finer than a financial year ever leaves the
  // building through it — which is the whole reason the rollup is not done in the browser
  // the way the administrator's summary is.
  function publicView(ctx) {
    const waste = ['mess_waste', 'dry_waste', 'horticulture_waste', 'waste_processed',
      'recyclables_sold', 'ewaste_disposal'];
    const rowsOf = id => ctx.rows[id] || [];
    const fyOfRow = r => fyOfMonth(monthOf(r));
    const inFy = (id, fy) => rowsOf(id).filter(r => r.period && fyOfRow(r) === fy);

    const years = new Set();
    waste.forEach(id => rowsOf(id).forEach(r => { if (r.period) years.add(fyOfRow(r)); }));
    const list = [...years].sort().reverse();

    const entered = list.map(fy => {
      const food = sumOf(inFy('mess_waste', fy), 'food_kg');
      const wet = food;   // see the monthly rollup: campus bin collection is added here later
      const dry = sumOf(inFy('dry_waste', fy), 'dry_kg');
      const hort = add(...inFy('horticulture_waste', fy).map(r => tables.horticulture_waste.calc(r).total_kg));
      return {
        fy,
        // The institute's definition: dry plus wet, with horticulture reported alongside
        // rather than inside it. See the note on PUBLISHED_WASTE.
        total: tons(add(dry, wet)),
        horticulture: tons(hort), dry: tons(dry), wet: tons(wet),
        recycled: tons(sumOf(inFy('recyclables_sold', fy), 'qty_kg')),
        processed: tons(sumOf(inFy('waste_processed', fy), 'input_kg')),
        ewaste: sumOf(inFy('ewaste_disposal', fy), 'qty_kg'),
      };
    });

    // The portal's own figures win for a year it covers; published history fills the rest.
    const covered = new Set(entered.map(r => r.fy));
    const byYear = entered
      .concat(PUBLISHED_WASTE.filter(p => !covered.has(p.fy)))
      .sort((a, b) => b.fy.localeCompare(a.fy));

    // Column order follows the institute's own published table.
    const wasteTable = {
      // Short headings so all eight columns fit a laptop without sideways scrolling;
      // the units are stated once, above the table.
      head: ['Financial Year', 'Total Solid Waste', 'Horticulture', 'Dry', 'Wet',
        'Dry Recycled', 'Bio/Food Processed', 'Electronic Waste, Kg'],
      rows: byYear.map(y => [y.published ? `${y.fy} *` : y.fy,
        fmt(y.total, 2), fmt(y.horticulture, 2), fmt(y.dry, 2),
        fmt(y.wet, 2), fmt(y.recycled, 2), fmt(y.processed, 2), fmt(y.ewaste, 0)]),
      note: byYear.some(y => y.published)
        ? '* Published by the institute for years before this portal began recording.'
        : null,
    };

    // Oldest first, because a chart reads left to right through time.
    const chron = [...byYear].reverse();
    const chart = {
      labels: chron.map(y => y.fy),
      stack: [
        { name: 'Horticulture', values: chron.map(y => y.horticulture || 0) },
        { name: 'Dry', values: chron.map(y => y.dry || 0) },
        { name: 'Wet', values: chron.map(y => y.wet || 0) },
      ],
      // The label above each bar is the height of the bar — all three types added up —
      // NOT the institute's "Total Solid Waste", which leaves horticulture out. A bar
      // labelled with a number smaller than itself would be a chart that lies.
      totals: chron.map(y => add(y.horticulture, y.dry, y.wet) || 0),
      recovered: chron.map(y => add(y.recycled, y.processed) || 0),
    };

    const plants = rowsOf('stp_plants').map(r => r.data);
    const capacity = add(...plants.map(p => num(p.capacity_mld)));

    // The most recent lab sample from the plant that is sampled most often — the same
    // inlet/outlet comparison against the NGT limits the institute publishes.
    const lab = rowsOf('stp_lab').filter(r => r.period);
    const mainPlant = Object.entries(groupBy(lab, r => r.data.plant || '—'))
      .sort((a, b) => b[1].length - a[1].length)[0];
    const newest = mainPlant
      ? mainPlant[1].slice().sort((a, b) => b.period.localeCompare(a.period))[0]
      : null;
    const L = tables.stp_lab.limits;
    const labRows = !newest ? [] : [
      ['pH', '—', 'ph', `${L.ph[0]} to ${L.ph[1]}`],
      ['COD', 'mg/L', 'cod', `${L.cod}`],
      ['BOD3 at 27 °C', 'mg/L', 'bod', `${L.bod}`],
      ['TSS', 'mg/L', 'tss', `${L.tss}`],
    ].map(([label, unit, key, limit]) => [label, unit,
      fmt(num(newest.data[`${key}_in`]), 2), fmt(num(newest.data[`${key}_out`]), 2), limit]);

    // "Figures up to" — the last day any entry covers. A week in progress ends in the
    // future, so it is capped at today; otherwise the page would claim to hold figures
    // for days that have not happened.
    const today = ctx.today || new Date().toISOString().slice(0, 10);
    const allDated = waste.concat(['stp_daily', 'stp_lab'])
      .flatMap(id => rowsOf(id).map(r => periodRange(tables[id].period, r.period)))
      .filter(Boolean).map(s => (s[1] > today ? today : s[1])).sort();

    return {
      updated: allDated.length ? formatDate(allDated[allDated.length - 1]) : null,
      waste: wasteTable,
      chart,
      latestYear: byYear[0] || null,
      plants: {
        head: ['Description', 'Year of commissioning', 'Capacity, MLD'],
        rows: plants
          .slice()
          .sort((a, b) => num(b.capacity_mld) - num(a.capacity_mld))
          .map(p => [p.description, p.year_commissioned || '—', fmt(num(p.capacity_mld), 3)]),
        capacity,
      },
      // A sample entered through the portal if there is one; otherwise the figures the
      // institute publishes, which carry no sampling date.
      lab: labRows.length ? {
        head: ['Parameter', 'Unit', 'Inlet', 'Outlet', 'Regulatory limit, NGT 2018'],
        plant: mainPlant[0],
        sampled: formatDate(newest.period),
        rows: labRows,
      } : {
        head: ['Parameter', 'Unit', 'Inlet', 'Outlet', 'Regulatory limit, NGT 2018'],
        plant: PUBLISHED_LAB.plant,
        sampled: null,
        published: true,
        rows: PUBLISHED_LAB.rows,
      },
    };
  }

  // ---------- navigation: major categories > subsections > tables ----------
  const categories = [
    {
      id: 'waste', title: 'Solid Waste Management',
      sections: [
        { id: 'mess', title: 'Mess food waste', tables: ['mess_waste'] },
        { id: 'dry', title: 'Dry waste collection', tables: ['dry_waste'] },
        { id: 'horticulture', title: 'Horticulture waste', tables: ['horticulture_waste'] },
        { id: 'processing', title: 'Organic waste processing', tables: ['waste_processed'] },
        { id: 'recycling', title: 'Recyclables and e-waste', tables: ['recyclables_sold', 'ewaste_disposal'] },
        { id: 'waste-summary', title: 'Monthly summary', viewOnly: true, overview: 'waste_monthly',
          tables: ['mess_waste', 'dry_waste', 'horticulture_waste', 'waste_processed', 'recyclables_sold', 'ewaste_disposal'] },
      ],
    },
    {
      id: 'sewage', title: 'Sewage Treatment',
      sections: [
        { id: 'stp-plants', title: 'Treatment plants', tables: ['stp_plants'] },
        { id: 'stp-daily', title: 'Daily plant log', tables: ['stp_daily'] },
        { id: 'stp-lab', title: 'Laboratory readings', tables: ['stp_lab'] },
      ],
    },
    {
      id: 'administration', title: 'Administration',
      sections: [
        { id: 'activity', title: 'Recent entries', recent: true, adminOnly: true, tables: [] },
      ],
    },
  ];

  const SDSI = {
    tables, categories, overviews, publicView,
    lists: { HALLS, PLANTS, MATERIALS, FACILITIES },
    helpers: { num, add, fmt, tons, fyOfMonth, periodRange, inRange, isDated, formatDate, formatPeriod, monthOf,
      isoWeekOf, monthOfWeek, weekStart },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SDSI;
  else root.SDSI = SDSI;
})(typeof window !== 'undefined' ? window : globalThis);
