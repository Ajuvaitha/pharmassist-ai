# 🔌 Pharmassist Module 3: Complete REST API Endpoints Specification

This document contains **strictly the technical REST API endpoint specifications**, HTTP methods, request/response headers, parameters, full JSON payloads, status codes, and error models for **Module 3: Inpatient Medication Dispensing & Daily Auto-Indent System**.

---

## 📌 Base Server Configuration
- **Production Base URL:** `https://api.pharmassist.hospital.com/api/v1`
- **Staging Base URL:** `https://staging-api.pharmassist.hospital.com/api/v1`
- **Content-Type:** `application/json`
- **Authentication:** `Bearer <JWT_ACCESS_TOKEN>` in Request Header `Authorization`

---

## 📑 Summary of Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/inpatient/prescriptions` | Create a multi-day digital inpatient prescription | Yes (Doctor) |
| `GET` | `/inpatient/prescriptions` | List/Filter active inpatient prescriptions across wards | Yes (Staff) |
| `GET` | `/inpatient/prescriptions/{rx_id}` | Fetch full execution history & batch schedule for an Rx | Yes (Staff) |
| `POST` | `/inpatient/indents/sweep` | Trigger or preview the morning 6:00 AM ward sweep | Yes (System/Admin) |
| `GET` | `/inpatient/wards/{ward_id}/pickup-list` | Get consolidated ward pickup list for daily unit-dose batches | Yes (Nurse/Pharm) |
| `POST` | `/inpatient/indents/fulfill` | Confirm pharmacy dispatch, deduct stock & post daily bill | Yes (Pharmacist) |
| `POST` | `/inpatient/prescriptions/{rx_id}/stop` | Execute real-time stop-order (cancel pending future batches) | Yes (Doctor) |

---

## 1. Digital Prescription Entry
`POST /inpatient/prescriptions`

Registers a doctor's multi-day treatment order. The backend scheduler automatically breaks the order into individual 24-hour execution batches linked to the patient's assigned bed.

### Request Headers
```http
POST /api/v1/inpatient/prescriptions HTTP/1.1
Host: api.pharmassist.hospital.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Request Body Schema
```json
{
  "patient_id": "PAT-9082",
  "drug_id": "DRUG-1004",
  "daily_dosage_qty": 3,
  "frequency_code": "TID",
  "frequency_description": "Three times a day (Every 8 hours)",
  "start_date": "2026-08-04",
  "total_prescribed_days": 7,
  "prescribing_doctor_id": "DOC-402",
  "notes": "Administer post-meals. Monitor vitals."
}
```

### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Inpatient prescription created successfully & 7 daily execution batches scheduled.",
  "data": {
    "rx_id": "RX-88410",
    "patient_id": "PAT-9082",
    "patient_name": "Sarah Jenkins",
    "bed_number": "Bed 205",
    "ward_id": "WARD-ICU-B",
    "ward_name": "ICU Ward B",
    "drug_id": "DRUG-1004",
    "drug_name": "Paracetamol 650mg Tablet",
    "daily_dosage_qty": 3,
    "total_prescribed_days": 7,
    "total_units_allocated": 21,
    "start_date": "2026-08-04",
    "end_date": "2026-08-10",
    "status": "ACTIVE",
    "batches_scheduled": [
      { "day": 1, "date": "2026-08-04", "status": "PENDING" },
      { "day": 2, "date": "2026-08-05", "status": "SCHEDULED" },
      { "day": 3, "date": "2026-08-06", "status": "SCHEDULED" },
      { "day": 4, "date": "2026-08-07", "status": "SCHEDULED" },
      { "day": 5, "date": "2026-08-08", "status": "SCHEDULED" },
      { "day": 6, "date": "2026-08-09", "status": "SCHEDULED" },
      { "day": 7, "date": "2026-08-10", "status": "SCHEDULED" }
    ],
    "created_at": "2026-08-04T08:30:00Z"
  }
}
```

---

## 2. List Active Inpatient Prescriptions
`GET /inpatient/prescriptions`

Lists active multi-day prescriptions across inpatient wards.

