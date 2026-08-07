# Pharmassist - Project Information & Technical Specification

> **Superseded — historical design brief.** This document describes the
> system as originally envisaged, before it was built. Its field names are
> not the ones that shipped: it uses `daily_dosage_qty`, `total_prescribed_days`
> and `ACTIVE | COMPLETED | CANCELLED`, where the implementation derives
> quantity from the dosing frequency and uses `active | stopped | completed`.
>
> For the API as it actually exists, read [API_ENDPOINTS_DETAILED.md](API_ENDPOINTS_DETAILED.md).
> For how the daily dispensing cycle works, read
> [INPATIENT_AUTO_INDENT_MODULE_SPEC.md](INPATIENT_AUTO_INDENT_MODULE_SPEC.md).
> Kept for the product context and rationale in the sections below, which
> remain accurate.

## 1. Project Overview

**Pharmassist** (`pharmassist-ai`) is an AI-powered smart pharmacy and hospital logistics platform designed to optimize inpatient medication dispensing, streamline prescription workflows, automate daily ward requisitions, and track pharmacy billing and inventory.

The core focus of this module is **Inpatient Medication Dispensing & Daily Auto-Indent Management** (Module 3). It solves the operational bottleneck of multi-day inpatient prescriptions by replacing paper-based manual morning indenting with an automated 24-hour execution engine.

---

## 2. Core Problem Statement & Workflow

### 2.1 The Healthcare Challenge
* Inpatient wards (IPD) deal with multi-day treatment plans (e.g., 7-day antibiotic courses).
* Central pharmacies cannot issue all 7 days up front due to bedside storage limits, drug safety risks, condition changes, mid-course order cancellations, and refund/billing complexities.
* Traditional daily unit-dose dispensing requires nurses to spend 1.5 to 2 hours every morning manually reviewing charts, calculating current treatment days, and writing paper indent slips.

### 2.2 System Solution
1. **Digital Prescription Entry**: Physicians record multi-day treatment orders once in the system.
2. **Automated 6:00 AM Ward Sweep Engine**: The backend automatically scans all active inpatient beds, calculates 24-hour dosage requirements, and aggregates drug totals per ward.
3. **Consolidated Ward Pickup Manifest**: Central pharmacy receives a single consolidated pick list per ward rather than fragmented orders.
4. **Fulfillment & Auto-Billing**: Dispensing a ward batch automatically deducts central stock and posts individual medication charges to patient IPD accounts.
5. **Real-Time Stop-Order Sync**: Immediate order cancellations automatically remove patient allocations from pending morning pickup lists.

---

## 3. Primary User Personas & Roles

| Persona / Role | System Goals & Tasks |
|---|---|
| **Clinical Pharmacist** | Reviews consolidated ward pick lists, verifies inventory availability, dispenses medication batches, monitors stock reorder alerts. |
| **Inpatient Ward Nurse** | Monitors ward sweep readiness, tracks patient bedside medication schedules, receives consolidated ward dispatches. |
| **Prescribing Physician / Doctor** | Enters digital multi-day medication orders, specifies daily frequencies and treatment durations, issues immediate stop-orders. |
| **Hospital Administrator / Billing Officer** | Audits posted IPD billing ledger transactions, tracks ward consumption stats, reviews system integration endpoints. |

---

## 4. Application Screen & View Architecture

The platform consists of 5 main operational views accessible via top-level navigation:

### View 1: 6:00 AM Ward Indent Sweep & Consolidation (`WardIndentSweep`)
* **Primary Function**: Operational dashboard for managing daily ward sweeps and pharmacy pickup manifests.
* **Key Features & Interactive Elements**:
  * Ward selection toggle (e.g., General Medical Ward, Intensive Care Unit, Surgical Ward, Pediatric Ward).
  * Ward status summary metrics (Total Patients, Active Indents, Ward Status).
  * Manual "Trigger Sweep" button for on-demand recalculation.
  * Consolidated Drug Pick List table showing aggregated quantities required for the ward.
  * Collapsible patient breakdown showing which patients receive each drug and their specific daily doses.
  * Batch Fulfillment button ("Confirm Dispense & Auto-Bill") to update status, deduct inventory, and post charges.

