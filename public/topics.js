/* The eight topics the public page covers, in the order the institute lists them on its
   Environmental Sustainability page.

   Each topic's heading and paragraphs are starting text only — the administrator edits
   them from the site, and once edited the database wins. The figures and tables below are
   the institute's own published ones, copied from its pages; nothing here is invented.
   Where a topic has a `data` key, the live figures from the portal are drawn as well.

   Sources, read November 2026:
     iitkgp.ac.in/solid-waste-management
     iitkgp.ac.in/sewage-treatment-and-cleanliness-initiatives
     iitkgp.ac.in/rainwater-harvesting-and-water-conservation
     iitkgp.ac.in/energy-conservation-and-renewable-enery-generation
     iitkgp.ac.in/emissions-control
     iitkgp.ac.in/environmental-education
     iitkgp.ac.in/environmental-research                                              */
(function (root) {
  'use strict';

  const TOPICS = [
    {
      slug: 'solid-waste',
      title: 'Solid waste management',
      short: 'Solid waste',
      data: 'waste',
      heading: 'Solid waste management and cleanliness',
      body: [
        'Waste is collected door to door, already separated, into green bins for wet waste and blue for dry. Roads are swept by machine. Food waste is collected from the halls of residence twice a day.',
        'Wet waste is composted on campus three ways: bio-composting, vermicomposting, and black soldier fly larvae. Construction materials are reused rather than discarded — reclaimed paver blocks go into parking areas and road shoulders, excavated boulders into side drains, and old GI pipes become road delineators.',
      ].join('\n\n'),
    },
    {
      slug: 'sewage',
      title: 'Sewage treatment',
      short: 'Sewage treatment',
      data: 'sewage',
      heading: 'Sewage and effluent treatment',
      body: [
        'The campus uses about 9 million litres of water a day and treats about 2.3 of them across seven plants. Roughly 40% of the treated water is reused, for horticulture and floor cleaning.',
        'A further 4.0 MLD plant is under construction through the CPWD.',
      ].join('\n\n'),
    },
    {
      slug: 'water',
      title: 'Rainwater harvesting and water conservation',
      short: 'Water',
      stat: { value: '25', label: 'recharge wells' },
      heading: 'Rainwater harvesting and water conservation',
      body: [
        'Twenty-five recharge wells have been built and nine water bodies rejuvenated, covering five acres. Rooftop rainwater recharges wells at every new construction site; the pond near the Gas Godown is fed entirely from nearby rooftops.',
        'Treated water from the 1.35 MLD plant waters the gardens of several halls in place of fresh water. Dual plumbing for recycled water was built into the new boys’ and girls’ hostels, the Chemical Annexe, the Academic Building and the Academic Tower, to GRIHA 3+ norms.',
        'Every hall is metered so that leaks are found early. Dual-flush cisterns and self-closing taps are standard in new construction.',
      ].join('\n\n'),
      table: {
        caption: 'Water use',
        head: ['Measure', 'Figure'],
        rows: [
          ['Campus water consumption, 2023-24', '3.3 million m³/year'],
          ['Recharge wells built', '25'],
          ['Water bodies rejuvenated', '9, over 5 acres'],
        ],
      },
    },
    {
      slug: 'energy',
      title: 'Energy conservation and renewable energy',
      short: 'Energy',
      stat: { value: '5,558', label: 'kWp solar installed' },
      heading: 'Energy conservation and renewable energy generation',
      body: [
        'The campus has 5,558 kWp of grid-connected solar installed, most of it on the roofs of student dormitories and academic buildings. At the Nalanda Classroom Complex the panels are the roof of the cycle and vehicle parking sheds rather than sitting on top of one.',
        'On the demand side: LED lighting throughout, only BEE 5-star VRF air conditioners and BLDC fans bought, sensor-based lighting in corridors and washrooms, daylighting designed into the classroom complex, and heat-pump water heating that uses a third of the energy the old pumps did.',
        'Solar met 15.3% of demand in 2023. The stated aim is 50% by 2030, with dedicated solar farms on unused land.',
      ].join('\n\n'),
      table: {
        caption: 'Installed solar capacity',
        head: ['Where', 'kWp'],
        rows: [
          ['Student dormitories', '2,104'],
          ['Academic buildings', '1,567'],
          ['Car parking', '502'],
          ['Industrial shed', '423'],
          ['Recreational area', '353'],
          ['Cycle parking', '254'],
          ['Hospital', '101'],
          ['Total', '5,558'],
        ],
      },
    },
    {
      slug: 'emissions',
      title: 'Emissions control',
      short: 'Emissions',
      stat: { value: '2,375', label: 'tCO₂/y, Scope 1' },
      heading: 'Emissions control',
      body: [
        'Direct emissions — vehicles and cooking gas — came to 2,375 tonnes of CO₂ in 2025, against a carbon uptake of 1,428 tonnes from the campus’s own green cover. The gap is about 947 tonnes a year.',
        'Green cover is the problem, not the emissions: it has fallen from 54% of the 2,100-acre campus in 2021-22 to 40% in 2024-25, and uptake has fallen with it. Emissions over the same period dropped from 3,042 to 2,375 tonnes.',
        'Students are expected to travel by bicycle, institute bus or electric vehicle. Net zero on Scope 1 is projected for around 2030 if green cover recovers.',
      ].join('\n\n'),
      table: {
        caption: 'Emissions against carbon uptake, tonnes CO₂ per year',
        head: ['', '2021-22', '2022-23', '2023-24', '2024-25'],
        rows: [
          ['Green area, % of campus', '54', '52', '41', '40'],
          ['Carbon uptake', '1,933', '1,848', '1,471', '1,428'],
          ['Scope 1 emissions', '—', '3,042', '2,899', '2,375'],
          ['Excess', '—', '1,194', '1,428', '947'],
        ],
      },
    },
    {
      slug: 'procurement',
      title: 'Sustainable procurement',
      short: 'Procurement',
      heading: 'Sustainable procurement and purchasing policy',
      body: 'This section has not been written yet. An administrator can add it from the portal.',
    },
    {
      slug: 'education',
      title: 'Environmental education',
      short: 'Education',
      stat: { value: '17', label: 'degree programmes' },
      heading: 'Environmental education',
      body: 'Seventeen master’s and doctoral programmes across the institute are concerned with climate change and environmental sustainability.',
      table: {
        caption: 'Programmes',
        head: ['Programme', 'Offered by'],
        rows: [
          ['Environmental Engineering and Management', 'Civil Engineering'],
          ['Sustainable Science and Engineering', 'Energy Science and Engineering'],
          ['Renewable Energy Technologies', 'Energy Science and Engineering'],
          ['Sustainable Built Environment', 'Architecture'],
          ['Safety, Health and Environment', 'Mining Engineering'],
          ['Earth System Science and Technology', 'CORAL'],
          ['Land and Water Resources Engineering', 'Agricultural and Food Engineering'],
          ['Water Engineering and Management', 'School of Water Resources'],
          ['Agricultural Systems and Management', 'Agricultural and Food Engineering'],
          ['Agricultural Biotechnology', 'Agricultural and Food Engineering'],
          ['Electric Transportation', 'Electrical Engineering'],
          ['Ocean Engineering and Naval Architecture', 'Ocean Engineering and Naval Architecture'],
          ['Transportation Engineering', 'Civil Engineering'],
          ['Exploration Geosciences', 'Geology and Geophysics'],
          ['City Planning', 'Architecture'],
        ],
      },
    },
    {
      slug: 'research',
      title: 'Environmental research',
      short: 'Research',
      stat: { value: '9', label: 'departments and centres' },
      heading: 'Environmental research',
      body: 'Nine departments and centres work on environmental sustainability, the oldest founded in 1952 and the newest in 2016.',
      table: {
        caption: 'Departments and centres',
        head: ['Department or centre', 'Established', 'Faculty', 'Doctoral'],
        rows: [
          ['Agricultural and Food Engineering', '1952', '39', '170'],
          ['Environmental Engineering and Management, Civil Engineering', '1990', '7', '50'],
          ['Centre for Oceans, Rivers, Atmosphere and Land (CORAL)', '2005', '11', '60'],
          ['School of Water Resources', '2008', '5', '25'],
          ['Ranbir and Chitra Gupta School of Infrastructure Design and Management', '2008', '5', '21'],
          ['School of Environmental Science and Engineering', '2012', '15 affiliated', '38'],
          ['School of Energy Science and Engineering', '2013', '3', '80'],
          ['Architecture and Regional Planning', '2015', '15', '90'],
          ['Safety, Health and Environment, Mining Engineering', '2016', '6', '42'],
        ],
      },
    },
  ];

  const bySlug = slug => TOPICS.find(t => t.slug === slug) || null;

  const API = { TOPICS, bySlug };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SDSI_TOPICS = API;
})(typeof window !== 'undefined' ? window : globalThis);
