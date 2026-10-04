ALTER TABLE "Consignment" ADD COLUMN "declaredExpectedCount" INTEGER CHECK ("declaredExpectedCount" IS NULL OR "declaredExpectedCount" >= 1);