### View 2: Doctor Medication Order / Prescription Entry (`PrescriptionEntry`)
* **Primary Function**: Digital entry portal for prescribing physicians.
* **Key Features & Interactive Elements**:
  * Patient Selector dropdown (lists patients grouped by Ward and Bed Number).
  * Drug Selector dropdown (lists available pharmacy stock items with current stock counts).
  * Daily Dosage Quantity input.
  * Daily Frequency dropdown (e.g., Once Daily, Twice Daily, Every 8 Hours).
  * Total Treatment Duration input (in days).
  * Treatment Start Date selector.
  * Real-Time Indent Impact Preview (displays calculated daily requirement and total course duration).
  * "Submit Digital Prescription" action button.

### View 3: Inpatient Bed & Order Monitor (`PatientBedMonitor`)
* **Primary Function**: Real-time bed oversight and active order management for clinical staff.
* **Key Features & Interactive Elements**:
  * Filter controls (Search by patient name/bed, filter by Ward or Status).
  * Patient Bed Cards / List displaying:
    * Patient ID, Name, Ward, Bed Number, Primary Diagnosis, Admission Date, Attending Physician.
    * Currently Active Prescriptions with progress indicators (e.g., Day 3 of 7).
  * "Stop Order / Cancel" action button for each active prescription.
  * Cancellation Modal capturing cancellation reason (e.g., Condition Improved, Adverse Reaction, Physician Discharge) and clinical notes.

### View 4: Pharmacy Billing & Stock Ledger (`PharmacyBillingLedger`)
* **Primary Function**: Central inventory ledger and financial tracking dashboard.
* **Key Features & Interactive Elements**:
  * Central Stock Inventory Table:
    * Item ID, Drug Name, Category, Stock Unit, Current Stock Level, Unit Price, Reorder Level Status.
  * Posted IPD Billing Ledger Table:
    * Transaction ID, Indent Batch ID, Patient Name, Bed Number, Ward, Drug Name, Quantity Billed, Unit Price, Total Billed Amount, Timestamp, Billing Status (`POSTED_TO_IPD_BILL`).
  * Search and filter inputs for transactions by Patient, Ward, or Date.

### View 5: Healthcare API Specification & Integration Docs (`ApiDocumentation`)
* **Primary Function**: In-app developer and integration guide for connecting Pharmassist with Hospital Information Systems (HIS) and Electronic Medical Records (EMR).
* **Key Features & Interactive Elements**:
  * Endpoint tab navigator (Prescriptions, Indent Sweeps, Dispatches, Stop-Orders, Inventory).
  * Detailed REST API Endpoint specifications (HTTP Method, Route, Parameters, Request Body Schema, Response Schema).
  * Executable sample payloads and integration code blocks.

---

## 5. Domain Data Schema & Entities

### 5.1 Ward Entity
* `id` (String): Unique identifier (e.g., `WARD-GMW-01`).
* `name` (String): Ward name (e.g., `General Medical Ward`).
* `code` (String): Ward short code (e.g., `GMW`).
* `totalBeds` (Number): Total bed capacity.
* `occupiedBeds` (Number): Active inpatient count.

### 5.2 Patient & Bed Entity
* `id` (String): Patient MRN/ID (e.g., `PAT-10892`).
* `name` (String): Full patient name.
* `age` (Number): Age in years.
* `gender` (String): Patient gender.
* `wardId` (String): Assigned ward identifier.
* `wardName` (String): Name of assigned ward.
* `bedNumber` (String): Bed location (e.g., `Bed 104-A`).
* `admissionDate` (String/Date): Hospital admission date.
* `diagnosis` (String): Primary clinical diagnosis.
* `attendingDoctor` (String): Prescribing physician name.

### 5.3 Drug / Inventory Item Entity
* `id` (String): Drug identifier (e.g., `DRUG-PAR-650`).
* `name` (String): Brand/Generic drug name (e.g., `Paracetamol 650mg`).
* `category` (String): Drug classification (e.g., `Analgesic / Antipyretic`).
* `unit` (String): Dispensing unit (e.g., `Tablets`, `Vials`, `Capsules`, `Ampoules`).
* `unitPrice` (Number): Unit price in currency units.
* `stock` (Number): Current central pharmacy stock balance.
* `reorderLevel` (Number): Minimum stock threshold for replenishment alert.

