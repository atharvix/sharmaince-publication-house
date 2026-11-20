-- A book can be listed before its price, edition, ISBN and page count are known.
-- Only relaxes constraints, so code from before this migration keeps working against it.
ALTER TABLE "Book" ALTER COLUMN "priceMinor" DROP NOT NULL;
ALTER TABLE "Book" ALTER COLUMN "edition" DROP NOT NULL;
ALTER TABLE "Book" ALTER COLUMN "isbn" DROP NOT NULL;
ALTER TABLE "Book" ALTER COLUMN "pages" DROP NOT NULL;