### Request Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `ward_id` | String | Optional | Filter by specific Ward ID (e.g. `WARD-ICU-B`) |
| `patient_id`| String | Optional | Filter by specific Patient ID (e.g. `PAT-9082`) |
| `status` | String | Optional | `ACTIVE` \| `COMPLETED` \| `CANCELLED` (Default: `ACTIVE`) |
| `page` | Integer| Optional | Page number (Default: `1`) |
| `limit` | Integer| Optional | Page limit (Default: `20`) |

### Response (`200 OK`)
```json
{
  "success": true,
  "page": 1,
  "limit": 20,
  "total_records": 3,
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
      "frequency_code": "TID",
      "start_date": "2026-08-04",
      "current_day": 1,
      "total_prescribed_days": 7,
      "status": "ACTIVE",
      "prescribing_doctor": "Dr. Aris Thorne (DOC-402)"
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
      "frequency_code": "Q12H",
      "start_date": "2026-08-02",
      "current_day": 3,
      "total_prescribed_days": 5,
      "status": "ACTIVE",
      "prescribing_doctor": "Dr. Elena Rostova (DOC-109)"
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
      "frequency_code": "QD",
      "start_date": "2026-08-01",
      "current_day": 4,
      "total_prescribed_days": 7,
      "status": "ACTIVE",
      "prescribing_doctor": "Dr. Marcus Vance (DOC-305)"
    }
  ]
}
```

---

## 3. Trigger 6:00 AM Daily Ward Indent Sweep
`POST /inpatient/indents/sweep`

Runs the scheduled daily sweep worker that calculates unit-dose requirements for every active bed at 6:00 AM and compiles consolidated ward pickup batches.

### Request Body
```json
{
  "target_date": "2026-08-04",
  "force_recalculate": false
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "sweep_execution_id": "SWEEP-20260804-0600",
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
      "indent_batch_id": "IND-20260804-ICUB",
      "total_dose_units": 34
    },
    {
      "ward_id": "WARD-GEN-A",
      "ward_name": "General Surgical Ward A",
      "patient_count": 20,
      "indent_batch_id": "IND-20260804-GENA",
      "total_dose_units": 58
    }
  ]
}
```

---

## 4. Get Ward Consolidated Pickup List
`GET /inpatient/wards/{ward_id}/pickup-list`

Retrieves the aggregated daily pickup manifest for a ward, grouping medications by drug type with bed-by-bed breakdowns so central pharmacy can pack unit-dose pouches.

### Path Parameters
- `ward_id` (String, Required): ID of the ward (e.g. `WARD-ICU-B`)

### Query Parameters
- `date` (String, Optional): Target date in `YYYY-MM-DD` format. Defaults to current date.

### Response (`200 OK`)
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

## 5. Confirm Pharmacy Dispense & Auto-Billing
`POST /inpatient/indents/fulfill`

Invoked by central pharmacy upon handing over the pre-sorted unit-dose pouches. Auto-deducts inventory stock and posts daily line-item charges directly to the patient's IPD ledger.

### Request Body
```json
{
  "indent_batch_id": "IND-20260804-ICUB",
  "ward_id": "WARD-ICU-B",
  "dispensed_by_pharmacist_id": "PHARM-108",
  "picked_up_by_staff_id": "NURSE-512",
  "dispense_notes": "All unit-dose pouches verified and handed over in sealed Ward-B box."
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Indent batch fulfilled successfully. Central inventory updated and daily IPD billing ledgers generated.",
  "data": {
    "indent_batch_id": "IND-20260804-ICUB",
    "fulfillment_time": "2026-08-04T06:45:12Z",
    "status": "DISPENSED",
    "dispensed_by": "Pharm. David Chen (PHARM-108)",
    "picked_up_by": "Nurse Clara Vance (NURSE-512)",
    "inventory_deductions": [
      { "drug_id": "DRUG-1004", "drug_name": "Paracetamol 650mg Tablet", "deducted_qty": 3, "remaining_stock": 4497 },
      { "drug_id": "DRUG-2015", "drug_name": "Ceftriaxone 1g IV Injection", "deducted_qty": 2, "remaining_stock": 798 },
      { "drug_id": "DRUG-3088", "drug_name": "Pantoprazole 40mg IV", "deducted_qty": 1, "remaining_stock": 519 }
    ],
    "billing_transactions": [
      {
        "transaction_id": "TXN-9001",
        "patient_id": "PAT-9082",
        "patient_name": "Sarah Jenkins",
        "bed_number": "Bed 205",
        "amount_billed": 45.00,
        "currency": "INR",
        "status": "POSTED_TO_IPD_BILL"
      },
      {
        "transaction_id": "TXN-9002",
        "patient_id": "PAT-9085",
        "patient_name": "Robert Miller",
        "bed_number": "Bed 208",
        "amount_billed": 320.00,
        "currency": "INR",
        "status": "POSTED_TO_IPD_BILL"
      },
      {
        "transaction_id": "TXN-9003",
        "patient_id": "PAT-9090",
        "patient_name": "Anita Desai",
        "bed_number": "Bed 212",
        "amount_billed": 85.00,
        "currency": "INR",
        "status": "POSTED_TO_IPD_BILL"
      }
    ]
  }
}
```