### 5.4 Prescription Entity
* `rx_id` (String): Unique prescription identifier (e.g., `RX-2026-089`).
* `patient_id` (String): Target patient identifier.
* `patient_name` (String): Target patient name.
* `bed_number` (String): Target bed number.
* `ward_id` (String): Target ward identifier.
* `drug_id` (String): Prescribed drug identifier.
* `drug_name` (String): Prescribed drug name.
* `daily_dosage_qty` (Number): Quantity required per 24-hour cycle.
* `frequency` (String): Dosage frequency schedule.
* `total_prescribed_days` (Number): Duration of treatment in days.
* `current_day` (Number): Active execution day sequence number.
* `start_date` (String/Date): Prescription start date.
* `status` (Enum): `ACTIVE` | `COMPLETED` | `CANCELLED`.
* `cancellation_reason` (String, Optional): Reason provided during stop-order.
* `cancellation_notes` (String, Optional): Additional clinical remarks.

### 5.5 Consolidated Pickup Batch Entity
* `indent_batch_id` (String): Unique daily batch identifier (e.g., `IND-20260805-GMW`).
* `date` (String/Date): Sweep execution date.
* `ward_id` (String): Target ward identifier.
* `ward_name` (String): Target ward name.
* `status` (Enum): `READY_FOR_PICKUP` | `DISPENSED`.
* `items` (Array of Objects):
  * `drug_id` (String)
  * `drug_name` (String)
  * `total_qty_needed` (Number): Aggregated 24-hour requirement for the ward.
  * `unit` (String)
  * `patient_breakdown` (Array of Objects):
    * `patient_id` (String)
    * `patient_name` (String)
    * `bed_number` (String)
    * `treatment_day` (String): Current day info (e.g., `Day 2 of 7`).
    * `qty` (Number): Patient-specific daily quantity.

### 5.6 Billing Transaction Entity
* `transaction_id` (String): Unique financial record identifier (e.g., `TXN-8492`).
* `indent_batch_id` (String): Source indent batch identifier.
* `patient_id` (String): Billed patient identifier.
* `patient_name` (String): Billed patient name.
* `bed_number` (String): Patient bed location.
* `ward_name` (String): Ward location.
* `drug_name` (String): Dispensed item description.
* `qty` (Number): Quantity dispensed and billed.
* `unit_price` (Number): Price per unit.
* `amount_billed` (Number): Total calculated charge (`qty * unit_price`).
* `timestamp` (String/DateTime): Time of transaction posting.
* `status` (Enum): `POSTED_TO_IPD_BILL`.

---

## 6. Business Logic & Calculation Rules

1. **Daily Dosage Calculation**:
   $$\text{Daily Dosage Quantity} = \text{Dose per Administration} \times \text{Daily Frequency Count}$$

2. **Ward Consolidation Aggregation**:
   $$\text{Ward Total Quantity for Drug } D = \sum_{p \in \text{Active Patients in Ward}} \text{Daily Dosage Quantity}(p, D)$$

3. **Patient IPD Line Item Billing**:
   $$\text{Amount Billed} = \text{Patient Dispense Qty} \times \text{Drug Unit Price}$$

4. **Inventory Stock Deduction**:
   $$\text{Updated Stock}(D) = \text{Prior Stock}(D) - \text{Ward Total Quantity}(D)$$

5. **Stop-Order Re-Sweep Execution**:
   * Changing a prescription status to `CANCELLED` immediately invalidates its participation in pending 24-hour batches.
   * Triggering a ward re-sweep recalculates `total_qty_needed` and removes the patient entry from `patient_breakdown`.

---

## 7. Technical Integration & System Stack

* **Frontend Framework**: React 19 (`react`, `react-dom`).
* **Build Tooling & Dev Server**: Vite.
* **Icon Set**: `lucide-react`.
* **Linting & Code Quality**: Oxlint.
* **Data Layer / Architecture**:
  * Current Client State: Reactive React Hooks managing in-memory state with pre-populated healthcare dataset (`mockData.js`).
  * API Architecture (for HIS/EMR Backend Connection): RESTful HTTP API with standard JSON payloads supporting POST, GET, and PATCH endpoints for Prescriptions, Sweeps, Pickups, Dispatches, and Stop-Orders.
