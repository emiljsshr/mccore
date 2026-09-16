-- DropForeignKey
ALTER TABLE "EnrollmentToken" DROP CONSTRAINT "EnrollmentToken_createdByUserId_fkey";

-- AlterTable
ALTER TABLE "EnrollmentToken" ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EnrollmentToken" ADD CONSTRAINT "EnrollmentToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
