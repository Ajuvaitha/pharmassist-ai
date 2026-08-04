// Central Mock Data Store for Pharmassist Module 3 (Inpatient Auto-Indent System)

export const INITIAL_WARDS = [
  { id: 'WARD-ICU-B', name: 'ICU Ward B', floor: '2nd Floor - East Wing', totalBeds: 12, occupiedBeds: 8 },
  { id: 'WARD-GEN-A', name: 'General Surgical Ward A', floor: '3rd Floor - West Wing', totalBeds: 20, occupiedBeds: 15 },
  { id: 'WARD-PED-C', name: 'Pediatric Ward C', floor: '4th Floor - South Wing', totalBeds: 10, occupiedBeds: 6 }
];

export const INITIAL_DRUGS = [
  { id: 'DRUG-1004', name: 'Paracetamol 650mg Tablet', category: 'Analgesic', unitPrice: 15.00, stock: 4500, unitOfMeasure: 'Tablets' },
  { id: 'DRUG-2015', name: 'Ceftriaxone 1g IV Injection', category: 'Antibiotic', unitPrice: 160.00, stock: 800, unitOfMeasure: 'Vials' },
  { id: 'DRUG-3088', name: 'Pantoprazole 40mg IV', category: 'Gastroprotective', unitPrice: 85.00, stock: 520, unitOfMeasure: 'Vials' },
  { id: 'DRUG-4012', name: 'Amoxicillin 500mg Capsule', category: 'Antibiotic', unitPrice: 22.00, stock: 3100, unitOfMeasure: 'Capsules' },
  { id: 'DRUG-5099', name: 'Ondansetron 4mg IV', category: 'Antiemetic', unitPrice: 45.00, stock: 950, unitOfMeasure: 'Ampoules' }
];

export const INITIAL_PATIENTS = [
  {
    patient_id: 'PAT-9082',
    patient_name: 'Sarah Jenkins',
    age: 42,
    gender: 'Female',
    bed_number: 'Bed 205',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    diagnosis: 'Acute Bacterial Pneumonia',
    admission_date: '2026-08-03'
  },
  {
    patient_id: 'PAT-9085',
    patient_name: 'Robert Miller',
    age: 61,
    gender: 'Male',
    bed_number: 'Bed 208',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    diagnosis: 'Post-Operative Abdominal Repair',
    admission_date: '2026-08-01'
  },
  {
    patient_id: 'PAT-9090',
    patient_name: 'Anita Desai',
    age: 35,
    gender: 'Female',
    bed_number: 'Bed 212',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    diagnosis: 'Severe Gastritis',
    admission_date: '2026-08-01'
  },
  {
    patient_id: 'PAT-8812',
    patient_name: 'David Kim',
    age: 54,
    gender: 'Male',
    bed_number: 'Bed 102',
    ward_id: 'WARD-GEN-A',
    ward_name: 'General Surgical Ward A',
    diagnosis: 'Laparoscopic Cholecystectomy',
    admission_date: '2026-08-02'
  }
];

export const INITIAL_PRESCRIPTIONS = [
  {
    rx_id: 'RX-88410',
    patient_id: 'PAT-9082',
    patient_name: 'Sarah Jenkins',
    bed_number: 'Bed 205',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    drug_id: 'DRUG-1004',
    drug_name: 'Paracetamol 650mg Tablet',
    daily_dosage_qty: 3,
    frequency_code: 'TID',
    frequency_desc: 'Three times daily (Every 8h)',
    start_date: '2026-08-04',
    current_day: 1,
    total_prescribed_days: 7,
    prescribing_doctor: 'Dr. Aris Thorne (DOC-402)',
    status: 'ACTIVE',
    notes: 'Post-meals with full glass of water.'
  },
  {
    rx_id: 'RX-88411',
    patient_id: 'PAT-9085',
    patient_name: 'Robert Miller',
    bed_number: 'Bed 208',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    drug_id: 'DRUG-2015',
    drug_name: 'Ceftriaxone 1g IV Injection',
    daily_dosage_qty: 2,
    frequency_code: 'Q12H',
    frequency_desc: 'Every 12 hours IV push',
    start_date: '2026-08-02',
    current_day: 3,
    total_prescribed_days: 5,
    prescribing_doctor: 'Dr. Elena Rostova (DOC-109)',
    status: 'ACTIVE',
    notes: 'Reconstitute with sterile 10ml saline.'
  },
  {
    rx_id: 'RX-88412',
    patient_id: 'PAT-9090',
    patient_name: 'Anita Desai',
    bed_number: 'Bed 212',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    drug_id: 'DRUG-3088',
    drug_name: 'Pantoprazole 40mg IV',
    daily_dosage_qty: 1,
    frequency_code: 'QD',
    frequency_desc: 'Once daily early morning',
    start_date: '2026-08-01',
    current_day: 4,
    total_prescribed_days: 7,
    prescribing_doctor: 'Dr. Marcus Vance (DOC-305)',
    status: 'ACTIVE',
    notes: 'Give before morning sweep.'
  },
  {
    rx_id: 'RX-88390',
    patient_id: 'PAT-8812',
    patient_name: 'David Kim',
    bed_number: 'Bed 102',
    ward_id: 'WARD-GEN-A',
    ward_name: 'General Surgical Ward A',
    drug_id: 'DRUG-4012',
    drug_name: 'Amoxicillin 500mg Capsule',
    daily_dosage_qty: 3,
    frequency_code: 'TID',
    frequency_desc: 'Every 8 hours',
    start_date: '2026-08-02',
    current_day: 3,
    total_prescribed_days: 7,
    prescribing_doctor: 'Dr. Sarah Connor (DOC-204)',
    status: 'ACTIVE',
    notes: 'Take after meals.'
  }
];

