/* The public page. It draws whatever /api/public returns and nothing else: it has no
   session, and the server sends only finished totals, so there is nothing here that
   could show a daily figure, a hall or an account even by accident. */
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

  // Tonnes once there are tonnes to show, kilograms before that. A year that has only
  // just started can hold a few kilos, and rounding five kilograms to "0 tons" reads as
  // "nothing has been recorded" when something has. Returns the number and its unit.
  function mass(tons) {
    const t = n(tons);
    if (!isFinite(t) || t === 0) return ['—', 'tons'];
    if (t < 1) return [inr(t * 1000, 0), 'kg'];
    const shown = inr(t, t < 10 ? 1 : 0);
    return [shown, shown === '1' ? 'ton' : 'tons'];
  }

  const paras = text => String(text || '').split(/\n{2,}/)
    .filter(s => s.trim()).map(s => `<p>${esc(s.trim())}</p>`).join('');

  const grid = (t, caption) => !t || !t.rows.length ? '' : `
    <div class="wide"><table>
      ${caption ? `<caption>${esc(caption)}</caption>` : ''}
      <thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;

  const band = items => !items.length ? '' :
    `<div class="band">${items.map(([v, l]) =>
      `<div><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>`;

  // A stacked bar per financial year. The label above each bar is that bar's own height,
  // so no bar is ever labelled with a number smaller than itself.
  function chart(c) {
    if (!c || !c.labels.length) return '';
    const W = 720, H = 290, padL = 52, padR = 12, padT = 24, padB = 38;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = Math.max(...c.totals, 1);
    const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
    const top = Math.ceil(max / step) * step || 1;
    const y = v => padT + plotH - (v / top) * plotH;
    const slot = plotW / c.labels.length;
    const bw = Math.min(68, slot * 0.5);

    const rules = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = top * f;
      return `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)" stroke-width="1"/>
        <text x="${padL - 9}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--quiet)">${inr(v, 0)}</text>`;
    }).join('');

    const bars = c.labels.map((label, i) => {
      const cx = padL + slot * i + slot / 2, x = cx - bw / 2;
      let acc = 0;
      const segs = SERIES.map((s, si) => {
        const v = (c.stack[si] && c.stack[si].values[i]) || 0;
        if (v <= 0) return '';
        const yTop = y(acc + v), yBot = y(acc);
        acc += v;
        const topMost = !c.stack.slice(si + 1).some(o => (o.values[i] || 0) > 0);
        return `<rect x="${x}" y="${yTop}" width="${bw}" height="${Math.max(0, yBot - yTop - 2)}"
          rx="${topMost ? 4 : 0}" fill="${s.css}"><title>${esc(label)} · ${esc(s.key)}: ${inr(v)} tons</title></rect>`;
      }).join('');
      return `${segs}
        <text x="${cx}" y="${y(acc) - 7}" text-anchor="middle" font-size="12" font-weight="600"
          fill="var(--ink)">${inr(acc, 0)}</text>
        <text x="${cx}" y="${H - 13}" text-anchor="middle" font-size="12" fill="var(--quiet)">${esc(label)}</text>`;
    }).join('');

    return `<figure>
      <p class="legend">${SERIES.map(s =>
        `<span><i class="key" style="background:${s.css}"></i>${esc(s.key)}</span>`).join('')}</p>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
        aria-label="Solid waste by financial year, split into horticulture, dry and wet waste, in tons.">
        ${rules}
        <text x="${padL - 9}" y="${padT - 9}" text-anchor="end" font-size="11" fill="var(--quiet)">Tons</text>
        ${bars}
      </svg>
      <figcaption>All three types added together. The institute's published
        <em>Total Solid Waste</em> counts dry and wet only.</figcaption>
    </figure>`;
  }

  // The figure shown beside a topic in the index.
  function headline(t, d) {
    if (t.data === 'waste' && d.latestYear) {
      const [v, unit] = mass(d.latestYear.total);
      return [v, `${unit} · ${d.latestYear.fy}`];
    }
    if (t.data === 'sewage') return [inr(d.plants.capacity, 3), 'MLD treated'];
    if (t.stat) return [t.stat.value, t.stat.label];
    return ['', ''];
  }

  function section(t, d) {
    let figures = '';
    if (t.data === 'waste') {
      const y = d.latestYear;
      const rec = y ? n(y.recycled) + n(y.processed) : null;
      figures = band([
        ...(() => { const [v, unit] = y ? mass(y.total) : ['—', 'tons'];
          return [[v, `Total solid waste, ${unit} · ${y ? y.fy : ''}`]]; })(),
        [y && n(y.total) ? inr((rec / n(y.total)) * 100, 0) + '%' : '—', 'Recycled or processed'],
        [y ? inr(n(y.ewaste), 0) : '—', 'Electronic waste, kg'],
      ]) + chart(d.chart) + grid(d.waste, 'Tons, except electronic waste in kilograms')
        + (d.waste.note ? `<p class="note">${esc(d.waste.note)}</p>` : '');
    } else if (t.data === 'sewage') {
      figures = band([
        [inr(d.plants.capacity, 3), 'MLD treatment capacity'],
        [String(d.plants.rows.length), 'plants'],
        ['40%', 'of treated water reused'],
      ]) + grid(d.plants, 'Plants in service')
        + (d.lab.rows.length ? grid(d.lab, d.lab.published
          ? `Treated water quality at ${d.lab.plant}, as published by the institute`
          : `Treated water quality at ${d.lab.plant}, sampled ${d.lab.sampled}`) : '');
    } else if (t.table) {
      figures = grid(t.table, t.table.caption);
    }
    return `<section class="topic" id="${esc(t.slug)}">
      <h2>${esc(t.heading)}</h2>
      ${paras(t.body)}
      ${figures}
    </section>`;
  }

  function render(d) {
    const topics = d.topics || [];
    document.getElementById('main').innerHTML = `
      <div class="open"><div class="shell">
        <h1>What the campus uses, and what it throws away</h1>
        <p class="say">Figures for the 2,100-acre Kharagpur campus, kept by the sections
          that do the work and published here as they are recorded.</p>
        <nav class="index">${topics.map(t => {
          const [v, l] = headline(t, d);
          return `<a href="#${esc(t.slug)}">
            <span class="name">${esc(t.title)}</span>
            <span class="fig">${esc(v)}</span>
            <span class="cap">${esc(l)}</span></a>`;
        }).join('')}</nav>
      </div></div>

      <div class="shell"><div class="body">
        <nav class="rail" aria-label="Topics"><ol>${topics.map(t =>
          `<li><a href="#${esc(t.slug)}">${esc(t.short)}</a></li>`).join('')}</ol></nav>
        <div>${topics.map(t => section(t, d)).join('')}</div>
      </div></div>

      <div class="shell"><p class="foot">
        ${d.updated ? `Waste and sewage figures up to ${esc(d.updated)}, entered by the hall
        messes and the sanitation, horticulture, biogas and sewage treatment sections.
        ` : ''}Other figures are as published by the institute.
        <a href="/login.html">Sign in</a> to enter data.
      </p></div>`;

    // Mark the topic the reader is in.
    const links = [...document.querySelectorAll('.rail a')];
    const seen = new Map();
    const io = new IntersectionObserver(es => {
      es.forEach(e => seen.set(e.target.id, e.intersectionRatio));
      let best = null, top = 0;
      seen.forEach((r, id) => { if (r > top) { top = r; best = id; } });
      links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + best));
    }, { threshold: [0, 0.1, 0.5, 1], rootMargin: '-10% 0px -60% 0px' });
    document.querySelectorAll('section.topic').forEach(s => io.observe(s));
  }

  fetch('/api/public', { headers: { accept: 'application/json' } })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(render)
    .catch(() => {
      document.getElementById('main').innerHTML =
        '<div class="shell"><p class="state">The figures could not be loaded. Try again shortly.</p></div>';
    });
})();
