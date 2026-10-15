// MSMA's full-time employees, from the FT_MSMA payroll register (Payroll Template, sample data with
// fictitious names). Monthly salary, class (department) and position come from the register; transport
// allowance (column P), de minimis and other non-taxable pay (sheet D) and the per-cut-off loan and cash
// advance amounts (sheets C and CA) are what that register deducts each cut-off. Partners are not on it.
// Fifteen of them take over an existing demo record (same ID) so sample leave, attendance and the demo
// logins stay linked: the employee login is Danica Bernardo, the approver login Lorraine Santos.

export type RosterClass = "AAD" | "BAS" | "BSE" | "SUP";

export interface RosterEntry {
  id: string;
  /** Row number in the register. */
  no: number;
  firstName: string;
  lastName: string;
  class: RosterClass;
  department: string;
  cluster: "ADS" | "RPM" | "VCM";
  position: string;
  /** Who they report to ("admin" = their cluster's partner). */
  reportsToId: string;
  monthly: number;
  /** Per cut-off. */
  transport: number;
  deMinimis: number;
  otherNonTaxable: number;
  cashAdvance: number;
  sssLoan: number;
  pagibigLoan: number;
}

/** Department per register class: AAD Audit & Assurance, BAS BSS-Accounting Services, BSE BSS-Special Engagements, SUP Support Services. */
export const CLASS_DEPARTMENT: Record<RosterClass, string> = {"AAD":"Audit & Assurance","BAS":"Accounting Services","BSE":"Special Engagements","SUP":"Support Services"};

