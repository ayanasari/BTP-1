/* The public page. Draws whatever /api/public returns and nothing else — it has no
   session, and the server sends only finished totals, so there is nothing here that
   could show a daily figure or a hall even by accident. */
(function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => Number(String(v).replace(/,/g, ''));
  const inr = (v, d = 2) => (v == null || !isFinite(v)) ? '—'
    : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });

  const SERIES = [
    { key: 'Horticulture', css: 'var(--c1)' },
    { key: 'Dry', css: 'var(--c2)' },
    { key: 'Wet', css: 'var(--c3)' },
  ];

  const table = (t, cls) => !t || !t.rows.length ? '' : `
    <div class="scroll"><table class="pub ${cls || ''}">
      <thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;

  // A stacked bar per financial year. Thin marks, a 2px surface gap between segments,
  // the top of each stack rounded, and the total written above the bar — so the figure
  // is readable without hovering and without a number on every segment.
  function chart(c) {
    if (!c.labels.length) return '';
    const W = 760, H = 300, padL = 54, padR = 16, padT = 26, padB = 40;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = Math.max(...c.totals, 1);
    // A round number above the tallest bar, so the gridlines read cleanly.
    const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
    const top = Math.ceil(max / step) * step || 1;
    const y = v => padT + plotH - (v / top) * plotH;
    const slot = plotW / c.labels.length;
    const bw = Math.min(74, slot * 0.54);

    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = top * f;
      return `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"
                stroke="var(--border)" stroke-width="1"/>
              <text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end"
                font-size="11" fill="var(--muted)">${inr(v, 0)}</text>`;
    }).join('');

    const bars = c.labels.map((label, i) => {
      const cx = padL + slot * i + slot / 2;
      const x = cx - bw / 2;
      let acc = 0;
      const segs = SERIES.map((s, si) => {
        const v = (c.stack[si] && c.stack[si].values[i]) || 0;
        if (v <= 0) return '';
        const yTop = y(acc + v), yBot = y(acc);
        acc += v;
        const h = Math.max(0, yBot - yTop - 2);   // 2px gap between segments
        const isTop = si === SERIES.length - 1 || !SERIES.slice(si + 1)
          .some((_, k) => (c.stack[si + 1 + k].values[i] || 0) > 0);
        return `<rect x="${x}" y="${yTop}" width="${bw}" height="${h}"
          rx="${isTop ? 4 : 0}" fill="${s.css}">
          <title>${esc(label)} · ${esc(s.key)}: ${inr(v)} tons</title></rect>`;
      }).join('');
      return `${segs}
        <text x="${cx}" y="${y(acc) - 8}" text-anchor="middle" font-size="12"
          font-weight="700" fill="var(--text)">${inr(acc, 1)}</text>
        <text x="${cx}" y="${H - 14}" text-anchor="middle" font-size="12"
          fill="var(--muted)">${esc(label)}</text>`;
    }).join('');

    return `
      <p class="legend">${SERIES.map(s =>
        `<span><i class="swatch" style="background:${s.css}"></i>${esc(s.key)} waste</span>`).join('')}</p>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
        aria-label="Solid waste by financial year, split into horticulture, dry and wet waste, in tons.">
        ${ticks}
        <text x="${padL - 8}" y="${padT - 10}" text-anchor="end" font-size="11" fill="var(--muted)">Tons</text>
        ${bars}
      </svg>`;
  }

  function render(d) {
    const main = document.getElementById('main');
    const y = d.latestYear;
    const recovered = y ? n(y.recycled) + n(y.processed) : null;
    const pct = y && n(y.total) ? (recovered / n(y.total)) * 100 : null;

    main.innerHTML = `
      <div class="tiles">
        <div class="tile"><div class="v">${y ? inr(n(y.total), 1) : '—'}</div>
          <div class="l">Total solid waste, tons</div><div class="s">${y ? esc(y.fy) : ''}</div></div>
        <div class="tile"><div class="v">${pct == null ? '—' : inr(pct, 0) + '%'}</div>
          <div class="l">Recycled or processed</div><div class="s">of that year's waste</div></div>
        <div class="tile"><div class="v">${inr(d.plants.capacity, 3)}</div>
          <div class="l">Treatment capacity, MLD</div><div class="s">${d.plants.rows.length} plants</div></div>
        <div class="tile"><div class="v">${y ? inr(n(y.ewaste), 0) : '—'}</div>
          <div class="l">Electronic waste, kg</div><div class="s">${y ? esc(y.fy) : ''}</div></div>
      </div>

      <h2>Solid waste</h2>
      <p class="lede">Waste generated on campus, by financial year. Horticulture waste is
        leaves and garden clearings, dry waste is what the blue bins collect, and wet waste
        is food waste from the halls of residence. The bars show all three added together;
        the <em>Total Solid Waste</em> column in the table below follows the institute's
        definition, which counts dry and wet waste and reports horticulture separately.</p>
      ${d.waste.rows.length ? `<div class="panel">${chart(d.chart)}</div>` : ''}
      <p class="lede" style="margin:16px 0 8px">All figures in tons, except electronic waste in kilograms.</p>
      ${d.waste.rows.length ? table(d.waste) : '<p class="lede">No figures recorded yet.</p>'}
      ${d.waste.note ? `<p class="lede" style="margin-top:8px">${esc(d.waste.note)}</p>` : ''}

      <h2>Sewage and effluent treatment</h2>
      <p class="lede">Treated water is reused on campus for horticulture and floor cleaning.</p>
      ${table(d.plants)}
      ${d.lab.rows.length ? `
        <h2>Treated water quality</h2>
        <p class="lede">${d.lab.published
          ? `As published by the institute for ${esc(d.lab.plant)}`
          : `Latest sample from ${esc(d.lab.plant || 'the plant')}${d.lab.sampled ? `, taken ${esc(d.lab.sampled)}` : ''}`
          }, against the limits set by the National Green Tribunal in 2018.</p>
        ${table(d.lab)}` : ''}

      <p class="foot">
        ${d.updated ? `Figures up to ${esc(d.updated)}. ` : ''}Entered by the hall messes and
        the sanitation, horticulture, biogas and sewage treatment sections, and added up
        automatically — no figure on this page is typed in by hand.
        <br><a href="/login.html">Staff sign in</a> to enter data.
      </p>`;
  }

  fetch('/api/public', { headers: { accept: 'application/json' } })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(render)
    .catch(() => {
      document.getElementById('main').innerHTML =
        '<p class="failed">The figures could not be loaded just now. Please try again shortly.</p>';
    });
})();
