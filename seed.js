// Figures already published on the IIT Kharagpur SDSI pages, loaded once on first start.
// Only the standing list of treatment plants is seeded: the waste and sewage figures are
// now built up from daily entries, so there is nothing to pre-fill for them.
module.exports = function seed(db) {
  const insert = db.prepare('INSERT INTO entries (table_id, period, data, created_by) VALUES (?, ?, ?, ?)');
  const add = (table, period, data) => insert.run(table, period, JSON.stringify(data), 'published');

  // Sewage and effluent treatment plants
  [
    ['STP-1', 2021, 1.35],
    ['STP at Pump house 3', 2015, 0.3],
    ['STP at SPMS Hospital', 2021, 0.5],
    ['STP for Diamond Jubilee Complex (DJC)', 2020, 0.12],
    ['STP at Nehru Hall', 2022, 0.022],
    ['ETP in Chemical Eng. Annex', 2023, 0.01],
    ['ETP for DJC', 2020, 0.01],
  ].forEach(([description, year_commissioned, capacity_mld]) =>
    add('stp_plants', null, { description, year_commissioned, capacity_mld }));
};
