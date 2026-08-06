-- CreateEnum
CREATE TYPE "Role" AS ENUM ('pharmacist', 'nurse', 'doctor');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Male', 'Female', 'Other');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('admitted', 'discharged');

-- CreateEnum
CREATE TYPE "MedRoute" AS ENUM ('Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('OD', 'BD', 'TDS', 'QDS', 'ON', 'Weekly', 'PRN', 'STAT');

-- CreateEnum
CREATE TYPE "FoodTiming" AS ENUM ('before-food', 'after-food', 'with-food', 'not-applicable');

-- CreateEnum
CREATE TYPE "TimeOfDay" AS ENUM ('morning', 'afternoon', 'evening', 'night');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('active', 'stopped', 'completed');

-- CreateEnum
CREATE TYPE "IndentStatus" AS ENUM ('pending', 'swept', 'dispensed');

-- CreateEnum
CREATE TYPE "IndentLineStatus" AS ENUM ('pending', 'dispensed', 'cancelled');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('pending', 'billed', 'voided');

-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('dispense', 'restock', 'adjustment');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('dispense', 'prescription', 'stop', 'restock', 'register');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "wardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "mrn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "bed" TEXT NOT NULL,
    "admissionDate" DATE NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "allergies" TEXT NOT NULL,
    "status" "PatientStatus" NOT NULL DEFAULT 'admitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drug" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "reorderLevel" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "StockReason" NOT NULL,
    "ref" TEXT,
    "actorId" TEXT,
    "indentLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" "MedRoute" NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "foodTiming" "FoodTiming" NOT NULL,
    "timeOfDay" "TimeOfDay"[],
    "startDate" DATE NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'active',
    "stopReason" TEXT,
    "notes" TEXT,
    "prescribedById" TEXT NOT NULL,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedById" TEXT,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyIndent" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "indentDate" DATE NOT NULL,
    "status" "IndentStatus" NOT NULL DEFAULT 'pending',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyIndent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndentLine" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "treatmentDay" INTEGER NOT NULL,
    "status" "IndentLineStatus" NOT NULL DEFAULT 'pending',
    "dispensedById" TEXT,
    "dispensedAt" TIMESTAMP(3),

    CONSTRAINT "IndentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLine" (
    "id" TEXT NOT NULL,
    "indentLineId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'pending',
    "billedById" TEXT,
    "billedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "patientId" TEXT,
    "wardId" TEXT,
    "drugId" TEXT,
    "text" TEXT NOT NULL,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_wardId_idx" ON "User"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_code_key" ON "Ward"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE INDEX "Patient_wardId_status_idx" ON "Patient"("wardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Drug_label_key" ON "Drug"("label");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_drugId_key" ON "InventoryItem"("drugId");

-- CreateIndex
CREATE INDEX "StockMovement_drugId_createdAt_idx" ON "StockMovement"("drugId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_actorId_idx" ON "StockMovement"("actorId");

-- CreateIndex
CREATE INDEX "StockMovement_indentLineId_idx" ON "StockMovement"("indentLineId");

-- CreateIndex
CREATE INDEX "Prescription_patientId_status_idx" ON "Prescription"("patientId", "status");

-- CreateIndex
CREATE INDEX "Prescription_status_startDate_idx" ON "Prescription"("status", "startDate");

-- CreateIndex
CREATE INDEX "Prescription_drugId_idx" ON "Prescription"("drugId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyIndent_wardId_indentDate_key" ON "DailyIndent"("wardId", "indentDate");

-- CreateIndex
CREATE INDEX "IndentLine_patientId_status_idx" ON "IndentLine"("patientId", "status");

-- CreateIndex
CREATE INDEX "IndentLine_drugId_idx" ON "IndentLine"("drugId");

-- CreateIndex
CREATE UNIQUE INDEX "IndentLine_indentId_prescriptionId_key" ON "IndentLine"("indentId", "prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLine_indentLineId_key" ON "BillingLine"("indentLineId");

-- CreateIndex
CREATE INDEX "BillingLine_patientId_status_idx" ON "BillingLine"("patientId", "status");

-- CreateIndex
CREATE INDEX "BillingLine_wardId_createdAt_idx" ON "BillingLine"("wardId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingLine_drugId_idx" ON "BillingLine"("drugId");

-- CreateIndex
CREATE INDEX "ActivityEvent_occurredAt_idx" ON "ActivityEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_type_occurredAt_idx" ON "ActivityEvent"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_indentLineId_fkey" FOREIGN KEY ("indentLineId") REFERENCES "IndentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_prescribedById_fkey" FOREIGN KEY ("prescribedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_stoppedById_fkey" FOREIGN KEY ("stoppedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyIndent" ADD CONSTRAINT "DailyIndent_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "DailyIndent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_indentLineId_fkey" FOREIGN KEY ("indentLineId") REFERENCES "IndentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_billedById_fkey" FOREIGN KEY ("billedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
