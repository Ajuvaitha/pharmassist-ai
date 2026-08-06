/**
 * Seed values lifted from the pre-backend frontend/src/data.ts.
 *
 * Prices for the seven drugs that appeared in the old TRANSACTIONS array
 * are carried over verbatim. The other eight had no price anywhere, so
 * they are assigned here — explicitly, once, rather than defaulted at
 * runtime where a wrong number would silently reach a patient's bill.
 */

export const WARDS = [
  { code: 'Ward 4A', name: 'General Medicine' },
  { code: 'Ward 5B', name: 'Cardiology' },
  { code: 'Ward 6C', name: 'Orthopaedics' },
  { code: 'Ward 2D', name: 'Oncology' },
] as const

export const DRUGS = [
  { label: 'Amoxicillin 500mg',    name: 'Amoxicillin',    strength: '500mg',  form: 'Capsule', category: 'Antibiotics',       unitPrice: '0.85' },
  { label: 'Furosemide 40mg',      name: 'Furosemide',     strength: '40mg',   form: 'Tablet',  category: 'Diuretics',         unitPrice: '0.30' },
  { label: 'Metformin 500mg',      name: 'Metformin',      strength: '500mg',  form: 'Tablet',  category: 'Antidiabetics',     unitPrice: '0.42' },
  { label: 'Lisinopril 10mg',      name: 'Lisinopril',     strength: '10mg',   form: 'Tablet',  category: 'Antihypertensives', unitPrice: '0.38' },
  { label: 'Tramadol 50mg',        name: 'Tramadol',       strength: '50mg',   form: 'Capsule', category: 'Analgesics',        unitPrice: '0.65' },
  { label: 'Atorvastatin 40mg',    name: 'Atorvastatin',   strength: '40mg',   form: 'Tablet',  category: 'Lipid-lowering',    unitPrice: '1.20' },
  { label: 'Aspirin 75mg',         name: 'Aspirin',        strength: '75mg',   form: 'Tablet',  category: 'Antiplatelets',     unitPrice: '0.12' },
  { label: 'Clopidogrel 75mg',     name: 'Clopidogrel',    strength: '75mg',   form: 'Tablet',  category: 'Antiplatelets',     unitPrice: '1.45' },
  { label: 'Bisoprolol 5mg',       name: 'Bisoprolol',     strength: '5mg',    form: 'Tablet',  category: 'Beta-blockers',     unitPrice: '0.55' },
  { label: 'Ondansetron 8mg',      name: 'Ondansetron',    strength: '8mg',    form: 'Tablet',  category: 'Antiemetics',       unitPrice: '2.10' },
  { label: 'Dexamethasone 4mg',    name: 'Dexamethasone',  strength: '4mg',    form: 'Tablet',  category: 'Corticosteroids',   unitPrice: '0.48' },
  { label: 'Spironolactone 25mg',  name: 'Spironolactone', strength: '25mg',   form: 'Tablet',  category: 'Diuretics',         unitPrice: '0.60' },
  { label: 'Digoxin 0.25mg',       name: 'Digoxin',        strength: '0.25mg', form: 'Tablet',  category: 'Cardiac glycosides', unitPrice: '0.35' },
  { label: 'Ibuprofen 400mg',      name: 'Ibuprofen',      strength: '400mg',  form: 'Tablet',  category: 'Analgesics',        unitPrice: '0.20' },
  { label: 'Metoclopramide 10mg',  name: 'Metoclopramide', strength: '10mg',   form: 'Tablet',  category: 'Antiemetics',       unitPrice: '0.28' },
] as const

/**
 * The first twelve rows carry the stock levels from the old INVENTORY
 * array. The last three are new: those drugs were prescribed but had no
 * inventory row at all, which would make dispensing them impossible.
 */
export const INVENTORY = [
  { drug: 'Amoxicillin 500mg',   currentStock: 340, reorderLevel: 100 },
  { drug: 'Furosemide 40mg',     currentStock: 52,  reorderLevel: 100 },
  { drug: 'Metformin 500mg',     currentStock: 210, reorderLevel: 100 },
  { drug: 'Lisinopril 10mg',     currentStock: 18,  reorderLevel: 50 },
  { drug: 'Tramadol 50mg',       currentStock: 95,  reorderLevel: 100 },
  { drug: 'Atorvastatin 40mg',   currentStock: 288, reorderLevel: 80 },
  { drug: 'Aspirin 75mg',        currentStock: 412, reorderLevel: 100 },
  { drug: 'Clopidogrel 75mg',    currentStock: 7,   reorderLevel: 50 },
  { drug: 'Bisoprolol 5mg',      currentStock: 156, reorderLevel: 80 },
  { drug: 'Ondansetron 8mg',     currentStock: 64,  reorderLevel: 80 },
  { drug: 'Dexamethasone 4mg',   currentStock: 89,  reorderLevel: 60 },
  { drug: 'Spironolactone 25mg', currentStock: 3,   reorderLevel: 50 },
  { drug: 'Digoxin 0.25mg',      currentStock: 120, reorderLevel: 40 },
  { drug: 'Ibuprofen 400mg',     currentStock: 260, reorderLevel: 80 },
  { drug: 'Metoclopramide 10mg', currentStock: 140, reorderLevel: 60 },
] as const

