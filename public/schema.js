// Categories, subsections, tables and columns for the SDSI data-entry portal.
// Columns follow the tables published on https://www.iitkgp.ac.in/navpage/sdsi.
// Loaded by the browser (window.SDSI) and by the server (require).
(function (root) {
  // ---------- helpers ----------
  const num = v => (v === '' || v == null || !isFinite(+v)) ? null : +v;
  const add = (...vals) => vals.every(v => v == null) ? null : vals.reduce((s, v) => s + (v || 0), 0);
  const pct = (part, whole) => (part == null || !whole) ? null : part / whole * 100;
  const groupBy = (rows, keyFn) => rows.reduce((m, r) => { const k = keyFn(r); (m[k] = m[k] || []).push(r); return m; }, {});
  const sumOf = (rows, key) => add(...rows.map(r => num(r.data[key])));
  const fmt = (v, digits = 2) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits });
  // '2025-04' -> '2025-26' (financial year runs April to March)
  const fyOfMonth = m => {
    const [y, mo] = m.split('-').map(Number);
    const start = mo >= 4 ? y : y - 1;
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  };
  const byKeyDesc = obj => Object.keys(obj).sort().reverse();
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
  // Does an entry fall inside [from, to]? A month / year / financial year counts toward the range
  // it starts in, so "last 2 years" gives two years rather than every year it touches; the period
  // still running on the end date is always included. Tables with no date are standing lists.
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
  const firstNumbers = s => (String(s || '').match(/\d+(\.\d+)?/g) || []).map(Number);

  const LEVELS = ['PG', 'RS', 'UG'];

  // ---------- tables ----------
  const tables = {
    // ===== Solid waste =====
    solid_waste: {
      title: 'Waste generated',
      period: 'month',
      unique: ['period'],
      fields: [
        { key: 'horticulture_t', label: 'Horticulture Waste', unit: 'Tons', type: 'number' },
        { key: 'dry_t', label: 'Dry Waste', unit: 'Tons', type: 'number' },
        { key: 'wet_t', label: 'Wet Waste', unit: 'Tons', type: 'number' },
        { key: 'dry_recycled_t', label: 'Dry Waste Recycled', unit: 'Tons', type: 'number' },
        { key: 'bio_processed_t', label: 'Bio/Food Waste Processed', unit: 'Tons', type: 'number' },
        { key: 'ewaste_kg', label: 'Electronic Waste', unit: 'Kg', type: 'number' },
        { key: 'wet_kgday', label: 'Wet Waste', unit: 'kg/day', type: 'number' },
        { key: 'leaves_kgday', label: 'Dry leaves', unit: 'kg/day', type: 'number' },
        { key: 'cartons_kgmonth', label: 'Cartons', unit: 'kg/month', type: 'number' },
        { key: 'iron_kgmonth', label: 'Iron scrap', unit: 'kg/month', type: 'number' },
        { key: 'plastics_kgmonth', label: 'Plastics', unit: 'kg/month', type: 'number' },
      ],
      calcCols: [
        { key: 'total_t', label: 'Total Solid Waste', unit: 'Tons' },
        { key: 'recycled_kgday', label: 'Total recycled and reused waste', unit: 'kg/day', digits: 0 },
        { key: 'recycled_kgyear', label: 'Total recycled and reused waste', unit: 'kg/year', digits: 0 },
      ],
      calc(r) {
        const d = r.data;
        const monthly = add(num(d.cartons_kgmonth), num(d.iron_kgmonth), num(d.plastics_kgmonth));
        const perDay = add(num(d.wet_kgday), num(d.leaves_kgday), monthly == null ? null : monthly / 30);
        return {
          total_t: add(num(d.horticulture_t), num(d.dry_t), num(d.wet_t)),
          recycled_kgday: perDay,
          recycled_kgyear: perDay == null ? null : perDay * 360,
        };
      },
      summary(rows, ctx) {
        const byFy = groupBy(rows.filter(r => r.period), r => fyOfMonth(r.period));
        const fys = byKeyDesc(byFy);
        const totalFor = fy => add(...byFy[fy].map(r => ctx.calc(r).total_t));
        const items = [];
        if (fys.length) {
          items.push({ label: `Total Solid Waste, FY ${fys[0]} so far`, value: `${fmt(totalFor(fys[0]))} Tons` });
          if (fys[1]) {
            const cur = totalFor(fys[0]), prev = totalFor(fys[1]);
            items.push({ label: `FY ${fys[1]}`, value: `${fmt(prev)} Tons` });
            items.push({ label: 'Change vs previous FY', value: prev ? `${fmt((cur - prev) / prev * 100, 1)} %` : '—' });
          }
        }
        return {
          items,
          table: {
            head: ['Financial year', 'Months entered', 'Total Solid Waste, Tons', 'Horticulture, Tons', 'Dry, Tons', 'Wet, Tons',
                   'Dry Recycled, Tons', 'Bio/Food Processed, Tons', 'E-waste, Kg', 'Avg recycled & reused, kg/day'],
            rows: fys.map(fy => {
              const rs = byFy[fy];
              const perDay = rs.map(r => ctx.calc(r).recycled_kgday).filter(v => v != null);
              return [fy, rs.length, fmt(totalFor(fy)), fmt(sumOf(rs, 'horticulture_t')), fmt(sumOf(rs, 'dry_t')), fmt(sumOf(rs, 'wet_t')),
                fmt(sumOf(rs, 'dry_recycled_t')), fmt(sumOf(rs, 'bio_processed_t')), fmt(sumOf(rs, 'ewaste_kg'), 0),
                perDay.length ? fmt(perDay.reduce((a, b) => a + b, 0) / perDay.length, 0) : '—'];
            }),
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

    stp_data: {
      title: 'Sewage Treatment Plant data',
      period: 'month',
      unique: ['period'],
      fields: [
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
        const d = r.data, L = tables.stp_data.limits;
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
        return { items: [
          { label: 'Months entered', value: dated.length },
          { label: 'Months exceeding a limit', value: failing.length, flag: failing.length > 0 },
          { label: 'Latest month', value: dated[0] ? `${formatPeriod('month', dated[0].period)}: ${ctx.calc(dated[0]).within}` : '—' },
        ] };
      },
    },

    // ===== Energy =====
    solar: {
      title: 'Solar PV Installations',
      period: null,
      unique: ['category'],
      fields: [
        { key: 'category', label: 'Category', type: 'select', required: true,
          options: ['Academic Buildings', 'Hospital', 'Car Parking', 'Cycle Parking', 'Student Dormitories', 'Industrial Shed', 'Recreational Area'] },
        { key: 'capacity_kwp', label: 'Capacity', unit: 'kWp', type: 'number', required: true },
      ],
      calcCols: [{ key: 'share', label: 'Share of total', unit: '%', digits: 1 }],
      calc(r, ctx) {
        return { share: pct(num(r.data.capacity_kwp), sumOf(ctx.rows.solar || [], 'capacity_kwp')) };
      },
      summary(rows) {
        return { items: [{ label: 'Total Capacity', value: `${fmt(sumOf(rows, 'capacity_kwp'), 0)} kWp` }] };
      },
    },

    // ===== Emissions =====
    plantation: {
      title: 'Tree plantation',
      period: 'year',
      serial: 'Sl. No.',
      fields: [
        { key: 'details', label: 'Plantation Details', type: 'text', required: true },
        { key: 'plants', label: 'No. of Plants', type: 'number', required: true },
      ],
      summary(rows) {
        const byYear = groupBy(rows, r => r.period || '—');
        return {
          items: [{ label: 'Total trees planted', value: fmt(sumOf(rows, 'plants'), 0) }],
          table: { head: ['Year', 'Drives', 'No. of Plants'], rows: byKeyDesc(byYear).map(y => [y, byYear[y].length, fmt(sumOf(byYear[y], 'plants'), 0)]) },
        };
      },
    },

    vehicles: {
      title: 'CO₂ emissions from vehicles on campus',
      period: 'fy',
      unique: ['period', 'vehicle_type'],
      fields: [
        { key: 'vehicle_type', label: 'Vehicle type', type: 'select', required: true,
          options: ['Cars (Gasoline)', 'Cars (Diesel)', 'Two wheelers', 'Buses', 'Food Truck', 'Ambulances'] },
        { key: 'number_registered', label: 'Number registered in institute', type: 'number' },
        { key: 'km_per_day', label: 'Average distance travelled per day', unit: 'km', type: 'number' },
        { key: 'days_per_week', label: 'Number of days vehicle runs per week', type: 'number' },
        { key: 'km_per_year', label: 'Average distance travelled', unit: 'km/y', type: 'number', required: true },
        { key: 'fuel_used', label: 'Fuel Used', type: 'select', options: ['Gasoline', 'Diesel'], required: true },
        { key: 'km_per_l', label: 'Fuel consumption', unit: 'km/L', type: 'number', required: true },
        { key: 'co2_factor', label: 'CO₂ emission factor', unit: 'kg CO₂/L fuel consumed', type: 'number', required: true },
      ],
      autofill(d) {
        return { co2_factor: d.fuel_used === 'Diesel' ? 2.635 : d.fuel_used === 'Gasoline' ? 2.28 : null };
      },
      calcCols: [
        { key: 'fuel_l_y', label: 'Average fuel consumption per year', unit: 'L/y', digits: 0 },
        { key: 'co2_kg_y', label: 'Total CO₂ emissions', unit: 'kg CO₂/y', digits: 0 },
      ],
      calc(r) {
        const d = r.data, km = num(d.km_per_year), kmpl = num(d.km_per_l), f = num(d.co2_factor);
        const litres = (km == null || !kmpl) ? null : km / kmpl;
        return { fuel_l_y: litres, co2_kg_y: (litres == null || f == null) ? null : litres * f };
      },
      summary(rows, ctx) {
        const byFy = groupBy(rows, r => r.period || '—');
        return { table: {
          head: ['Financial year', 'Vehicle types', 'Total Vehicular CO₂ emissions, tCO₂/y'],
          rows: byKeyDesc(byFy).map(fy => [fy, byFy[fy].length, fmt(add(...byFy[fy].map(r => ctx.calc(r).co2_kg_y)) / 1000, 0)]),
        } };
      },
    },

    lpg: {
      title: 'CO₂ emissions from LPG cooking on campus',
      period: 'fy',
      unique: ['period', 'used_in'],
      fields: [
        { key: 'used_in', label: 'Halls / Households', type: 'select', options: ['Halls', 'Households'], required: true },
        { key: 'cylinders_y', label: 'Number of cylinders/y', type: 'number', required: true },
        { key: 'kg_per_cylinder', label: 'Weight of gas', unit: 'kg/cylinder', type: 'number', required: true },
        { key: 'co2_factor', label: 'CO₂ emission factor', unit: 'kg CO₂/kg fuel consumed', type: 'number', required: true },
      ],
      autofill(d) {
        return {
          kg_per_cylinder: d.used_in === 'Halls' ? 19 : d.used_in === 'Households' ? 14.1 : null,
          co2_factor: 2.993,
        };
      },
      calcCols: [
        { key: 'gas_kg_y', label: 'Weight of gas', unit: 'kg/y', digits: 0 },
        { key: 'co2_kg_y', label: 'Total CO₂ emissions', unit: 'kg/y', digits: 0 },
      ],
      calc(r) {
        const d = r.data, c = num(d.cylinders_y), w = num(d.kg_per_cylinder), f = num(d.co2_factor);
        const kg = (c == null || w == null) ? null : c * w;
        return { gas_kg_y: kg, co2_kg_y: (kg == null || f == null) ? null : kg * f };
      },
      summary(rows, ctx) {
        const byFy = groupBy(rows, r => r.period || '—');
        const t = (rs, who) => add(...rs.filter(r => !who || r.data.used_in === who).map(r => ctx.calc(r).co2_kg_y));
        return { table: {
          head: ['Financial year', 'Halls, tCO₂/y', 'Households, tCO₂/y', 'Total CO₂ from LPG cooking, tCO₂/y'],
          rows: byKeyDesc(byFy).map(fy => {
            const rs = byFy[fy], h = t(rs, 'Halls'), hh = t(rs, 'Households'), all = t(rs);
            return [fy, fmt(h == null ? null : h / 1000, 0), fmt(hh == null ? null : hh / 1000, 0), fmt(all == null ? null : all / 1000, 0)];
          }),
        } };
      },
    },

    green: {
      title: 'Carbon uptake by green areas',
      period: 'fy',
      unique: ['period'],
      fields: [
        { key: 'campus_acres', label: 'Total Campus Area', unit: 'Acres', type: 'number', required: true },
        { key: 'green_acres', label: 'Total Green Area', unit: 'Acres', type: 'number', required: true },
        { key: 'uptake_factor', label: 'Carbon uptake', unit: 'tCO₂/acre-y', type: 'number', required: true },
      ],
      autofill() { return { uptake_factor: 1.7 }; },
      calcCols: [
        { key: 'green_pct', label: 'Green area', unit: '%', digits: 0 },
        { key: 'uptake_t', label: 'Total carbon uptake', unit: 'tCO₂/y', digits: 0 },
        { key: 'scope1_t', label: 'Scope 1 emissions', unit: 'tCO₂/y', digits: 0 },
        { key: 'excess_t', label: 'Excess carbon emissions', unit: 'tCO₂/y', digits: 0 },
      ],
      calc(r, ctx) {
        const d = r.data;
        const uptake = (num(d.green_acres) == null || num(d.uptake_factor) == null) ? null : num(d.green_acres) * num(d.uptake_factor);
        const sameFy = id => (ctx.rows[id] || []).filter(x => x.period === r.period);
        const v = sameFy('vehicles'), l = sameFy('lpg');
        const scope1Kg = (v.length || l.length)
          ? add(...v.map(x => tables.vehicles.calc(x).co2_kg_y), ...l.map(x => tables.lpg.calc(x).co2_kg_y)) : null;
        const scope1 = scope1Kg == null ? null : scope1Kg / 1000;
        return {
          green_pct: pct(num(d.green_acres), num(d.campus_acres)),
          uptake_t: uptake,
          scope1_t: scope1,
          excess_t: (scope1 == null || uptake == null) ? null : scope1 - uptake,
        };
      },
      summary(rows, ctx) {
        const latest = rows.filter(r => r.period).sort((a, b) => b.period.localeCompare(a.period))[0];
        if (!latest) return null;
        const c = ctx.calc(latest);
        return { items: [
          { label: `Scope 1 emissions, ${latest.period}`, value: `${fmt(c.scope1_t, 0)} tCO₂/y` },
          { label: `Carbon uptake, ${latest.period}`, value: `${fmt(c.uptake_t, 0)} tCO₂/y` },
          { label: `Excess carbon emissions, ${latest.period}`, value: `${fmt(c.excess_t, 0)} tCO₂/y`, flag: c.excess_t > 0 },
        ] };
      },
    },

    // ===== Environmental education =====
    programmes: {
      title: 'Degree programmes',
      period: null,
      serial: 'Serial No.',
      fields: [
        { key: 'degree', label: 'Degree offered', type: 'text', required: true },
        { key: 'program', label: 'Program name', type: 'text', required: true },
        { key: 'department', label: 'Department/Centre/School offering the degree', type: 'text', required: true },
      ],
      summary(rows) {
        const byDept = groupBy(rows, r => r.data.department || '—');
        return {
          items: [{ label: 'Number of programmes', value: rows.length }],
          table: { head: ['Department/Centre/School', 'Programmes'],
            rows: Object.keys(byDept).sort((a, b) => byDept[b].length - byDept[a].length).map(k => [k, byDept[k].length]) },
        };
      },
    },

    cep_events: {
      title: 'Sustainability events and courses',
      period: null,
      dateField: 'start_date',
      endDateField: 'end_date',
      serial: 'Sl. No.',
      fields: [
        { key: 'course_id', label: 'Course ID', type: 'text', required: true },
        { key: 'course_title', label: 'Course Title', type: 'text', required: true },
        { key: 'start_date', label: 'Course Duration, from', type: 'date', required: true },
        { key: 'end_date', label: 'Course Duration, to', type: 'date', required: true },
        { key: 'outline', label: 'Brief Course Outline', type: 'textarea' },
      ],
      calcCols: [{ key: 'days', label: 'Duration', unit: 'days', digits: 0 }],
      calc(r) {
        const s = Date.parse(r.data.start_date), e = Date.parse(r.data.end_date);
        return { days: (isNaN(s) || isNaN(e)) ? null : Math.round((e - s) / 864e5) + 1 };
      },
      summary(rows, ctx) {
        const byYear = groupBy(rows, r => (r.data.start_date || '—').slice(0, 4));
        return {
          items: [
            { label: 'Events and courses', value: rows.length },
            { label: 'Total days', value: fmt(add(...rows.map(r => ctx.calc(r).days)), 0) },
          ],
          table: { head: ['Year', 'Events and courses', 'Days'],
            rows: byKeyDesc(byYear).map(y => [y, byYear[y].length, fmt(add(...byYear[y].map(r => ctx.calc(r).days)), 0)]) },
        };
      },
    },

    // ===== Environmental research =====
    research_centres: {
      title: 'Research centres with a focus on environmental sustainability',
      period: null,
      serial: 'S. No.',
      fields: [
        { key: 'department', label: 'Department', type: 'text', required: true },
        { key: 'year_est', label: 'Year of establishment', type: 'number', plain: true },
        { key: 'faculty', label: 'Full-time/affiliated faculty', type: 'text' },
        { key: 'staff', label: 'Full-time staff', type: 'number' },
        { key: 'phd', label: 'PhD students', type: 'number' },
        { key: 'masters', label: 'Masters students', type: 'number' },
        { key: 'bachelors', label: 'Bachelors students', type: 'number' },
        { key: 'domain', label: 'Domain areas', type: 'textarea' },
        { key: 'website', label: 'Link to website', type: 'url' },
      ],
      calcCols: [
        { key: 'students', label: 'Total students', digits: 0 },
        { key: 'per_faculty', label: 'Students per faculty', digits: 1 },
      ],
      calc(r) {
        const d = r.data;
        const students = add(num(d.phd), num(d.masters), num(d.bachelors));
        const faculty = firstNumbers(d.faculty).reduce((a, b) => a + b, 0);
        return { students, per_faculty: (students == null || !faculty) ? null : students / faculty };
      },
      summary(rows, ctx) {
        const faculty = rows.reduce((s, r) => s + firstNumbers(r.data.faculty).reduce((a, b) => a + b, 0), 0);
        return { items: [
          { label: 'Centres', value: rows.length },
          { label: 'Faculty', value: fmt(faculty, 0) },
          { label: 'Full-time staff', value: fmt(sumOf(rows, 'staff'), 0) },
          { label: 'PhD students', value: fmt(sumOf(rows, 'phd'), 0) },
          { label: 'Masters students', value: fmt(sumOf(rows, 'masters'), 0) },
          { label: 'Bachelors students', value: fmt(sumOf(rows, 'bachelors'), 0) },
          { label: 'Total students', value: fmt(add(...rows.map(r => ctx.calc(r).students)), 0) },
        ] };
      },
    },

    // ===== Equality and diversity =====
    reservation: {
      title: 'Reservation policy and tuition waiver',
      period: null,
      fields: [
        { key: 'category', label: 'Undergraduate', type: 'text', required: true },
        { key: 'reservation_pct', label: 'Government of India reservation policy', unit: '%', type: 'number' },
        { key: 'tuition_waiver', label: 'Tuition waiver', unit: '%', type: 'text' },
      ],
    },

    scholarships: {
      title: 'Scholarships and fellowships',
      period: 'date',
      periodLabel: 'As of',
      unique: ['period', 'description'],
      fields: [
        { key: 'description', label: 'Description', type: 'text', required: true },
        { key: 'student_category', label: 'Student category', type: 'text' },
        { key: 'students', label: 'Number of students', type: 'number', required: true },
        { key: 'amount', label: 'Amount of fellowship', unit: '₹/month', type: 'text' },
      ],
      summary(rows) {
        const byDate = groupBy(rows, r => r.period || '—');
        const dates = byKeyDesc(byDate);
        const schemes = [...new Set(rows.map(r => r.data.description))];
        return { table: {
          head: ['Description', ...dates.map(d => `As of ${d}`)],
          rows: [
            ...schemes.map(s => [s, ...dates.map(d => { const r = byDate[d].find(x => x.data.description === s); return r ? fmt(num(r.data.students), 0) : '—'; })]),
            ['Total', ...dates.map(d => fmt(sumOf(byDate[d], 'students'), 0))],
          ],
        } };
      },
    },

    students_apr: {
      title: 'Students by category and level',
      period: 'date',
      periodLabel: 'As on',
      unique: ['period', 'level'],
      fields: [
        { key: 'level', label: 'Level', type: 'select', options: LEVELS, required: true },
        { key: 'st', label: 'ST', unit: '%', type: 'number' },
        { key: 'sc', label: 'SC', unit: '%', type: 'number' },
        { key: 'ob', label: 'OB', unit: '%', type: 'number' },
        { key: 'ge', label: 'GE', unit: '%', type: 'number' },
        { key: 'fn', label: 'FN', unit: '%', type: 'number' },
        { key: 'ews', label: 'EWS', unit: '%', type: 'number' },
      ],
      calcCols: [{ key: 'total', label: 'Total', unit: '%' }],
      calc(r) { const d = r.data; return { total: add(num(d.st), num(d.sc), num(d.ob), num(d.ge), num(d.fn), num(d.ews)) }; },
      summary(rows, ctx) {
        const byDate = groupBy(rows, r => r.period || '—');
        return { table: { head: ['As on', 'Levels entered', 'Total of all levels, %'],
          rows: byKeyDesc(byDate).map(d => [d, byDate[d].length, fmt(add(...byDate[d].map(r => ctx.calc(r).total)))]) } };
      },
    },

    students_category: {
      title: 'Students by category, within each level',
      period: 'date',
      periodLabel: 'As on',
      unique: ['period', 'level'],
      fields: [
        { key: 'level', label: 'Level', type: 'select', options: LEVELS, required: true },
        { key: 'general', label: '% General', unit: '%', type: 'number' },
        { key: 'obc', label: '% OBC', unit: '%', type: 'number' },
        { key: 'sc', label: '% SC', unit: '%', type: 'number' },
        { key: 'st', label: '% ST', unit: '%', type: 'number' },
        { key: 'ews', label: '% EWS', unit: '%', type: 'number' },
        { key: 'fn', label: '% FN', unit: '%', type: 'number' },
        { key: 'pd', label: '% PD', unit: '%', type: 'number' },
      ],
      calcCols: [{ key: 'total', label: 'Total', unit: '%' }],
      calc(r) {
        const d = r.data;
        const total = add(num(d.general), num(d.obc), num(d.sc), num(d.st), num(d.ews), num(d.fn), num(d.pd));
        return { total, _flag: total != null && Math.abs(total - 100) > 2 };
      },
    },

    students_gender: {
      title: 'Students by gender',
      period: 'date',
      periodLabel: 'As on',
      unique: ['period', 'level'],
      fields: [
        { key: 'level', label: 'Level', type: 'select', options: LEVELS, required: true },
        { key: 'f', label: 'F', unit: '%', type: 'number' },
        { key: 'm', label: 'M', unit: '%', type: 'number' },
      ],
      calcCols: [{ key: 'total', label: 'Total', unit: '%' }, { key: 'f_share', label: 'Female share within level', unit: '%', digits: 1 }],
      calc(r) { const f = num(r.data.f), m = num(r.data.m); return { total: add(f, m), f_share: pct(f, add(f, m)) }; },
      summary(rows) {
        const f = sumOf(rows, 'f'), m = sumOf(rows, 'm');
        return { items: [{ label: 'Female share of all students', value: `${fmt(pct(f, add(f, m)), 1)} %` }] };
      },
    },

    staff_gender: {
      title: 'Faculty and non-faculty by gender',
      period: 'date',
      periodLabel: 'As on',
      unique: ['period', 'group'],
      fields: [
        { key: 'group', label: 'Group', type: 'select', options: ['Faculty', 'Non faculty'], required: true },
        { key: 'f', label: 'F', unit: '%', type: 'number' },
        { key: 'm', label: 'M', unit: '%', type: 'number' },
      ],
      calcCols: [{ key: 'total', label: 'Total', unit: '%' }, { key: 'f_share', label: 'Female share within group', unit: '%', digits: 1 }],
      calc(r) { const f = num(r.data.f), m = num(r.data.m); return { total: add(f, m), f_share: pct(f, add(f, m)) }; },
    },

    // ===== Inclusivity =====
    disability_projects: {
      title: 'Sponsored research projects on disabilities studies',
      period: null,
      fields: [
        { key: 'title', label: 'Title', type: 'textarea', required: true },
        { key: 'department', label: 'Department', type: 'text', required: true },
        { key: 'duration', label: 'Project Duration', type: 'text' },
        { key: 'pi', label: 'Principal Investigator(s)', type: 'text' },
      ],
      summary(rows) {
        const year = new Date().getFullYear();
        const endYear = s => { const m = String(s || '').match(/^(\d{4})\s*[-–]\s*(\d{2,4})$/); if (!m) return null; return m[2].length === 2 ? +(m[1].slice(0, 2) + m[2]) : +m[2]; };
        const ongoing = rows.filter(r => endYear(r.data.duration) >= year).length;
        const byDept = groupBy(rows, r => r.data.department || '—');
        return {
          items: [{ label: 'Projects', value: rows.length }, { label: `Running in ${year}`, value: ongoing }],
          table: { head: ['Department', 'Projects'],
            rows: Object.keys(byDept).sort((a, b) => byDept[b].length - byDept[a].length).map(k => [k, byDept[k].length]) },
        };
      },
    },
  };

  // ---------- navigation: major categories > subsections > tables ----------
  const categories = [
    {
      id: 'environmental', title: 'Environmental Sustainability',
      sections: [
        { id: 'solid-waste', title: 'Solid Waste Management', tables: ['solid_waste'] },
        { id: 'sewage', title: 'Sewage Treatment', tables: ['stp_plants', 'stp_data'] },
        { id: 'energy', title: 'Energy Conservation and Renewable Energy', tables: ['solar'] },
        { id: 'emissions', title: 'Emissions Control', tables: ['plantation', 'vehicles', 'lpg', 'green'] },
        { id: 'education', title: 'Environmental Education', tables: ['programmes', 'cep_events'] },
        { id: 'research', title: 'Environmental Research', tables: ['research_centres'] },
      ],
    },
    {
      id: 'social', title: 'Social Responsibility',
      sections: [
        { id: 'equality', title: 'Equality and Diversity',
          tables: ['reservation', 'scholarships', 'students_apr', 'students_category', 'students_gender', 'staff_gender'] },
        { id: 'inclusivity', title: 'Inclusivity', tables: ['disability_projects'] },
      ],
    },
  ];

  const SDSI = { tables, categories, helpers: { num, add, fmt, fyOfMonth, periodRange, inRange, isDated, formatDate, formatPeriod } };
  if (typeof module !== 'undefined' && module.exports) module.exports = SDSI;
  else root.SDSI = SDSI;
})(typeof window !== 'undefined' ? window : globalThis);
