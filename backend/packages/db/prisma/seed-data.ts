// Static synthetic reference data for the seed. Names are fictional Filipino-style combinations.

export const SITES = [
  { code: 'HQ', name: 'HQ Cebu City', address: 'Osmeña Blvd, Cebu City' },
  { code: 'MND', name: 'Mandaue branch', address: 'A.S. Fortuna St, Mandaue City' },
  { code: 'LLC', name: 'Lapu-Lapu branch', address: 'M.L. Quezon Hwy, Lapu-Lapu City' },
] as const;

/** Positions are [title, min daily rate, max daily rate, isLead]. */
export const DEPARTMENTS: {
  code: string;
  name: string;
  positions: [string, number, number, boolean][];
}[] = [
  {
    code: 'HR',
    name: 'Human Resources',
    positions: [
      ['HR Manager', 1900, 2400, true],
      ['HR Officer', 950, 1300, false],
      ['HR Assistant', 700, 900, false],
    ],
  },
  {
    code: 'FIN',
    name: 'Finance & Accounting',
    positions: [
      ['Finance Manager', 2000, 2500, true],
      ['Accountant', 1200, 1700, false],
      ['Payroll Officer', 1000, 1400, false],
      ['Accounting Clerk', 700, 900, false],
    ],
  },
  {
    code: 'OPS',
    name: 'Operations',
    positions: [
      ['Branch Manager', 1800, 2300, true],
      ['Operations Supervisor', 1200, 1600, false],
      ['Team Leader', 900, 1200, false],
      ['Operations Staff', 610, 780, false],
    ],
  },
  {
    code: 'WHS',
    name: 'Warehouse & Logistics',
    positions: [
      ['Warehouse Supervisor', 1100, 1500, true],
      ['Inventory Clerk', 700, 880, false],
      ['Forklift Operator', 720, 900, false],
      ['Warehouse Helper', 610, 700, false],
    ],
  },
  {
    code: 'SAL',
    name: 'Sales',
    positions: [
      ['Sales Supervisor', 1200, 1700, true],
      ['Account Executive', 900, 1300, false],
      ['Sales Associate', 640, 820, false],
    ],
  },
  {
    code: 'CS',
    name: 'Customer Service',
    positions: [
      ['CS Team Lead', 900, 1200, true],
      ['CS Representative', 650, 850, false],
    ],
  },
  {
    code: 'IT',
    name: 'Information Technology',
    positions: [
      ['IT Manager', 2000, 2500, true],
      ['Systems Developer', 1300, 2000, false],
      ['IT Support', 800, 1100, false],
    ],
  },
  {
    code: 'ADM',
    name: 'Admin & Facilities',
    positions: [
      ['Facilities Supervisor', 1000, 1300, true],
      ['Admin Assistant', 680, 880, false],
      ['Driver', 650, 800, false],
      ['Messenger', 610, 680, false],
    ],
  },
];

/** Headcount per site per department (total 180). */
export const HEADCOUNT: Record<string, Record<string, number>> = {
  HQ: { HR: 6, FIN: 10, IT: 6, ADM: 8, OPS: 22, WHS: 22, SAL: 12, CS: 10 }, // 96
  MND: { OPS: 18, WHS: 12, SAL: 8, CS: 6, ADM: 4 }, // 48
  LLC: { OPS: 14, WHS: 8, SAL: 8, CS: 4, ADM: 2 }, // 36
};

export const DEVICES = [
  { serial: 'ZKHQ0001', name: 'HQ main entrance', site: 'HQ', model: 'ZKTeco SpeedFace-V5L' },
  { serial: 'ZKHQ0002', name: 'HQ warehouse', site: 'HQ', model: 'ZKTeco MB560-VL' },
  { serial: 'ZKMD0001', name: 'Mandaue entrance', site: 'MND', model: 'ZKTeco SpeedFace-V5L' },
  { serial: 'ZKLL0001', name: 'Lapu-Lapu entrance', site: 'LLC', model: 'ZKTeco MB560-VL' },
] as const;

export const MOBILE_DEVICE_SERIAL = 'MOBILE-APP';

