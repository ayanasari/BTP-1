/* The public page. It draws whatever /api/public returns and nothing else: no session,
   and the server sends only finished totals, so nothing here could show a daily figure,
   a hall or an account even by accident. */
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

  // Tonnes once there are tonnes; kilograms before that, so a year that has only just
  // begun does not report its first few kilos as zero.
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

  const photos = t => !(t.photos || []).length ? '' :
    `<div class="shots">${t.photos.map(s => `<figure>
      <img src="${esc(s.src)}" alt="${esc(s.caption || t.title)}" loading="lazy" decoding="async">
      ${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`;

  // Stacked bars by financial year. Each bar is labelled with its own height.
  function chart(c) {
    if (!c || !c.labels.length) return '';
    const W = 720, H = 280, padL = 52, padR = 12, padT = 22, padB = 36;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = Math.max(...c.totals, 1);
    const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
    const top = Math.ceil(max / step) * step || 1;
    const y = v => padT + plotH - (v / top) * plotH;
    const slot = plotW / c.labels.length;
    const bw = Math.min(64, slot * 0.46);

    const rules = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = top * f;
      return `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/>
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
        <text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="12" fill="var(--quiet)">${esc(label)}</text>`;
    }).join('');

    return `<figure class="chart">
      <p class="legend">${SERIES.map(s =>
        `<span><i class="key" style="background:${s.css}"></i>${esc(s.key)}</span>`).join('')}</p>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
        aria-label="Solid waste by financial year, split into horticulture, dry and wet waste, in tons.">
        ${rules}<text x="${padL - 9}" y="${padT - 8}" text-anchor="end" font-size="11" fill="var(--quiet)">Tons</text>${bars}
      </svg>
    </figure>`;
  }

  let DATA = null;

  function overview(d) {
    const y = d.latestYear;
    const [tot, unit] = y ? mass(y.total) : ['—', 'tons'];
    return `<h1>Environmental sustainability</h1>
      <p class="lead">Figures for the 2,100-acre Kharagpur campus.</p>
      ${d.demo ? '<p class="flag">Demonstration figures, not the institute’s recorded data.</p>' : ''}
      ${band([
        [tot, `Solid waste, ${unit} · ${y ? y.fy : ''}`],
        [inr(d.plants.capacity, 3), 'MLD treated daily'],
        ['5,558', 'kWp solar installed'],
        ['2,375', 'tCO₂ a year, Scope 1'],
      ])}
      ${chart(d.chart)}
      ${grid(d.waste, 'Waste generated by financial year')}
      ${d.waste.note ? `<p class="foot-note">${esc(d.waste.note)}</p>` : ''}`;
  }

  function topicView(t, d) {
    let rest = '';
    if (t.data === 'waste') {
      const y = d.latestYear;
      const rec = y ? n(y.recycled) + n(y.processed) : null;
      const [tot, unit] = y ? mass(y.total) : ['—', 'tons'];
      rest = band([
        [tot, `Total solid waste, ${unit} · ${y ? y.fy : ''}`],
        [y && n(y.total) ? inr((rec / n(y.total)) * 100, 0) + '%' : '—', 'Recycled or processed'],
        [y ? inr(n(y.ewaste), 0) : '—', 'Electronic waste, kg'],
      ]) + chart(d.chart)
        + grid(d.waste, 'Waste generated by financial year, tons')
        + (d.waste.note ? `<p class="foot-note">${esc(d.waste.note)}</p>` : '')
        + (d.perType ? grid(d.perType, 'Estimated amount and type of waste generated') : '');
    } else if (t.data === 'sewage') {
      rest = band([
        [inr(d.plants.capacity, 3), 'MLD treatment capacity'],
        [String(d.plants.rows.length), 'plants'],
        ['40%', 'of treated water reused'],
      ]) + grid(d.plants, 'Sewage and effluent treatment plants')
        + (d.lab.rows.length ? grid(d.lab, `Treated water from ${d.lab.plant}`) : '');
    } else if (t.table) {
      rest = grid(t.table, t.table.caption);
    }
    const art = (t.photos || []).length ? ''
      : `<div class="art">${(window.SDSI_ILL && window.SDSI_ILL.for(t.slug)) || ''}</div>`;
    return `<h1>${esc(t.heading)}</h1>
      ${d.demo && t.data ? '<p class="flag">Demonstration figures, not the institute’s recorded data.</p>' : ''}
      ${photos(t)}${art}${paras(t.body)}${rest}`;
  }

  function route() {
    if (!DATA) return;
    const slug = location.hash.replace(/^#\/?/, '');
    const t = DATA.topics.find(x => x.slug === slug);
    document.getElementById('view').innerHTML =
      (t ? topicView(t, DATA) : overview(DATA))
      + `<p class="ends">${DATA.updated ? `Waste and sewage figures up to ${esc(DATA.updated)}. ` : ''}
         Other figures as published by the institute.</p>`;
    document.querySelectorAll('.side a').forEach(a => {
      const on = a.getAttribute('href') === (t ? '#/' + t.slug : '#/');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = `${t ? t.title : 'Environmental sustainability'} · IIT Kharagpur`;
    if (t) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  fetch('/api/public', { headers: { accept: 'application/json' } })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => {
      DATA = d;
      document.getElementById('nav').innerHTML =
        `<li><a href="#/">Overview</a></li>`
        + d.topics.map(t => `<li><a href="#/${esc(t.slug)}">${esc(t.title)}</a></li>`).join('');
      window.addEventListener('hashchange', route);
      route();
    })
    .catch(() => {
      document.getElementById('view').innerHTML =
        '<p class="state">The figures could not be loaded. Try again shortly.</p>';
    });
})();
