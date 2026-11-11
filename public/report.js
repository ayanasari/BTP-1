// Builds the PDF report for one subsection over a chosen date range (jsPDF + AutoTable).
(function () {
  const { tables, helpers } = window.SDSI;
  const { fmt, formatDate, formatPeriod, inRange, isDated } = helpers;

  const BRAND = [20, 83, 45];
  const HEAD_BG = [227, 241, 232];
  const CALC_BG = [233, 244, 237];
  const FLAG_BG = [253, 236, 234];
  const MUTED = [93, 107, 99];
  const TEXT = [28, 38, 32];
  const LINE = [210, 220, 213];
  const PERIOD_LABEL = { month: 'Month', fy: 'Financial year', year: 'Year', date: 'Date' };

  // The built-in PDF fonts only cover Latin-1, so swap the few other symbols the labels use.
  const pdfText = s => String(s ?? '')
    .replace(/₂/g, '2').replace(/₹/g, 'Rs ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"').replace(/›/g, '>').replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '');

  function runTable(doc, opts) {
    if (typeof doc.autoTable === 'function') doc.autoTable(opts);
    else window.autoTable(doc, opts);
    return doc.lastAutoTable.finalY;
  }

  function makeCtx(rows) {
    const ctx = { rows };
    const cache = new Map();
    ctx.calc = r => {
      if (!cache.has(r)) { const t = tables[r.table]; cache.set(r, t.calc ? t.calc(r, ctx) : {}); }
      return cache.get(r);
    };
    return ctx;
  }

  function fieldValue(f, v) {
    if (v == null || v === '') return '-';
    if (f.type === 'number') return f.plain ? String(v) : fmt(v, 3);
    if (f.type === 'date') return formatDate(v);
    return String(v);
  }

  // Columns and rows for one table, plus which columns are calculated / numeric.
  function tableData(t, rows, ctx) {
    const head = [], calcIdx = new Set(), numIdx = new Set();
    const push = (label, unit, opts = {}) => {
      if (opts.calc) calcIdx.add(head.length);
      if (opts.num) numIdx.add(head.length);
      head.push(pdfText(unit ? `${label}\n(${unit})` : label));
    };
    if (t.serial) push(t.serial, null, { num: true });
    if (t.period) push(t.periodLabel || PERIOD_LABEL[t.period]);
    t.fields.forEach(f => push(f.label, f.unit, { num: f.type === 'number' }));
    (t.calcCols || []).forEach(c => push(c.label, c.unit, { calc: true, num: !c.text }));
    if (!isDated(t)) push('Last updated');

    const flagged = [];
    const body = rows.map((r, i) => {
      const c = ctx.calc(r);
      flagged.push(!!c._flag);
      const cells = [];
      if (t.serial) cells.push(String(i + 1));
      if (t.period) cells.push(formatPeriod(t.period, r.period));
      t.fields.forEach(f => cells.push(fieldValue(f, r.data[f.key])));
      (t.calcCols || []).forEach(cc => cells.push(cc.text ? String(c[cc.key] ?? '-') : fmt(c[cc.key], cc.digits ?? 2)));
      if (!isDated(t)) cells.push(formatDate(r.updated_at));
      return cells.map(pdfText);
    });
    return { head, body, calcIdx, numIdx, flagged };
  }

  function build({ cat, section, tableId, rows, from, to, rangeLabel }) {
    const table = tables[tableId];
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 12;
    const ctx = makeCtx(rows);
    const now = new Date();
    const generated = `${formatDate(now.toISOString())}, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    // Title band
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(pdfText(table.title), M, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(pdfText(`IIT Kharagpur - Sustainability (SDSI) - ${cat.title} > ${section.title}`), M, 18);

    doc.setTextColor(...TEXT);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Report period:', M, 32);
    const labelWidth = doc.getTextWidth('Report period:') + 2;
    doc.setFont('helvetica', 'normal');
    doc.text(pdfText(rangeLabel), M + labelWidth, 32);
    doc.setTextColor(...MUTED);
    doc.setFontSize(8.5);
    doc.text(`Generated: ${pdfText(generated)}`, W - M, 32, { align: 'right' });
    doc.text('Shaded columns are calculated automatically. Red rows need attention.', M, 37);
    let y = 44;

    [tableId].forEach(id => {
      const t = tables[id];
      const all = rows[id] || [];
      const selected = all.filter(r => inRange(t, r, from, to));
      if (t.dateField) selected.sort((a, b) => String(b.data[t.dateField] || '').localeCompare(String(a.data[t.dateField] || '')));

      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const plural = n => `${n} entr${n === 1 ? 'y' : 'ies'}`;
      const scope = !isDated(t)
        ? `Current list, not filtered by date: ${plural(all.length)}`
        : from ? `${selected.length} of ${plural(all.length)} fall in this period` : plural(all.length);
      doc.text(pdfText(t.note ? `${scope}. ${t.note}` : scope), M, y);
      y += 3;

      if (!selected.length) {
        doc.setTextColor(...TEXT);
        doc.setFontSize(9.5);
        doc.text('No entries in this period.', M, y + 5);
        y += 16;
        return;
      }

      const { head, body, calcIdx, numIdx, flagged } = tableData(t, selected, ctx);
      const columnStyles = {};
      numIdx.forEach(i => { columnStyles[i] = { halign: 'right' }; });
      y = runTable(doc, {
        startY: y,
        head: [head],
        body,
        theme: 'grid',
        margin: { left: M, right: M, top: 14, bottom: 14 },
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak', textColor: TEXT, lineColor: LINE, lineWidth: 0.1, valign: 'top' },
        headStyles: { fillColor: HEAD_BG, textColor: BRAND, fontStyle: 'bold', valign: 'bottom' },
        columnStyles,
        didParseCell(d) {
          if (d.section === 'head' && numIdx.has(d.column.index)) d.cell.styles.halign = 'right';
          if (d.section !== 'body') return;
          if (calcIdx.has(d.column.index)) d.cell.styles.fillColor = CALC_BG;
          if (flagged[d.row.index]) d.cell.styles.fillColor = FLAG_BG;
        },
      });

      const s = t.summary ? t.summary(selected, ctx) : null;
      // One `table` or several in `tables` — a summary may return either.
      const grids = s ? (s.tables || (s.table ? [s.table] : [])).filter(g => g?.rows?.length) : [];
      if (s && (s.items?.length || grids.length)) {
        y += 4;
        if (y > H - 30) { doc.addPage(); y = 16; }
        doc.setTextColor(...TEXT);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('Summary', M, y);
        y += 1.5;
        if (s.items?.length) {
          y = runTable(doc, {
            startY: y,
            body: s.items.map(it => [pdfText(it.label), pdfText(it.value)]),
            theme: 'plain',
            tableWidth: 'wrap',
            margin: { left: M, right: M, top: 14, bottom: 14 },
            styles: { fontSize: 8.5, cellPadding: { top: 1, bottom: 1, left: 0, right: 8 }, textColor: TEXT },
            columnStyles: { 0: { cellWidth: 'wrap' }, 1: { cellWidth: 'wrap', fontStyle: 'bold', textColor: BRAND } },
            didParseCell(d) { if (s.items[d.row.index]?.flag && d.column.index === 1) d.cell.styles.textColor = [180, 35, 24]; },
          });
        }
        grids.forEach(g => {
          y += 2;
          if (g.caption) {
            if (y > H - 30) { doc.addPage(); y = 16; }
            doc.setTextColor(...TEXT);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(pdfText(g.caption), M, y + 3);
            y += 4;
          }
          y = runTable(doc, {
            startY: y,
            head: [g.head.map(pdfText)],
            body: g.rows.map(r => r.map(pdfText)),
            theme: 'grid',
            tableWidth: 'wrap',
            margin: { left: M, right: M, top: 14, bottom: 14 },
            styles: { fontSize: 8, cellPadding: 1.4, textColor: TEXT, lineColor: LINE, lineWidth: 0.1 },
            headStyles: { fillColor: HEAD_BG, textColor: BRAND, fontStyle: 'bold' },
          });
        });
      }
      y += 10;
    });

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE);
      doc.line(M, H - 9, W - M, H - 9);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(pdfText(`SDSI Data Entry - ${table.title} - ${rangeLabel}`), M, H - 5);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 5, { align: 'right' });
    }

    const stamp = d => (d || '').replace(/-/g, '');
    const name = from ? `SDSI_${tableId}_${stamp(from)}-${stamp(to)}.pdf` : `SDSI_${tableId}_all.pdf`;
    doc.save(name);
    return name;
  }

  // The monthly summary as a PDF: the published columns, and the same figures by
  // financial year. Nothing here is typed in, so there is no date range to choose —
  // it is everything that has been entered.
  function buildOverview({ cat, section, overview }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 12;
    const now = new Date();
    const generated = `${formatDate(now.toISOString())}, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    doc.setFillColor(...BRAND);
    doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(pdfText(overview.title), M, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(pdfText(`IIT Kharagpur - Sustainability (SDSI) - ${cat.title} > ${section.title}`), M, 18);

    doc.setTextColor(...MUTED);
    doc.setFontSize(8.5);
    doc.text(`Generated: ${pdfText(generated)}`, W - M, 32, { align: 'right' });
    doc.setTextColor(...TEXT);
    doc.setFontSize(9);
    doc.text(pdfText(overview.intro), M, 32);
    let y = 40;

    const grid = (head, rows) => runTable(doc, {
      startY: y,
      head: [head.map(pdfText)],
      body: rows.map(r => r.map(v => pdfText(String(v)))),
      theme: 'grid',
      margin: { left: M, right: M, top: 14, bottom: 14 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, overflow: 'linebreak', textColor: TEXT, lineColor: LINE, lineWidth: 0.1, valign: 'top' },
      headStyles: { fillColor: HEAD_BG, textColor: BRAND, fontStyle: 'bold', valign: 'bottom' },
      columnStyles: head.reduce((m, _, i) => (i ? (m[i] = { halign: 'right' }) : null, m), {}),
      didParseCell(d) { if (d.section === 'head' && d.column.index) d.cell.styles.halign = 'right'; },
    });

    if (overview.rows.length) {
      y = grid(overview.head, overview.rows);
    } else {
      doc.setFontSize(9.5);
      doc.text('No entries yet, so there is nothing to add up.', M, y + 5);
      y += 16;
    }

    if (overview.extra && overview.extra.rows.length) {
      y += 8;
      if (y > H - 40) { doc.addPage(); y = 16; }
      doc.setTextColor(...TEXT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(pdfText(overview.extra.title), M, y);
      y += 2;
      y = grid(overview.extra.head, overview.extra.rows);
    }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE);
      doc.line(M, H - 9, W - M, H - 9);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(pdfText(`SDSI Data Entry - ${overview.title} - added up from the daily entries`), M, H - 5);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 5, { align: 'right' });
    }

    const name = `SDSI_${section.id.replace(/-/g, '_')}.pdf`;
    doc.save(name);
    return name;
  }

  window.SDSIReport = { build, buildOverview };
})();
