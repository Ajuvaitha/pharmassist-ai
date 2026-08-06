/*
  Warnings:

  - A unique constraint covering the columns `[patientId,drugId,startDate]` on the table `Prescription` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Prescription_status_startDate_idx";

-- CreateIndex
CREATE INDEX "Prescription_startDate_status_idx" ON "Prescription"("startDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_patientId_drugId_startDate_key" ON "Prescription"("patientId", "drugId", "startDate");
