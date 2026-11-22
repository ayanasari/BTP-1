/* One drawing per topic.

   Flat, geometric, three tones taken from the page's own palette, so they sit with the
   type rather than shouting over it and work in both light and dark without a second set.
   They are drawings, not photographs: nothing here is presented as a picture of the
   campus. Replace them with real photographs when there are some.

   Each is a 320x200 viewBox so they line up in a row. Colours come from CSS variables:
   --ill-1 the solid mass, --ill-2 the mid tone, --ill-3 the accent, --ill-line outlines. */
(function (root) {
  'use strict';

  const svg = (title, body) =>
    `<svg viewBox="0 0 320 200" role="img" aria-label="${title}" class="ill">${body}</svg>`;

  const ILLUSTRATIONS = {

    // A collection truck at a pair of separated bins.
    'solid-waste': svg('Illustration of a waste collection truck beside separated bins', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <path d="M150 72h92l30 34v46H150z" fill="var(--ill-1)"/>
      <path d="M242 78h22l22 26h-44z" fill="var(--ill-2)"/>
      <rect x="160" y="60" width="74" height="16" rx="3" fill="var(--ill-2)"/>
      <circle cx="178" cy="152" r="15" fill="var(--ill-line)"/><circle cx="178" cy="152" r="6" fill="var(--ill-2)"/>
      <circle cx="258" cy="152" r="15" fill="var(--ill-line)"/><circle cx="258" cy="152" r="6" fill="var(--ill-2)"/>
      <path d="M58 104h34v48H58z" fill="var(--ill-3)"/>
      <rect x="54" y="96" width="42" height="10" rx="3" fill="var(--ill-line)"/>
      <path d="M104 104h34v48h-34z" fill="var(--ill-2)"/>
      <rect x="100" y="96" width="42" height="10" rx="3" fill="var(--ill-line)"/>
      <circle cx="75" cy="124" r="7" fill="var(--ill-line)" opacity=".45"/>
      <circle cx="121" cy="124" r="7" fill="var(--ill-line)" opacity=".45"/>`),

    // Treatment tanks with water moving between them.
    sewage: svg('Illustration of sewage treatment tanks', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <ellipse cx="78" cy="86" rx="48" ry="13" fill="var(--ill-2)"/>
      <path d="M30 86v52c0 7 21 13 48 13s48-6 48-13V86" fill="var(--ill-1)"/>
      <ellipse cx="78" cy="100" rx="40" ry="10" fill="var(--ill-3)" opacity=".8"/>
      <ellipse cx="226" cy="104" rx="42" ry="11" fill="var(--ill-2)"/>
      <path d="M184 104v36c0 6 19 11 42 11s42-5 42-11v-36" fill="var(--ill-1)"/>
      <ellipse cx="226" cy="116" rx="34" ry="8" fill="var(--ill-3)" opacity=".8"/>
      <path d="M126 112h48v10h-48z" fill="var(--ill-line)"/>
      <path d="M174 106l14 11-14 11z" fill="var(--ill-3)"/>
      <circle cx="78" cy="68" r="5" fill="var(--ill-3)"/>
      <circle cx="96" cy="60" r="3" fill="var(--ill-3)" opacity=".6"/>`),

    // Rain falling into a recharge well.
    water: svg('Illustration of rainwater recharging a well', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <path d="M96 52h128c14 0 22 9 22 19s-8 19-22 19H96c-16 0-26-9-26-19s10-19 26-19z" fill="var(--ill-2)"/>
      ${[112, 140, 168, 196, 224].map((x, i) =>
        `<path d="M${x} ${104 + (i % 2) * 8}l5 11a5.5 5.5 0 11-10 0z" fill="var(--ill-3)"/>`).join('')}
      <path d="M118 152h84v-18a42 42 0 00-84 0z" fill="var(--ill-1)" opacity=".25"/>
      <rect x="112" y="146" width="96" height="9" rx="4" fill="var(--ill-line)"/>
      <path d="M126 155h72l-9 38h-54z" fill="var(--ill-1)"/>
      <path d="M133 170h58l-3 14h-52z" fill="var(--ill-3)" opacity=".85"/>`),

    // Solar panels on a roof.
    energy: svg('Illustration of solar panels on a rooftop', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <path d="M48 152V98h110v54z" fill="var(--ill-1)" opacity=".3"/>
      <path d="M40 98l63-32 63 32z" fill="var(--ill-2)"/>
      <path d="M176 118h104l-18-44h-104z" fill="var(--ill-3)"/>
      <path d="M176 118h104l-18-44h-104z" fill="none" stroke="var(--ill-line)" stroke-width="2"/>
      ${[0, 1, 2].map(i => `<path d="M${200 + i * 26} 74l18 44" stroke="var(--ill-line)" stroke-width="2" fill="none"/>`).join('')}
      <path d="M158 96h140" stroke="var(--ill-line)" stroke-width="2" fill="none" opacity=".6"/>
      <rect x="214" y="118" width="7" height="34" fill="var(--ill-line)"/>
      <circle cx="68" cy="48" r="15" fill="var(--ill-3)"/>
      ${[0, 45, 90, 135].map(a => `<path d="M68 26v-9" stroke="var(--ill-3)" stroke-width="3"
        transform="rotate(${a} 68 48)"/>`).join('')}`),

    // Trees against a bus: uptake against emissions.
    emissions: svg('Illustration of trees beside a campus bus', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <rect x="150" y="92" width="130" height="48" rx="7" fill="var(--ill-1)"/>
      <rect x="160" y="102" width="30" height="20" rx="3" fill="var(--ill-3)" opacity=".9"/>
      <rect x="198" y="102" width="30" height="20" rx="3" fill="var(--ill-3)" opacity=".9"/>
      <rect x="236" y="102" width="30" height="20" rx="3" fill="var(--ill-3)" opacity=".9"/>
      <circle cx="176" cy="142" r="11" fill="var(--ill-line)"/>
      <circle cx="254" cy="142" r="11" fill="var(--ill-line)"/>
      ${[[58, 1], [100, .78]].map(([x, s]) => `
        <rect x="${x + 11 * s}" y="${152 - 34 * s}" width="${7 * s}" height="${34 * s}" fill="var(--ill-line)"/>
        <circle cx="${x + 14 * s}" cy="${152 - 46 * s}" r="${24 * s}" fill="var(--ill-2)"/>
        <circle cx="${x + 2 * s}" cy="${152 - 32 * s}" r="${15 * s}" fill="var(--ill-3)" opacity=".85"/>`).join('')}`),

    // A crate with a check: what gets bought.
    procurement: svg('Illustration of a checked supply crate', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <path d="M96 78l64-26 64 26-64 26z" fill="var(--ill-2)"/>
      <path d="M96 78v52l64 26V104z" fill="var(--ill-1)"/>
      <path d="M224 78v52l-64 26V104z" fill="var(--ill-1)" opacity=".62"/>
      <circle cx="226" cy="58" r="22" fill="var(--ill-3)"/>
      <path d="M215 58l8 8 16-17" stroke="var(--ill-line)" stroke-width="4" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>`),

    // An open book with a leaf.
    education: svg('Illustration of an open book with a leaf', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <path d="M160 72c-18-14-44-18-62-16v74c18-2 44 2 62 16z" fill="var(--ill-1)"/>
      <path d="M160 72c18-14 44-18 62-16v74c-18-2-44 2-62 16z" fill="var(--ill-2)"/>
      <path d="M160 72v74" stroke="var(--ill-line)" stroke-width="3"/>
      ${[0, 1, 2].map(i => `
        <path d="M112 ${86 + i * 14}h34" stroke="var(--ill-line)" stroke-width="2.5" opacity=".45"/>
        <path d="M174 ${86 + i * 14}h34" stroke="var(--ill-line)" stroke-width="2.5" opacity=".45"/>`).join('')}
      <path d="M160 58c0-14 8-23 20-27 2 18-6 27-20 27z" fill="var(--ill-3)"/>`),

    // A flask, with a sample reading rising out of it.
    research: svg('Illustration of laboratory glassware', `
      <rect x="0" y="152" width="320" height="3" fill="var(--ill-line)"/>
      <path d="M142 54h36v30l30 62a8 8 0 01-7 12h-82a8 8 0 01-7-12l30-62z" fill="var(--ill-1)" opacity=".35"/>
      <path d="M142 54h36v30l30 62a8 8 0 01-7 12h-82a8 8 0 01-7-12l30-62z" fill="none"
        stroke="var(--ill-line)" stroke-width="3" stroke-linejoin="round"/>
      <path d="M120 122h80l16 24a8 8 0 01-7 12h-82a8 8 0 01-7-12z" fill="var(--ill-3)"/>
      <rect x="136" y="46" width="48" height="9" rx="4" fill="var(--ill-line)"/>
      <circle cx="152" cy="138" r="4" fill="var(--ill-2)"/>
      <circle cx="172" cy="146" r="3" fill="var(--ill-2)"/>
      <path d="M226 110h10v48h-10z" fill="var(--ill-2)"/>
      <path d="M242 88h10v70h-10z" fill="var(--ill-3)"/>
      <path d="M258 126h10v32h-10z" fill="var(--ill-2)"/>`),
  };

  const API = { ILLUSTRATIONS, for: slug => ILLUSTRATIONS[slug] || '' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SDSI_ILL = API;
})(typeof window !== 'undefined' ? window : globalThis);
