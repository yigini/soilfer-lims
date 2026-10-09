-- #194 pin6072013517. Additive retained links; no quantity or existing row changes.
CREATE TABLE "BatchReagentLot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "inventoryLotId" TEXT NOT NULL,
  "role" TEXT,
  "linkedBy" TEXT NOT NULL,
  "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BatchReagentLot_batchId_inventoryLotId_key" ON "BatchReagentLot"("batchId","inventoryLotId");
CREATE INDEX "BatchReagentLot_labId_batchId_idx" ON "BatchReagentLot"("labId","batchId");

CREATE TRIGGER "BatchReagentLot_update_refused"
BEFORE UPDATE ON "BatchReagentLot"
BEGIN
  SELECT RAISE(ABORT, 'REAGENT_LOT_LINK_IMMUTABLE');
END;

CREATE TRIGGER "BatchReagentLot_delete_refused"
BEFORE DELETE ON "BatchReagentLot"
BEGIN
  SELECT RAISE(ABORT, 'REAGENT_LOT_LINK_IMMUTABLE');
END;
