-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "User_passwordResetToken_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordResetToken",
DROP COLUMN "refreshTokenVersion",
ADD COLUMN     "passwordResetTokenHash" TEXT;

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE INDEX "RefreshSession_familyId_idx" ON "RefreshSession"("familyId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data fixes ------------------------------------------------------------------

-- Emails are now normalised to lower case at the API boundary; bring existing rows in line.
-- (Fails loudly if two accounts differ only by case — resolve those by hand first.)
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");

-- FLAT promotion values were entered in rupees but read as paise. Store paise from now on.
UPDATE "Promotion" SET "discountValue" = "discountValue" * 100 WHERE "discountType" = 'FLAT';

-- Percent discounts above 100 produced negative totals.
UPDATE "Promotion" SET "discountValue" = 100 WHERE "discountType" = 'PERCENT' AND "discountValue" > 100;

-- ISBNs are stored without separators so catalogue search (which strips them from the query) matches.
UPDATE "Book" SET "isbn" = upper(regexp_replace("isbn", '[\s-]', '', 'g')) WHERE "isbn" ~ '[\s-]';