export const MSMA_ROSTER: RosterEntry[] = [
  { id: "MSMA-00317", no: 1, firstName: "Lorraine", lastName: "Santos", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Director 1", reportsToId: "admin", monthly: 46750, transport: 0, deMinimis: 3700, otherNonTaxable: 5969.7, cashAdvance: 3718.75, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01002", no: 2, firstName: "Teresa", lastName: "Hernandez", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate Director 1", reportsToId: "admin", monthly: 61000, transport: 0, deMinimis: 3700, otherNonTaxable: 4994.7, cashAdvance: 0, sssLoan: 892.5, pagibigLoan: 0 },
  { id: "MSMA-00098", no: 3, firstName: "Irene", lastName: "Lopez", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Senior Associate 3", reportsToId: "MSMA-01002", monthly: 32250, transport: 0, deMinimis: 3700, otherNonTaxable: 2444.7, cashAdvance: 0, sssLoan: 654.5, pagibigLoan: 0 },
  { id: "MSMA-00812", no: 4, firstName: "Liza", lastName: "Estrada", class: "SUP", department: "Support Services", cluster: "ADS", position: "Senior Admin Associate 1", reportsToId: "admin", monthly: 25500, transport: 0, deMinimis: 3700, otherNonTaxable: 0, cashAdvance: 1190, sssLoan: 850.47, pagibigLoan: 172.75 },
  { id: "MSMA-00845", no: 5, firstName: "Dennis", lastName: "Gatchalian", class: "SUP", department: "Support Services", cluster: "ADS", position: "Admin Associate 3", reportsToId: "admin", monthly: 18750, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 682.47, pagibigLoan: 518.14 },
  { id: "MSMA-00733", no: 6, firstName: "Nathan", lastName: "Castillo", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Senior Associate 1", reportsToId: "admin", monthly: 42750, transport: 2975, deMinimis: 3700, otherNonTaxable: 1406.25, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01007", no: 7, firstName: "Arlene", lastName: "Ramos", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate Director 3", reportsToId: "admin", monthly: 46750, transport: 0, deMinimis: 0, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00482", no: 8, firstName: "Victor", lastName: "Mangubat", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Audit Associate 2", reportsToId: "MSMA-00317", monthly: 31250, transport: 2000, deMinimis: 3700, otherNonTaxable: 1968.75, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00560", no: 9, firstName: "Katrina", lastName: "Enriquez", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Audit Associate 2", reportsToId: "MSMA-00317", monthly: 21500, transport: 0, deMinimis: 3700, otherNonTaxable: 1687.5, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00611", no: 10, firstName: "Andrea Joy", lastName: "Aquino", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 2", reportsToId: "admin", monthly: 31000, transport: 1785, deMinimis: 3700, otherNonTaxable: 1912.5, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00203", no: 11, firstName: "Trisha Mae", lastName: "Jimenez", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 2", reportsToId: "MSMA-00317", monthly: 14500, transport: 1785, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01012", no: 12, firstName: "Ivan Luis", lastName: "Feliciano", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 2", reportsToId: "admin", monthly: 31000, transport: 1785, deMinimis: 3700, otherNonTaxable: 1912.5, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00623", no: 13, firstName: "Gino", lastName: "Ocampo", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Audit Associate 2", reportsToId: "MSMA-01002", monthly: 21000, transport: 0, deMinimis: 3700, otherNonTaxable: 1912.5, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01014", no: 14, firstName: "Marvin", lastName: "Cabrera", class: "SUP", department: "Support Services", cluster: "ADS", position: "IT Admin Associate 1", reportsToId: "admin", monthly: 21000, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00701", no: 15, firstName: "Dominic", lastName: "Marquez", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate 1", reportsToId: "MSMA-01002", monthly: 16250, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01016", no: 16, firstName: "Francis Ian", lastName: "Domingo", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate 1", reportsToId: "MSMA-01002", monthly: 0, transport: 0, deMinimis: 0, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01017", no: 17, firstName: "Benedict", lastName: "Pascual", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 1", reportsToId: "MSMA-00317", monthly: 14500, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01018", no: 18, firstName: "Paolo", lastName: "Alcantara", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate 1", reportsToId: "MSMA-01002", monthly: 14500, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00276", no: 19, firstName: "Olive", lastName: "Navarro", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 1", reportsToId: "MSMA-00317", monthly: 23250, transport: 595, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00341", no: 20, firstName: "Harold", lastName: "Lagman", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 1", reportsToId: "MSMA-00317", monthly: 15000, transport: 1190, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01021", no: 21, firstName: "Sheila", lastName: "Nepomuceno", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate 1", reportsToId: "MSMA-01002", monthly: 16750, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01022", no: 22, firstName: "Rachel Ann", lastName: "Mercado", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate 1", reportsToId: "MSMA-01002", monthly: 14500, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01023", no: 23, firstName: "Hannah Mae", lastName: "Fajardo", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Audit Associate 1", reportsToId: "MSMA-01002", monthly: 18750, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00398", no: 24, firstName: "Isabel", lastName: "Escobar", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 1", reportsToId: "MSMA-00317", monthly: 16000, transport: 1190, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01025", no: 25, firstName: "Cedric", lastName: "Legaspi", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Audit Associate 1", reportsToId: "MSMA-01002", monthly: 18000, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01026", no: 26, firstName: "Pauline", lastName: "Ignacio", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 1", reportsToId: "admin", monthly: 28750, transport: 3500, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01027", no: 27, firstName: "Camille Therese", lastName: "Guevarra", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Audit Associate 1", reportsToId: "MSMA-00317", monthly: 22000, transport: 1190, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01028", no: 28, firstName: "Patricia Anne", lastName: "Canlas", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 1", reportsToId: "admin", monthly: 14000, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01029", no: 29, firstName: "Bianca Louise", lastName: "Arcilla", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 1", reportsToId: "admin", monthly: 28750, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01030", no: 30, firstName: "Regine", lastName: "Cortez", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Audit Associate 1", reportsToId: "MSMA-00317", monthly: 26750, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01031", no: 31, firstName: "Mika", lastName: "Pacheco", class: "SUP", department: "Support Services", cluster: "ADS", position: "Admin Associate 1", reportsToId: "admin", monthly: 20250, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01032", no: 32, firstName: "Carlo Miguel", lastName: "Abad", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 1", reportsToId: "admin", monthly: 18000, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01033", no: 33, firstName: "Leo", lastName: "Francisco", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Audit Associate 1", reportsToId: "MSMA-01002", monthly: 17250, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01034", no: 34, firstName: "Kevin Paul", lastName: "Bacani", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 1", reportsToId: "MSMA-00317", monthly: 22500, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01035", no: 35, firstName: "Gwen", lastName: "Quinto", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Audit Associate 1", reportsToId: "MSMA-00317", monthly: 28750, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01036", no: 36, firstName: "Samuel James", lastName: "Dizon", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 1", reportsToId: "admin", monthly: 29500, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01037", no: 37, firstName: "Oscar", lastName: "Calderon", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Audit Associate 1", reportsToId: "admin", monthly: 14500, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01038", no: 38, firstName: "Albert John", lastName: "Panganiban", class: "SUP", department: "Support Services", cluster: "ADS", position: "Admin Associate 1", reportsToId: "admin", monthly: 22000, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-00846", no: 39, firstName: "Danica", lastName: "Bernardo", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Associate 1", reportsToId: "MSMA-00317", monthly: 15500, transport: 892.5, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01040", no: 40, firstName: "Gerald", lastName: "Evangelista", class: "AAD", department: "Audit & Assurance", cluster: "VCM", position: "Audit Associate 1", reportsToId: "MSMA-00317", monthly: 29500, transport: 0, deMinimis: 3217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01041", no: 41, firstName: "Wendy", lastName: "Lacson", class: "SUP", department: "Support Services", cluster: "ADS", position: "HR Associate", reportsToId: "admin", monthly: 22000, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01042", no: 42, firstName: "Clarisse", lastName: "Buenaventura", class: "BAS", department: "Accounting Services", cluster: "RPM", position: "Associate 1", reportsToId: "MSMA-01002", monthly: 13500, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01043", no: 43, firstName: "Stephen", lastName: "Medina", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "Associate 1", reportsToId: "admin", monthly: 22500, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01044", no: 44, firstName: "Noel", lastName: "Quiambao", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "IT Developer 1", reportsToId: "admin", monthly: 24250, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
  { id: "MSMA-01045", no: 45, firstName: "Jasper", lastName: "Macaraeg", class: "BSE", department: "Special Engagements", cluster: "ADS", position: "IT Developer 1", reportsToId: "admin", monthly: 22500, transport: 0, deMinimis: 1217, otherNonTaxable: 0, cashAdvance: 0, sssLoan: 0, pagibigLoan: 0 },
];

export const rosterEntry = (id: string) => MSMA_ROSTER.find((r) => r.id === id);
