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
  const monthOf = r => (r.period || '').slice(0, 7);
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
    return p;
  };
  const formatMonth = m => formatPeriod('month', m);

  // ---------- fixed lists ----------
  const HALLS = ['Azad Hall', 'Patel Hall', 'Nehru Hall', 'RK Hall'];
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
        // Only the halls this account can actually see, so a single mess gets a single column.
        const halls = HALLS.filter(h => rows.some(r => r.data.hall === h));
        const perHall = halls.length > 1;
        return {
          items: latest ? [
            { label: `Total, ${formatMonth(latest)}`, value: `${fmt(sumOf(byMonth[latest], 'food_kg'), 0)} kg` },
            { label: 'Days entered that month', value: new Set(byMonth[latest].map(r => r.period)).size },
          ] : [],
          table: {
            head: ['Month', 'Days entered', ...(perHall ? halls.map(h => `${h}, kg`) : []), 'Total, kg', 'Total, Tons'],
            rows: months.map(m => {
              const rs = byMonth[m];
              const total = sumOf(rs, 'food_kg');
              return [formatMonth(m), new Set(rs.map(r => r.period)).size,
                ...(perHall ? halls.map(h => fmt(sumOf(rs.filter(r => r.data.hall === h), 'food_kg'), 0)) : []),
                fmt(total, 0), fmt(tons(total), 3)];
            }),
          },
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
      period: 'date',
      periodLabel: 'Date',
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
      period: 'date',
      periodLabel: 'Date',
      fields: [
        { key: 'description', label: 'Items', type: 'text', required: true },
        { key: 'qty_kg', label: 'Quantity', unit: 'kg', type: 'number', required: true },
        { key: 'vendor', label: 'Authorised vendor', type: 'text' },
      ],
      summary(rows) {
        const byFy = groupBy(rows.filter(r => r.period), r => fyOfMonth(r.period.slice(0, 7)));
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
    tables, categories, overviews,
    lists: { HALLS, PLANTS, MATERIALS, FACILITIES },
    helpers: { num, add, fmt, tons, fyOfMonth, periodRange, inRange, isDated, formatDate, formatPeriod, monthOf },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SDSI;
  else root.SDSI = SDSI;
})(typeof window !== 'undefined' ? window : globalThis);