/** 2026 Philippine holidays (approximate; verify against the official proclamation before real use). */
export const HOLIDAYS_2026: { date: string; name: string; type: 'REGULAR' | 'SPECIAL' }[] = [
  { date: '2026-01-01', name: "New Year's Day", type: 'REGULAR' },
  { date: '2026-02-17', name: 'Chinese New Year', type: 'SPECIAL' },
  { date: '2026-03-20', name: "Eid'l Fitr (approx.)", type: 'REGULAR' },
  { date: '2026-04-02', name: 'Maundy Thursday', type: 'REGULAR' },
  { date: '2026-04-03', name: 'Good Friday', type: 'REGULAR' },
  { date: '2026-04-04', name: 'Black Saturday', type: 'SPECIAL' },
  { date: '2026-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
  { date: '2026-05-01', name: 'Labor Day', type: 'REGULAR' },
  { date: '2026-05-27', name: "Eid'l Adha (approx.)", type: 'REGULAR' },
  { date: '2026-06-12', name: 'Independence Day', type: 'REGULAR' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day', type: 'SPECIAL' },
  { date: '2026-08-31', name: 'National Heroes Day', type: 'REGULAR' },
  { date: '2026-11-01', name: "All Saints' Day", type: 'SPECIAL' },
  { date: '2026-11-02', name: "All Souls' Day", type: 'SPECIAL' },
  { date: '2026-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'SPECIAL' },
  { date: '2026-12-24', name: 'Christmas Eve', type: 'SPECIAL' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'REGULAR' },
  { date: '2026-12-30', name: 'Rizal Day', type: 'REGULAR' },
  { date: '2026-12-31', name: 'Last Day of the Year', type: 'SPECIAL' },
];

export const LEAVE_TYPES = [
  { code: 'VL', name: 'Vacation leave', defaultDays: '15', paid: true },
  { code: 'SL', name: 'Sick leave', defaultDays: '15', paid: true },
  { code: 'SIL', name: 'Service incentive leave', defaultDays: '5', paid: true },
] as const;

export const MALE_NAMES = [
  'Juan',
  'Mark',
  'Carlo',
  'Paolo',
  'Rodel',
  'Jerome',
  'Christian',
  'John Paul',
  'Mark Anthony',
  'Joshua',
  'Angelo',
  'Kevin',
  'Ryan',
  'Jayson',
  'Arnel',
  'Reynaldo',
  'Eduardo',
  'Fernando',
  'Rogelio',
  'Danilo',
  'Vincent',
  'Kenneth',
  'Francis',
  'Michael',
  'Allan',
  'Dennis',
  'Nestor',
  'Ronald',
  'Jericho',
  'Emmanuel',
  'Gilbert',
  'Noel',
  'Randy',
  'Rommel',
  'Joel',
  'Alvin',
  'Marvin',
  'Jomar',
  'Raffy',
  'Benjie',
];

export const FEMALE_NAMES = [
  'Maria',
  'Ana',
  'Grace',
  'Kristine',
  'Liza',
  'Liezl',
  'Mary Joy',
  'Jocelyn',
  'Rowena',
  'Maricel',
  'Cherry',
  'Angelica',
  'Nicole',
  'Camille',
  'Jasmine',
  'Kimberly',
  'Rhea',
  'Lovely',
  'Janine',
  'Joanna',
  'Rosalie',
  'Evelyn',
  'Charmaine',
  'Precious',
  'April',
  'Maribel',
  'Sheila',
  'Divina',
  'Hazel',
  'Irene',
  'Leah',
  'Ruby',
  'Aileen',
  'Josephine',
  'Christine',
  'Analyn',
  'Mylene',
  'Jennifer',
  'Regine',
  'Bea',
];

export const SURNAMES = [
  'Santos',
  'Cruz',
  'Garcia',
  'Mendoza',
  'Tan',
  'Lim',
  'Aquino',
  'Ramos',
  'Castillo',
  'Flores',
  'Gonzales',
  'Rivera',
  'Navarro',
  'Torres',
  'Domingo',
  'Cabahug',
  'Ybañez',
  'Abella',
  'Sarmiento',
  'Villamor',
  'Rosales',
  'Tabada',
  'Lapitan',
  'Pepito',
  'Bacus',
  'Cuizon',
  'Alburo',
  'Lumapas',
  'Gabisan',
  'Ouano',
  'Sanchez',
  'Montecillo',
  'Velez',
  'Borromeo',
  'Ceniza',
  'Ypil',
  'Maglasang',
  'Tiongco',
  'Go',
  'Sy',
  'Uy',
  'Chiong',
  'Espina',
  'Quijano',
  'Patalinghug',
  'Canete',
  'Dumdum',
  'Labra',
  'Fernandez',
  'Pardillo',
];