export const INITIAL_CONSOLIDATED_PICKUPS = {
  'WARD-ICU-B': {
    indent_batch_id: 'IND-20260804-ICUB',
    date: '2026-08-04',
    ward_id: 'WARD-ICU-B',
    ward_name: 'ICU Ward B',
    status: 'READY_FOR_PICKUP',
    items: [
      {
        drug_id: 'DRUG-1004',
        drug_name: 'Paracetamol 650mg Tablet',
        total_qty_needed: 3,
        unit: 'Tablets',
        patient_breakdown: [
          { patient_id: 'PAT-9082', patient_name: 'Sarah Jenkins', bed_number: 'Bed 205', treatment_day: 'Day 1 of 7', qty: 3 }
        ]
      },
      {
        drug_id: 'DRUG-2015',
        drug_name: 'Ceftriaxone 1g IV Injection',
        total_qty_needed: 2,
        unit: 'Vials',
        patient_breakdown: [
          { patient_id: 'PAT-9085', patient_name: 'Robert Miller', bed_number: 'Bed 208', treatment_day: 'Day 3 of 5', qty: 2 }
        ]
      },
      {
        drug_id: 'DRUG-3088',
        drug_name: 'Pantoprazole 40mg IV',
        total_qty_needed: 1,
        unit: 'Vials',
        patient_breakdown: [
          { patient_id: 'PAT-9090', patient_name: 'Anita Desai', bed_number: 'Bed 212', treatment_day: 'Day 4 of 7', qty: 1 }
        ]
      }
    ]
  },
  'WARD-GEN-A': {
    indent_batch_id: 'IND-20260804-GENA',
    date: '2026-08-04',
    ward_id: 'WARD-GEN-A',
    ward_name: 'General Surgical Ward A',
    status: 'READY_FOR_PICKUP',
    items: [
      {
        drug_id: 'DRUG-4012',
        drug_name: 'Amoxicillin 500mg Capsule',
        total_qty_needed: 3,
        unit: 'Capsules',
        patient_breakdown: [
          { patient_id: 'PAT-8812', patient_name: 'David Kim', bed_number: 'Bed 102', treatment_day: 'Day 3 of 7', qty: 3 }
        ]
      }
    ]
  }
};

export const INITIAL_BILLING_TRANSACTIONS = [
  {
    transaction_id: 'TXN-9001',
    indent_batch_id: 'IND-20260804-ICUB',
    patient_id: 'PAT-9082',
    patient_name: 'Sarah Jenkins',
    bed_number: 'Bed 205',
    ward_name: 'ICU Ward B',
    drug_name: 'Paracetamol 650mg Tablet',
    qty: 3,
    unit_price: 15.00,
    amount_billed: 45.00,
    timestamp: '2026-08-04T06:45:12Z',
    status: 'POSTED_TO_IPD_BILL'
  },
  {
    transaction_id: 'TXN-9002',
    indent_batch_id: 'IND-20260804-ICUB',
    patient_id: 'PAT-9085',
    patient_name: 'Robert Miller',
    bed_number: 'Bed 208',
    ward_name: 'ICU Ward B',
    drug_name: 'Ceftriaxone 1g IV Injection',
    qty: 2,
    unit_price: 160.00,
    amount_billed: 320.00,
    timestamp: '2026-08-04T06:45:12Z',
    status: 'POSTED_TO_IPD_BILL'
  },
  {
    transaction_id: 'TXN-9003',
    indent_batch_id: 'IND-20260804-ICUB',
    patient_id: 'PAT-9090',
    patient_name: 'Anita Desai',
    bed_number: 'Bed 212',
    ward_name: 'ICU Ward B',
    drug_name: 'Pantoprazole 40mg IV',
    qty: 1,
    unit_price: 85.00,
    amount_billed: 85.00,
    timestamp: '2026-08-04T06:45:12Z',
    status: 'POSTED_TO_IPD_BILL'
  }
];
