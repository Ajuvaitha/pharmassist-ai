# 🏥 Module 3: Inpatient Medication Dispensing & Daily Auto-Indent System
## Complete Technical Specification, Database Logic & API Documentation

> **Note for Friend / Engineering Team:**  
> This document contains the full architecture, database logic, complete REST API endpoint definitions, and realistic JSON dummy data payloads for **Module 3 (Inpatient Medication Dispensing & Daily Auto-Indent System)** of the **Pharmassist** hospital logistics platform.

---

## 📋 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [System Architecture & Core Workflows](#2-system-architecture--core-workflows)
3. [Operational Comparison Matrix](#3-operational-comparison-matrix)
4. [Database Logic & Automated Sweep Query](#4-database-logic--automated-sweep-query)
5. [Complete REST API Endpoint Reference](#5-complete-rest-api-endpoint-reference)
   - [5.1 Create Digital Inpatient Prescription](#51-create-digital-inpatient-prescription)
   - [5.2 List Active Inpatient Prescriptions](#52-list-active-inpatient-prescriptions)
   - [5.3 Trigger / View Morning Ward Indent Sweep (6:00 AM)](#53-trigger--view-morning-ward-indent-sweep-600-am)
   - [5.4 Get Ward Consolidated Pickup List](#54-get-ward-consolidated-pickup-list)
   - [5.5 Confirm Pharmacy Dispense & Auto-Billing](#55-confirm-pharmacy-dispense--auto-billing)
   - [5.6 Real-Time Stop-Order / Cancel Prescription](#56-real-time-stop-order--cancel-prescription)
6. [Realistic Sample Payloads & Dummy Data](#6-realistic-sample-payloads--dummy-data)
7. [Integration Code Examples (JavaScript & cURL)](#7-integration-code-examples-javascript--curl)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Challenge in Inpatient Wards
In hospital inpatient wards (IPD), attending physicians routinely prescribe multi-day treatment courses (e.g., a 7-day antibiotic course). However, central hospital pharmacies **cannot safely issue all 7 days of medication up front** due to:
- **Mid-course dosage adjustments & cancellations** when patient condition changes.
- **Limited bedside storage space** and risk of drug mix-ups between patients.
- **Early patient discharges** resulting in unreturned, wasted drugs.
- **Upfront billing complications** and cumbersome refund processing.

### 1.2 The Manual Bottleneck
Hospitals traditionally rely on **daily unit-dose dispensing**, but the manual process creates heavy friction:
- 📝 **Daily Paperwork Overhead:** Nurses or indent students spend **1.5 to 2 hours every morning** manually reviewing paper patient charts and writing physical indent slips.
- 🧮 **Manual Day Calculations:** High risk of human error calculating whether a patient is on Day 2, Day 3, or Day 7.
- 🚶‍♂️ **Pharmacy Congestion:** Uncoordinated, individual trips between wards and central pharmacy draw nursing staff away from bedside care.
- ⏱️ **Lag in Stop-Orders:** Delayed communication when a doctor cancels an order results in unnecessary medication dispensing and wastage.

---

## 2. System Architecture & Core Workflows

The **Automated Daily Indent Engine** converts multi-day digital prescriptions into 24-hour execution batches and consolidates ward requisitions automatically.

```
┌────────────────────────────────┐
│ 1. Digital Prescription Entry  │  Attending doctor enters prescription into EMR
│    (Paracetamol 650mg, 7 days) │  (Durations & dose schedules registered once)
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ 2. Auto Execution Batching     │  Backend scheduler partitions 7-day order
│    (Day 1 to Day 7 Batches)    │  into individual 24-hour execution batches
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ 3. 6:00 AM Daily Ward Sweep    │  Cron worker sweeps active inpatient orders
│    (Consolidated Ward List)    │  Generates ward-wise digital pickup lists
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ 4. Single-Trip Pickup & Billing│  Pharmacy packs pre-sorted unit-dose pouches
│    (Auto-Stock & Ledger Sync)  │  Single trip pickup + auto daily patient bill
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ 5. Real-Time Stop-Order Sync   │  Doctor cancels on Day 3 → Days 4-7 instantly
│    (Instant Cancellation)      │  marked CANCELLED; no extra pharmacy issuance
└────────────────────────────────┘
```

---

## 3. Operational Comparison Matrix

| Feature / Process Step | Traditional Manual Process | Automated Auto-Indent System |
| :--- | :--- | :--- |
| **Prescription Handling** | Written in bedside physical paper charts; manually transcribed daily. | Entered digitally once in EMR; auto-scheduled by backend engine. |
| **Treatment Day Tracking** | Manual day counting by nurses/students (prone to human error). | Automated calculation: `(CURRENT_DATE - start_date) + 1`. |
| **Ward Requisition** | 1.5–2 hours spent hand-writing paper slips every morning. | **Zero paperwork.** Consolidated digital pickup list ready at 6:00 AM. |
| **Pharmacy Visits** | Multiple uncoordinated trips per bed or small bed group. | **Single consolidated ward pickup trip** per shift. |
| **Patient Billing** | Upfront 7-day billing chaos or manual daily voucher entries. | Automatic per-day deduction & ledger billing upon pharmacy confirmation. |
| **Order Cancellation** | Delayed sync leading to medication over-dispensing. | **Real-time Stop-Order sync:** Pending future batches instantly cancelled. |

---

## 4. Database Logic & Automated Sweep Query

### 4.1 SQL Schema Structure

```sql
CREATE TABLE patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    ward_id VARCHAR(50) NOT NULL,
    ward_name VARCHAR(100) NOT NULL,
    bed_number VARCHAR(20) NOT NULL,
    admission_status VARCHAR(20) DEFAULT 'ADMITTED'
);

CREATE TABLE drugs (
    drug_id VARCHAR(50) PRIMARY KEY,
    drug_name VARCHAR(100) NOT NULL,
    unit_dosage VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL
);

CREATE TABLE inpatient_prescriptions (
    rx_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(patient_id),
    drug_id VARCHAR(50) REFERENCES drugs(drug_id),
    daily_dosage_qty INT NOT NULL, -- e.g., 3 units per day
    frequency_code VARCHAR(20) NOT NULL, -- e.g., "TID" (3x daily)
    start_date DATE NOT NULL,
    total_prescribed_days INT NOT NULL, -- e.g., 7 days
    status VARCHAR(20) DEFAULT 'ACTIVE' -- ACTIVE, COMPLETED, CANCELLED
);

CREATE TABLE daily_indent_batches (
    batch_id VARCHAR(50) PRIMARY KEY,
    rx_id VARCHAR(50) REFERENCES inpatient_prescriptions(rx_id),
    ward_id VARCHAR(50) NOT NULL,
    treatment_day INT NOT NULL,
    indent_date DATE NOT NULL,
    required_qty INT NOT NULL,
    fulfillment_status VARCHAR(20) DEFAULT 'PENDING' -- PENDING, DISPENSED, CANCELLED
);
```

### 4.2 Morning 6:00 AM Automated Ward Indent Generation Query

```sql
-- Scheduled Background Worker Query (Runs daily at 06:00 AM)
SELECT 
    p.ward_id,
    p.ward_name,
    p.bed_number,
    p.patient_id,
    p.patient_name,
    rx.rx_id,
    rx.drug_id,
    d.drug_name,
    d.unit_dosage,
    rx.daily_dosage_qty,
    (CURRENT_DATE - rx.start_date + 1) AS current_treatment_day,
    rx.total_prescribed_days AS total_days
FROM inpatient_prescriptions rx
JOIN patients p ON p.patient_id = rx.patient_id
JOIN drugs d ON d.drug_id = rx.drug_id
WHERE rx.status = 'ACTIVE'
  AND p.admission_status = 'ADMITTED'
  AND (CURRENT_DATE - rx.start_date + 1) BETWEEN 1 AND rx.total_prescribed_days;
```

---

## 5. Complete REST API Endpoint Reference

### Base URL: `https://api.pharmassist.hospital.com/api/v1`

---

### 5.1 Create Digital Inpatient Prescription
- **Endpoint:** `POST /inpatient/prescriptions`
- **Description:** Attending physician registers a multi-day inpatient treatment plan.
- **Request Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt_token>`

#### Request Body Example
```json
{
  "patient_id": "PAT-9082",
  "drug_id": "DRUG-1004",
  "daily_dosage_qty": 3,
  "frequency_code": "TID",
  "frequency_description": "Every 8 hours",
  "start_date": "2026-08-04",
  "total_prescribed_days": 7,
  "prescribing_doctor_id": "DOC-402",
  "notes": "Administer post-meals"
}
```

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "message": "Inpatient prescription created successfully & 7 daily batches scheduled.",
  "data": {
    "rx_id": "RX-88410",
    "patient_id": "PAT-9082",
    "patient_name": "Sarah Jenkins",
    "bed_number": "Bed 205",
    "ward_name": "ICU Ward B",
    "drug_name": "Paracetamol 650mg",
    "daily_dosage_qty": 3,
    "total_prescribed_days": 7,
    "total_units_allocated": 21,
    "start_date": "2026-08-04",
    "end_date": "2026-08-10",
    "status": "ACTIVE",
    "created_at": "2026-08-04T08:30:00Z"
  }
}
```

---

### 5.2 List Active Inpatient Prescriptions
- **Endpoint:** `GET /inpatient/prescriptions`
- **Query Parameters:**
  - `ward_id` *(optional)*: e.g., `WARD-ICU-B`
  - `status` *(optional)*: `ACTIVE` | `COMPLETED` | `CANCELLED` (Default: `ACTIVE`)
  - `page`: `1`
  - `limit`: `20`

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "page": 1,
  "limit": 20,
  "total_count": 3,
  "data": [
    {
      "rx_id": "RX-88410",
      "patient_id": "PAT-9082",
      "patient_name": "Sarah Jenkins",
      "bed_number": "Bed 205",
      "ward_id": "WARD-ICU-B",
      "ward_name": "ICU Ward B",
      "drug_id": "DRUG-1004",
      "drug_name": "Paracetamol 650mg Tablet",
      "daily_dosage_qty": 3,
      "start_date": "2026-08-04",
      "current_day": 1,
      "total_prescribed_days": 7,
      "status": "ACTIVE"
    },
    {
      "rx_id": "RX-88411",
      "patient_id": "PAT-9085",
      "patient_name": "Robert Miller",
      "bed_number": "Bed 208",
      "ward_id": "WARD-ICU-B",
      "ward_name": "ICU Ward B",
      "drug_id": "DRUG-2015",
      "drug_name": "Ceftriaxone 1g IV Injection",
      "daily_dosage_qty": 2,
      "start_date": "2026-08-02",
      "current_day": 3,
      "total_prescribed_days": 5,
      "status": "ACTIVE"
    },
    {
      "rx_id": "RX-88412",
      "patient_id": "PAT-9090",
      "patient_name": "Anita Desai",
      "bed_number": "Bed 212",
      "ward_id": "WARD-ICU-B",
      "ward_name": "ICU Ward B",
      "drug_id": "DRUG-3088",
      "drug_name": "Pantoprazole 40mg IV",
      "daily_dosage_qty": 1,
      "start_date": "2026-08-01",
      "current_day": 4,
      "total_prescribed_days": 7,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 5.3 Trigger / View Morning Ward Indent Sweep (6:00 AM)
- **Endpoint:** `POST /inpatient/indents/sweep`
- **Description:** Triggers the daily 6:00 AM automated background worker or previews today's calculated ward indents.
- **Request Body:** *(Optional configuration)*
```json
{
  "target_date": "2026-08-04",
  "force_recalculate": false
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "sweep_timestamp": "2026-08-04T06:00:00Z",
  "total_wards_processed": 4,
  "total_patients_included": 48,
  "total_indent_items_generated": 112,
  "status": "COMPLETED",
  "summary_by_ward": [
    {
      "ward_id": "WARD-ICU-B",
      "ward_name": "ICU Ward B",
      "patient_count": 12,
      "indent_batch_id": "IND-20260804-ICUB"
    },
    {
      "ward_id": "WARD-GENERAL-A",
      "ward_name": "General Surgical Ward A",
      "patient_count": 20,
      "indent_batch_id": "IND-20260804-GENA"
    }
  ]
}
```

---

### 5.4 Get Ward Consolidated Pickup List
- **Endpoint:** `GET /inpatient/wards/{ward_id}/pickup-list`
- **Query Parameters:**
  - `date`: `2026-08-04` *(Default: today's date)*

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "indent_batch_id": "IND-20260804-ICUB",
  "date": "2026-08-04",
  "ward_id": "WARD-ICU-B",
  "ward_name": "ICU Ward B",
  "status": "READY_FOR_PICKUP",
  "pickup_summary": {
    "total_unique_drugs": 3,
    "total_unit_pouches": 6
  },
  "consolidated_items": [
    {
      "drug_id": "DRUG-1004",
      "drug_name": "Paracetamol 650mg Tablet",
      "total_qty_needed": 3,
      "unit_of_measure": "Tablets",
      "patient_breakdown": [
        {
          "patient_id": "PAT-9082",
          "patient_name": "Sarah Jenkins",
          "bed_number": "Bed 205",
          "treatment_day": "Day 1 of 7",
          "qty": 3
        }
      ]
    },
    {
      "drug_id": "DRUG-2015",
      "drug_name": "Ceftriaxone 1g IV Injection",
      "total_qty_needed": 2,
      "unit_of_measure": "Vials",
      "patient_breakdown": [
        {
          "patient_id": "PAT-9085",
          "patient_name": "Robert Miller",
          "bed_number": "Bed 208",
          "treatment_day": "Day 3 of 5",
          "qty": 2
        }
      ]
    },
    {
      "drug_id": "DRUG-3088",
      "drug_name": "Pantoprazole 40mg IV",
      "total_qty_needed": 1,
      "unit_of_measure": "Vials",
      "patient_breakdown": [
        {
          "patient_id": "PAT-9090",
          "patient_name": "Anita Desai",
          "bed_number": "Bed 212",
          "treatment_day": "Day 4 of 7",
          "qty": 1
        }
      ]
    }
  ]
}
```

---

### 5.5 Confirm Pharmacy Dispense & Auto-Billing
- **Endpoint:** `POST /inpatient/indents/fulfill`
- **Description:** Central pharmacy confirms dispatch of the pre-sorted unit-dose batch to the ward student/nurse. Auto-deducts stock and posts daily charges to patient accounts.

#### Request Body Example
```json
{
  "indent_batch_id": "IND-20260804-ICUB",
  "ward_id": "WARD-ICU-B",
  "dispensed_by_pharmacist_id": "PHARM-108",
  "picked_up_by_staff_id": "NURSE-512",
  "dispense_notes": "All pouches verified & sealed in Ward-B transport box."
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "message": "Indent batch fulfilled. Inventory updated & daily patient billing ledger updated.",
  "data": {
    "indent_batch_id": "IND-20260804-ICUB",
    "fulfillment_time": "2026-08-04T06:45:12Z",
    "status": "DISPENSED",
    "billing_transactions": [
      {
        "transaction_id": "TXN-9001",
        "patient_id": "PAT-9082",
        "patient_name": "Sarah Jenkins",
        "amount_billed": 45.00,
        "currency": "INR",
        "status": "POSTED_TO_IPD_BILL"
      },
      {
        "transaction_id": "TXN-9002",
        "patient_id": "PAT-9085",
        "patient_name": "Robert Miller",
        "amount_billed": 320.00,
        "currency": "INR",
        "status": "POSTED_TO_IPD_BILL"
      },
      {
        "transaction_id": "TXN-9003",
        "patient_id": "PAT-9090",
        "patient_name": "Anita Desai",
        "amount_billed": 85.00,
        "currency": "INR",
        "status": "POSTED_TO_IPD_BILL"
      }
    ]
  }
}
```

---

### 5.6 Real-Time Stop-Order / Cancel Prescription
- **Endpoint:** `POST /inpatient/prescriptions/{rx_id}/stop`
- **Description:** Immediately stops an active prescription (e.g., patient discharged early or medication changed). All pending future indents (e.g., Days 4–7) are marked `CANCELLED` to block pharmacy issuance.

#### Request Body Example
```json
{
  "reason": "DISCHARGE_EARLY",
  "cancelled_by_doctor_id": "DOC-402",
  "cancellation_notes": "Patient condition improved, discharged to home care."
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "message": "Prescription cancelled. Pending daily batches automatically updated to CANCELLED.",
  "data": {
    "rx_id": "RX-88410",
    "patient_id": "PAT-9082",
    "status": "CANCELLED",
    "cancelled_at": "2026-08-04T10:15:00Z",
    "completed_days": 2,
    "cancelled_future_days": [3, 4, 5, 6, 7],
    "unissued_units_saved": 15
  }
}
```

---

## 6. Realistic Sample Payloads & Dummy Data

Here is a complete JSON dataset ready for testing, API mocking (e.g. Postman, Prism, MSW, Mockoon), or backend seeding.

```json
{
  "wards": [
    {
      "ward_id": "WARD-ICU-B",
      "ward_name": "ICU Ward B",
      "floor": "2nd Floor - East Wing",
      "beds": ["Bed 201", "Bed 202", "Bed 205", "Bed 208", "Bed 212"]
    }
  ],
  "patients": [
    {
      "patient_id": "PAT-9082",
      "patient_name": "Sarah Jenkins",
      "age": 42,
      "gender": "Female",
      "bed_number": "Bed 205",
      "ward_id": "WARD-ICU-B",
      "admission_date": "2026-08-03"
    },
    {
      "patient_id": "PAT-9085",
      "patient_name": "Robert Miller",
      "age": 61,
      "gender": "Male",
      "bed_number": "Bed 208",
      "ward_id": "WARD-ICU-B",
      "admission_date": "2026-08-01"
    }
  ],
  "drugs": [
    {
      "drug_id": "DRUG-1004",
      "drug_name": "Paracetamol 650mg Tablet",
      "unit_price": 15.00,
      "stock_quantity": 4500
    },
    {
      "drug_id": "DRUG-2015",
      "drug_name": "Ceftriaxone 1g IV Injection",
      "unit_price": 160.00,
      "stock_quantity": 800
    }
  ],
  "active_prescriptions": [
    {
      "rx_id": "RX-88410",
      "patient_id": "PAT-9082",
      "drug_id": "DRUG-1004",
      "daily_dosage_qty": 3,
      "start_date": "2026-08-04",
      "total_prescribed_days": 7,
      "status": "ACTIVE"
    },
    {
      "rx_id": "RX-88411",
      "patient_id": "PAT-9085",
      "drug_id": "DRUG-2015",
      "daily_dosage_qty": 2,
      "start_date": "2026-08-02",
      "total_prescribed_days": 5,
      "status": "ACTIVE"
    }
  ]
}
```

---

## 7. Integration Code Examples (JavaScript & cURL)

### 7.1 JavaScript (Fetch API Example)

```javascript
// Fetch Morning Ward Pickup List for Ward ICU-B
async function fetchWardPickupList(wardId = 'WARD-ICU-B') {
  try {
    const response = await fetch(`https://api.pharmassist.hospital.com/api/v1/inpatient/wards/${wardId}/pickup-list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ward Pickup List:', data.consolidated_items);
    return data;
  } catch (error) {
    console.error('Error fetching ward pickup list:', error);
  }
}

// Execute Stop Order when patient is discharged
async function executeStopOrder(rxId, doctorId, reason) {
  const response = await fetch(`https://api.pharmassist.hospital.com/api/v1/inpatient/prescriptions/${rxId}/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    },
    body: JSON.stringify({
      reason: reason,
      cancelled_by_doctor_id: doctorId,
      cancellation_notes: 'Stop order executed via EMR dashboard.'
    })
  });
  return await response.json();
}
```

### 7.2 cURL Commands for Terminal Testing

#### Create Prescription:
```bash
curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/prescriptions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patient_id": "PAT-9082",
    "drug_id": "DRUG-1004",
    "daily_dosage_qty": 3,
    "frequency_code": "TID",
    "start_date": "2026-08-04",
    "total_prescribed_days": 7,
    "prescribing_doctor_id": "DOC-402"
  }'
```

#### Get Ward Pickup List:
```bash
curl -X GET "https://api.pharmassist.hospital.com/api/v1/inpatient/wards/WARD-ICU-B/pickup-list" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Fulfill Ward Indent Batch:
```bash
curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/indents/fulfill" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "indent_batch_id": "IND-20260804-ICUB",
    "ward_id": "WARD-ICU-B",
    "dispensed_by_pharmacist_id": "PHARM-108",
    "picked_up_by_staff_id": "NURSE-512"
  }'
```

---

## 8. Summary for Development Teams

- **Frontend Engineers:** Use the JSON payloads in **Section 5** & **Section 6** to build mock APIs, state management stores, or MSW handlers for the Ward Dashboard and Pharmacy Pickup screens.
- **Backend Engineers:** Implement the DB schema & SQL query in **Section 4**, and wire up the API endpoints detailed in **Section 5**.
- **QA / Testers:** Use the cURL scripts in **Section 7** and mock data in **Section 6** for automated contract & integration tests.
