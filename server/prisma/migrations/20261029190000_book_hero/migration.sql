-- Staff choose which books the home page hero shows and the note beside each.
-- New nullable columns only, so the running code is unaffected.
ALTER TABLE "Book" ADD COLUMN "heroOrder" INTEGER;
ALTER TABLE "Book" ADD COLUMN "heroNote" TEXT;
