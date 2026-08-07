-- Defence in depth behind the application-level guard in dispense(): even
-- if a future code path decrements stock without the conditional
-- updateMany, Postgres itself now refuses to let currentStock go negative.
-- AlterTable
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_currentStock_nonnegative" CHECK ("currentStock" >= 0);