---

## 6. Real-Time Stop-Order Sync (Cancel Prescription)
`POST /inpatient/prescriptions/{rx_id}/stop`

Instantly cancels an active multi-day prescription (e.g. physician stops order mid-course or patient discharged). Immediately marks all pending future 24-hr daily execution batches (e.g. Days 4–7) as `CANCELLED`, blocking pharmacy issuance and preventing wasted medication.

### Path Parameters
- `rx_id` (String, Required): ID of the prescription (e.g. `RX-88410`)

### Request Body
```json
{
  "reason": "DISCHARGE_EARLY",
  "cancelled_by_doctor_id": "DOC-402",
  "cancellation_notes": "Patient recovered ahead of schedule, discharged to home outpatient care."
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Prescription stop-order processed. Pending future batches marked CANCELLED.",
  "data": {
    "rx_id": "RX-88410",
    "patient_id": "PAT-9082",
    "patient_name": "Sarah Jenkins",
    "bed_number": "Bed 205",
    "status": "CANCELLED",
    "cancelled_at": "2026-08-04T10:15:00Z",
    "completed_days": 2,
    "cancelled_future_days": [3, 4, 5, 6, 7],
    "unissued_dose_units_saved": 15
  }
}
```

---

## 7. Error Models & HTTP Status Codes

| HTTP Code | Error Code | Description | Example Payload |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_INPUT` | Missing or malformed parameters | `{"success": false, "error": "INVALID_INPUT", "message": "daily_dosage_qty must be greater than 0"}` |
| `401 Unauthorized` | `AUTH_EXPIRED` | Invalid or expired Bearer token | `{"success": false, "error": "AUTH_EXPIRED", "message": "JWT token signature expired"}` |
| `404 Not Found` | `RX_NOT_FOUND` | Specified prescription ID missing | `{"success": false, "error": "RX_NOT_FOUND", "message": "No prescription found with ID RX-99999"}` |
| `409 Conflict` | `BATCH_ALREADY_FULFILLED` | Duplicate fulfillment attempt | `{"success": false, "error": "BATCH_ALREADY_FULFILLED", "message": "Batch IND-20260804-ICUB was already dispensed at 06:45 AM"}` |
| `500 Server Error` | `DATABASE_ERROR` | Internal database or scheduler fault | `{"success": false, "error": "DATABASE_ERROR", "message": "Failed to acquire lock on inventory row"}` |

---

## 8. Quick cURL Cheatsheet

```bash
# 1. Create Inpatient Prescription
curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/prescriptions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"patient_id":"PAT-9082","drug_id":"DRUG-1004","daily_dosage_qty":3,"frequency_code":"TID","start_date":"2026-08-04","total_prescribed_days":7,"prescribing_doctor_id":"DOC-402"}'

# 2. Get Ward Pickup List
curl -X GET "https://api.pharmassist.hospital.com/api/v1/inpatient/wards/WARD-ICU-B/pickup-list" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Confirm Dispense & Billing
curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/indents/fulfill" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"indent_batch_id":"IND-20260804-ICUB","ward_id":"WARD-ICU-B","dispensed_by_pharmacist_id":"PHARM-108","picked_up_by_staff_id":"NURSE-512"}'

# 4. Execute Real-Time Stop Order
curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/prescriptions/RX-88410/stop" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"reason":"DISCHARGE_EARLY","cancelled_by_doctor_id":"DOC-402"}'
```
