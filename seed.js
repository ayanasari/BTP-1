// Figures already published on the IIT Kharagpur SDSI pages, loaded once on first start.
// Monthly tables (solid waste, STP data) are left empty: the site only publishes yearly figures for them.
module.exports = function seed(db) {
  const insert = db.prepare('INSERT INTO entries (table_id, period, data) VALUES (?, ?, ?)');
  const add = (table, period, data) => insert.run(table, period, JSON.stringify(data));

  // Sewage treatment plants
  [
    ['STP-1', 2021, 1.35], ['STP at Pump house 3', 2015, 0.3], ['STP at SPMS Hospital', 2021, 0.5],
    ['STP for Diamond Jubilee Complex (DJC)', 2020, 0.12], ['STP at Nehru Hall', 2022, 0.022],
    ['ETP in Chemical Eng. Annex', 2023, 0.01], ['ETP for DJC', 2020, 0.01],
  ].forEach(([description, year_commissioned, capacity_mld]) => add('stp_plants', null, { description, year_commissioned, capacity_mld }));

  // Solar PV installations
  [
    ['Academic Buildings', 1567], ['Hospital', 101], ['Car Parking', 502], ['Cycle Parking', 254],
    ['Student Dormitories', 2104], ['Industrial Shed', 423], ['Recreational Area', 353],
  ].forEach(([category, capacity_kwp]) => add('solar', null, { category, capacity_kwp }));

  // Tree plantation
  [
    ['2016', 'Tree plantation in different places in the year', 1439],
    ['2017', 'Tree Plantation under Induction Programme near Chandi Mandir G Type Quarter', 523],
    ['2017', 'Tree plantation by Horticulture Section', 934],
    ['2018', 'Tree plantation by Horticulture Section', 439],
    ['2019', 'Tree plantation under Induction Programme near ZH Hall', 232],
    ['2020', 'Tree plantation by Horticulture Section', 157],
    ['2021', 'Tree plantation by Horticulture Section', 853],
    ['2022', 'Tree plantation at IIT Kharagpur', 284],
    ['2023', 'Tree plantation at IIT Kharagpur', 480],
    ['2024', 'Tree plantation at IIT Kharagpur', 401],
    ['2025', 'Tree plantation at IIT Kharagpur', 701],
  ].forEach(([year, details, plants]) => add('plantation', year, { details, plants }));

  // Vehicles (site: "in 2025", matched to FY 2024-25 as in the carbon uptake table)
  [
    ['Cars (Gasoline)', 1370, 11, 6, 3616355, 'Gasoline', 16, 2.28],
    ['Cars (Diesel)', 126, 12, 6, 363366, 'Diesel', 15, 2.635],
    ['Two wheelers', 1996, 11, 6, 5269440, 'Gasoline', 46, 2.28],
    ['Buses', 5, 40, 5, 40000, 'Diesel', 5, 2.635],
    ['Food Truck', 5, 20, 7, 36400, 'Diesel', 5, 2.635],
    ['Ambulances', 4, 20, 7, 29120, 'Diesel', 5, 2.635],
  ].forEach(([vehicle_type, number_registered, km_per_day, days_per_week, km_per_year, fuel_used, km_per_l, co2_factor]) =>
    add('vehicles', '2024-25', { vehicle_type, number_registered, km_per_day, days_per_week, km_per_year, fuel_used, km_per_l, co2_factor }));

  // LPG cooking
  add('lpg', '2024-25', { used_in: 'Halls', cylinders_y: 16733, kg_per_cylinder: 19, co2_factor: 2.993 });
  add('lpg', '2024-25', { used_in: 'Households', cylinders_y: 12503, kg_per_cylinder: 14.1, co2_factor: 2.993 });

  // Carbon uptake by green areas
  [['2021-22', 1137], ['2022-23', 1087], ['2023-24', 865], ['2024-25', 840]]
    .forEach(([fy, green_acres]) => add('green', fy, { campus_acres: 2100, green_acres, uptake_factor: 1.7 }));

  // Environmental education: degree programmes
  [
    ['M.Tech., PhD', 'Environmental Engineering and Management', 'Civil Engineering'],
    ['M.Tech., PhD', 'Sustainable Science and Engineering', 'Energy Science and Engineering'],
    ['M.Tech., PhD', 'Renewable Energy Technologies', 'Energy Science and Engineering'],
    ['M.Arch., PhD', 'Sustainable Built Environment', 'Architecture'],
    ['M.Tech., PhD', 'Safety, Health and Environment', 'Mining Engineering'],
    ['M.Tech., PhD', 'Earth System Science and Technology', 'CORAL'],
    ['M.Tech., PhD', 'Land and Water Resources Engineering', 'Agricultural and Food Engineering'],
    ['M.Tech., PhD', 'Water Engineering and Management', 'Water Resources'],
    ['M.Tech., PhD', 'Agricultural Systems and Management', 'Agricultural and Food Engineering'],
    ['M.Tech., PhD', 'Agricultural Biotechnology', 'Agricultural and Food Engineering'],
    ['M.Tech., PhD', 'Electric Transportation', 'Electrical Engineering'],
    ['M.Tech., PhD', 'Ocean Engineering and Naval Architecture', 'Ocean Engineering and Naval Architecture'],
    ['M.Tech., PhD', 'Transportation Engineering', 'Civil Engineering'],
    ['M.Tech., PhD', 'Exploration Geosciences', 'Geology and Geophysics'],
    ['M.Tech., PhD', 'City Planning', 'Architecture'],
    ['M.Tech., PhD', 'Sustainable Built Environment', 'Architecture'],
    ['M.Tech., PhD', 'Electric Transportation', 'Advanced Technology Development Centre'],
  ].forEach(([degree, program, department]) => add('programmes', null, { degree, program, department }));

  // Environmental education: CEP sustainability events and courses
  [
    ['IIT/CEP/WOR/WOR/2024-2025/RD/102', 'Management and Governance of Farmer Producer Organizations', '2024-12-11', '2024-12-11'],
    ['IIT/CEP/WOR/WOR/2024-2025/EF/121', 'SPARC Sponsored India-Singapore workshop on Advanced Materials for Energy and Environment', '2025-02-24', '2025-02-26'],
    ['IIT/CEP/CFC/CFC/2024-2025/HS/78', 'Smart Sustainable and Resilient Economy', '2025-01-06', '2025-01-10'],
    ['IIT/CEP/WOR/WOR/2024-2025/RT/149', 'RECENT ADVANCES IN ELASTOMERS AND COMPOSITES RAEC 2025', '2025-03-03', '2025-03-03'],
    ['IIT/CEP/WOR/WOR/2025-2026/ES/186', 'Sustainable Energy Transition International Workshop', '2026-03-07', '2026-03-15'],
    ['IIT/CEP/CON/CON/2024-2025/BM/112', 'Transforming Mobility Business Innovations Financial Strategies and Sustainability Practices for a Greener Future', '2025-02-13', '2025-02-14'],
    ['IIT/CEP/WOR/WOR/2024-2025/AG/39', 'sustainable packaging solutions for food and agriculture applications stakeholders perspective', '2024-08-02', '2024-08-02'],
    ['IIT/CEP/SYM/SYM/2025-2026/IP/83', 'Regulating Emerging Technologies Through the Lens of Energy Efficiency', '2025-11-29', '2025-11-29'],
    ['IIT/CEP/SYM/SYM/2024-2025/ES/34', 'Sustainable Energy Transition Engineering Entrepreneurship and Wellbeing', '2024-07-08', '2024-07-12'],
    ['IIT/CEP/SYM/SYM/2024-2025/MT/5', '5th Indo-Austrian Symposium on Materials Engineering', '2024-12-12', '2024-12-13'],
    ['IIT/CEP/STC/SP/2024-2025/RJ/73', 'Essentials of ESG and Sustainability', '2024-11-04', '2024-11-04'],
    ['IIT/CEP/SYM/SYM/2025-2026/CL/126', 'Geomatics and Space Innovations Towards Atmanirbhar Bharat', '2025-11-25', '2025-11-27'],
    ['IIT/CEP/CON/CON/2024-2025/MI/51', 'Geo-Resources Engineering Energy and Nature GREEN 2025', '2025-12-07', '2025-12-12'],
    ['IIT/CEP/WOR/WOR/2025-2026/ES/44', '3rd Workshop on Sustainable Energy Transition Engineering Entrepreneurship and Wellbeing', '2025-08-01', '2025-08-14'],
    ['IIT/CEP/SYM/SYM/2025-2026/RT/158', 'SMART SUSTAINABLE POLYMERIC MATERIALS AND PROCESSING 2026 - SSPMP 2026', '2026-03-06', '2026-03-06'],
  ].forEach(([course_id, course_title, start_date, end_date]) => add('cep_events', null, { course_id, course_title, start_date, end_date, outline: null }));

  // Environmental research centres
  [
    ['Agricultural and Food Engineering', 1952, '39', 25, 170, 260, 408, 'Sustainable agriculture and aquaculture, sustainable food production', 'https://www.iitkgp.ac.in/department/AG'],
    ['Civil Engg Environmental Engg and Management (EEM) Section', 1990, '7', 2, 50, 25, 482, 'Sustainable use of all natural resources, climate change impacts and management', 'https://www.iitkgp.ac.in/department/CE'],
    ['Centre for Oceans, Rivers, Atmosphere and Land (CORAL)', 2005, '11', 1, 60, 25, 0, 'Environment and sustainability, Earth system science and technology', 'https://www.iitkgp.ac.in/department/CL'],
    ['School of Water Resources (SoWR)', 2008, '5', 2, 25, 15, 0, 'Sustainable use of water resources', 'https://www.iitkgp.ac.in/department/WM'],
    ['Ranbir and Chitra Gupta School of Infrastructure Design and Mngt.', 2008, '5', 2, 21, 67, 0, 'Sustainable infrastructure development', 'https://www.iitkgp.ac.in/department/ID'],
    ['School of Environmental Science and Engineering (SESE)', 2012, '0/15', 2, 38, 0, 0, 'Water and wastewater treatment, air pollution monitoring, solid waste management', 'https://www.iitkgp.ac.in/department/EF'],
    ['School of Energy Science and Engineering (SESAE)', 2013, '3', 2, 80, 20, 0, 'Renewable Energy Technologies', 'https://www.iitkgp.ac.in/department/ES'],
    ['Architecture and Regional Planning', 2015, '15', 9, 90, 139, 179, 'Sustainable Built Environments', 'https://www.iitkgp.ac.in/department/AR'],
    ['Mining Engineering - Safety, Health and Environment', 2016, '6', 4, 42, 37, 483, 'Sustainable use of resources and risk management of human health and the environment', 'https://www.iitkgp.ac.in/department/MI'],
  ].forEach(([department, year_est, faculty, staff, phd, masters, bachelors, domain, website]) =>
    add('research_centres', null, { department, year_est, faculty, staff, phd, masters, bachelors, domain, website }));

  // Equality and diversity: reservation policy
  [
    ['General', 0, 'MCM'], ['Economically Weaker Section (EWS)', 10, 'MCM'], ['Other Backward Castes (OBC)', 27, 'MCM'],
    ['Scheduled Caste (SC)', 15, '100'], ['Scheduled Tribe (ST)', 7.5, '100'], ['Supernumerary female students', 20, 'MCM'],
  ].forEach(([category, reservation_pct, tuition_waiver]) => add('reservation', null, { category, reservation_pct, tuition_waiver }));

  // Scholarships and fellowships, as of 30 July each year
  const schemes = [
    ["Prime Minister's Research Fellowship", 'Ph.D. students', [151, 233, 156], '70,000'],
    ['M.Tech. scholarship', 'M.Tech./M.Sc/ DD -5th year', [1969, 2746, 3992], '12,400'],
    ['Research Scholarship', 'Ph.D. students', [1181, 3108, 3286], '37,000 for 1st 2 years, 42,000 for next 3 years'],
    ['Post-doctoral fellowship', 'Post-Ph.D. scholars', [2, 2, 2], '70,000-1,50,000'],
  ];
  ['2023-07-30', '2024-07-30', '2025-07-30'].forEach((date, i) =>
    schemes.forEach(([description, student_category, counts, amount]) =>
      add('scholarships', date, { description, student_category, students: counts[i], amount })));

  // Students as on 1 Apr 2025
  [
    ['PG', 1.19, 3.38, 7.14, 7.99, 0.04, 2.28],
    ['RS', 0.36, 2.47, 4.31, 11.93, 0.13, 0.78],
    ['UG', 4.50, 8.97, 16.22, 22.25, 0.01, 6.05],
  ].forEach(([level, st, sc, ob, ge, fn, ews]) => add('students_apr', '2025-04-01', { level, st, sc, ob, ge, fn, ews }));

  // The remaining charts on the Equality page carry no date, so no "As on" is filled in for them.
  [
    ['PG', 38, 32, 15, 6, 9, 1, 2],
    ['RS', 61, 22, 12, 2, 3, 1, 1],
    ['UG', 39, 28, 16, 8, 10, 0, 2],
  ].forEach(([level, general, obc, sc, st, ews, fn, pd]) => add('students_category', null, { level, general, obc, sc, st, ews, fn, pd }));

  [['PG', 5.13, 16.90], ['RS', 6.23, 13.74], ['UG', 10.66, 47.34]]
    .forEach(([level, f, m]) => add('students_gender', null, { level, f, m }));
  [['Faculty', 7.07, 38.66], ['Non faculty', 7.13, 47.15]]
    .forEach(([group, f, m]) => add('staff_gender', null, { group, f, m }));

  // Inclusivity: sponsored research projects on disabilities studies
  [
    ['Empowering The Visually Handicapped Through Speech Synthesis for Multilingual Indian Environment', 'Computer Science and Engineering', '2003-05', 'Anupam Basu'],
    ['Setting Up Information And Communication Technology Enabled Laboratory of Nimh', 'Computer Science and Engineering', '2008-11', 'Anupam Basu'],
    ['Disability And Victimization: A Study of Vulnerability of Disabled Women and Socia-Legal Protection Strategies', 'Rajiv Gandhi School of Intellectual Property Law', '2009-10', 'Dipa Dube'],
    ['Design, Development and Feasibility Study of A Versatile Low Cost Fuctional Electrical Stimulation (FES) for Hemiplegics', 'School of Medical Science and Technology', '2010-14', 'Manjunatha Mahadevappa'],
    ['To Evaluate The Clinical Efficacy of The Fuctional Electrical Stimulation (FES) Therapy In Stroke Survivors', 'School of Medical Science and Technology', '2010-14', 'Manjunatha Mahadevappa'],
    ['Biomedical Robotics for Neuro - Controlled Prosthesis', 'Mechanical Engineering', '2014-17', 'Manjunatha Mahadevappa, Cheruvu Siva Kumar'],
    ['Haptic Torch for Mobility of Visually Impaired and Blind People (SGFSS)', 'School of Medical Science and Technology', '2014-15', 'Manjunatha Mahadevappa'],
    ['To Evaluate the Clinical Feasibility and Effect of Neuromuscular Electrical Stimulation (NMES) Therapy of Quadriceps (QF) and Tibialis Anterior (TA) Muscles on Improving GAIT and Functional Outcomes in Children with Spastic Cerebral Palsy (CP)', 'School of Medical Science and Technology', '2016-19', 'Manjunatha Mahadevappa'],
    ['Development of a Suite of Indigenous Assistive Systems and Tools for the Disabled Community in India', 'Centre For Educational Technology', '2016-22', 'Anupam Basu, Manjira Sinha'],
    ['Development of a Suite of Indigenous Assistive Systems and Tools for the Disabled Community in India - sub-project at IIT KGP', 'Centre For Educational Technology', '2017-22', 'Manjira Sinha, Anupam Basu'],
    ['Development of a System for Post Stroke Rehabilitation of Hand Functions Using a Low Cost Robotic Exoskeleton', 'School of Medical Science and Technology', '2017-22', 'Manjunatha Mahadevappa'],
    ['Development and Commercialization of Degradable Metallic Internal Fracture Fixation Devices', 'Metallurgical and Materials Engineering', '2018-20', 'Mangal Roy'],
    ['Actuation and Control System Development for Independent Movement of Prosthesis Arm for Respective Degree of Freedom of Joints', 'School of Medical Science and Technology', '2018-20', 'Manjunatha Mahadevappa'],
    ['Wellness Drive for IIT-KGPs PWD Students', 'International Relations', '2022-25', 'DEAN, International Relations, Geetanjali Panda'],
    ['Comparative Analysis between the Movement Speed of Non-Disabled and Persons with Disabilities Using Geriatric Simulation in Educational Campuses: A Comparative Study between India and Japan', 'Architecture and Regional Planning', '2024-25', 'Gaurab Das Mahapatra'],
  ].forEach(([title, department, duration, pi]) => add('disability_projects', null, { title, department, duration, pi }));
};