/**
 * Every seeded account uses this password. Development only — the seed
 * refuses to run against NODE_ENV=production.
 */
export const SEED_PASSWORD = 'pharmassist'

export const USERS = [
  { username: 'k.asante',      displayName: 'K. Asante',        role: 'pharmacist', wardCode: null },
  { username: 'a.owusu',       displayName: 'A. Owusu',         role: 'nurse',      wardCode: 'Ward 4A' },
  { username: 'y.darko',       displayName: 'Y. Darko',         role: 'nurse',      wardCode: 'Ward 5B' },
  { username: 'b.kwame',       displayName: 'Dr. B. Kwame',     role: 'doctor',     wardCode: null },
  { username: 'e.asare',       displayName: 'Dr. E. Asare',     role: 'doctor',     wardCode: null },
  { username: 's.acheampong',  displayName: 'Dr. S. Acheampong', role: 'doctor',    wardCode: null },
  { username: 'a.boateng',     displayName: 'Dr. A. Boateng',   role: 'doctor',     wardCode: null },
] as const

export const PATIENTS = [
  {
    mrn: 'MRN-004821', name: 'Margaret Osei', dateOfBirth: '1968-03-14', gender: 'Female',
    phone: '+233 24 456 7890', wardCode: 'Ward 4A', bed: 'Bed 04', admissionDate: '2026-07-29',
    diagnosis: 'Type 2 Diabetes Mellitus, Hypertension', allergies: 'Penicillin',
    prescriptions: [
      { drug: 'Amoxicillin 500mg', dose: '500mg', route: 'Oral', frequency: 'TDS', foodTiming: 'after-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-07-29', durationDays: 7, status: 'active', notes: 'Complete full course even if symptoms improve.', prescribedBy: 'b.kwame', prescribedAt: '2026-07-29T08:15:00Z' },
      { drug: 'Metformin 500mg', dose: '500mg', route: 'Oral', frequency: 'BD', foodTiming: 'with-food', timeOfDay: ['morning', 'night'], startDate: '2026-07-29', durationDays: 14, status: 'active', notes: 'Monitor blood glucose. Hold if eGFR falls below 30.', prescribedBy: 'b.kwame', prescribedAt: '2026-07-29T08:15:00Z' },
      { drug: 'Lisinopril 10mg', dose: '10mg', route: 'Oral', frequency: 'OD', foodTiming: 'not-applicable', timeOfDay: ['morning'], startDate: '2026-07-29', durationDays: 14, status: 'active', notes: 'Check BP before each dose. Hold if systolic < 90 mmHg.', prescribedBy: 'b.kwame', prescribedAt: '2026-07-29T08:15:00Z' },
    ],
  },
  {
    mrn: 'MRN-003145', name: 'James Kofi Antwi', dateOfBirth: '1952-11-07', gender: 'Male',
    phone: '+233 20 345 6789', wardCode: 'Ward 4A', bed: 'Bed 07', admissionDate: '2026-08-01',
    diagnosis: 'Congestive Heart Failure (NYHA Class III)', allergies: 'None known',
    prescriptions: [
      { drug: 'Furosemide 40mg', dose: '40mg', route: 'Oral', frequency: 'OD', foodTiming: 'not-applicable', timeOfDay: ['morning'], startDate: '2026-08-01', durationDays: 5, status: 'active', notes: 'Administer early morning. Monitor fluid balance and electrolytes daily.', prescribedBy: 'b.kwame', prescribedAt: '2026-08-01T07:30:00Z' },
      { drug: 'Spironolactone 25mg', dose: '25mg', route: 'Oral', frequency: 'OD', foodTiming: 'with-food', timeOfDay: ['morning'], startDate: '2026-08-01', durationDays: 5, status: 'active', notes: 'Monitor potassium levels closely.', prescribedBy: 'b.kwame', prescribedAt: '2026-08-01T07:30:00Z' },
      { drug: 'Digoxin 0.25mg', dose: '0.25mg', route: 'Oral', frequency: 'OD', foodTiming: 'before-food', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 3, status: 'stopped', stopReason: 'Toxicity suspected — digoxin level 3.1 ng/mL', prescribedBy: 'b.kwame', prescribedAt: '2026-07-31T09:00:00Z' },
    ],
  },
  {
    mrn: 'MRN-007302', name: 'Abena Frimpong', dateOfBirth: '1975-06-22', gender: 'Female',
    phone: '+233 27 891 2345', wardCode: 'Ward 5B', bed: 'Bed 12', admissionDate: '2026-07-31',
    diagnosis: 'Acute Myocardial Infarction (NSTEMI)', allergies: 'Sulfonamides',
    prescriptions: [
      { drug: 'Atorvastatin 40mg', dose: '40mg', route: 'Oral', frequency: 'ON', foodTiming: 'not-applicable', timeOfDay: ['night'], startDate: '2026-07-31', durationDays: 14, status: 'active', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
      { drug: 'Aspirin 75mg', dose: '75mg', route: 'Oral', frequency: 'OD', foodTiming: 'after-food', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 14, status: 'active', notes: 'Do not crush. Take with a full glass of water.', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
      { drug: 'Clopidogrel 75mg', dose: '75mg', route: 'Oral', frequency: 'OD', foodTiming: 'after-food', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 14, status: 'active', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
      { drug: 'Bisoprolol 5mg', dose: '5mg', route: 'Oral', frequency: 'OD', foodTiming: 'not-applicable', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 14, status: 'active', notes: 'Check resting HR before dose. Hold if HR < 50 bpm.', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
    ],
  },
  {
    mrn: 'MRN-009881', name: 'Kwame Asante', dateOfBirth: '1989-09-03', gender: 'Male',
    phone: '+233 55 234 5678', wardCode: 'Ward 6C', bed: 'Bed 03', admissionDate: '2026-08-02',
    diagnosis: 'Right femur fracture, post-ORIF', allergies: 'None known',
    prescriptions: [
      { drug: 'Tramadol 50mg', dose: '50mg', route: 'Oral', frequency: 'QDS', foodTiming: 'after-food', timeOfDay: ['morning', 'afternoon', 'evening', 'night'], startDate: '2026-08-02', durationDays: 5, status: 'active', notes: 'Max 400mg/day. Avoid alcohol. May cause drowsiness.', prescribedBy: 's.acheampong', prescribedAt: '2026-08-02T14:00:00Z' },
      { drug: 'Ibuprofen 400mg', dose: '400mg', route: 'Oral', frequency: 'TDS', foodTiming: 'after-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-08-02', durationDays: 5, status: 'active', notes: 'Take with food or milk to reduce GI upset.', prescribedBy: 's.acheampong', prescribedAt: '2026-08-02T14:00:00Z' },
    ],
  },
  {
    mrn: 'MRN-002017', name: 'Esi Mensah', dateOfBirth: '1961-01-28', gender: 'Female',
    phone: '+233 24 678 9012', wardCode: 'Ward 2D', bed: 'Bed 09', admissionDate: '2026-07-20',
    diagnosis: 'Breast carcinoma, cycle 3 chemotherapy', allergies: 'Codeine',
    prescriptions: [
      { drug: 'Ondansetron 8mg', dose: '8mg', route: 'Oral', frequency: 'TDS', foodTiming: 'before-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-07-20', durationDays: 21, status: 'active', notes: 'Give 30 min before meals to prevent chemotherapy-induced nausea.', prescribedBy: 'a.boateng', prescribedAt: '2026-07-20T09:00:00Z' },
      { drug: 'Metoclopramide 10mg', dose: '10mg', route: 'Oral', frequency: 'TDS', foodTiming: 'before-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-07-20', durationDays: 21, status: 'active', prescribedBy: 'a.boateng', prescribedAt: '2026-07-20T09:00:00Z' },
      { drug: 'Dexamethasone 4mg', dose: '4mg', route: 'Oral', frequency: 'OD', foodTiming: 'after-food', timeOfDay: ['morning'], startDate: '2026-07-20', durationDays: 21, status: 'active', notes: 'Taper dose in final 3 days. Do not stop abruptly.', prescribedBy: 'a.boateng', prescribedAt: '2026-07-20T09:00:00Z' },
    ],
  },
] as const
