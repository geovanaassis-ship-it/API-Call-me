-- AlterEnum
ALTER TYPE "LocationType" ADD VALUE 'TEAMS_AUTO';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "microsoftEventId" TEXT;

-- CreateTable
CREATE TABLE "MicrosoftAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "microsoftEmail" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrosoftAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftAccount_userId_key" ON "MicrosoftAccount"("userId");

-- AddForeignKey
ALTER TABLE "MicrosoftAccount" ADD CONSTRAINT "MicrosoftAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
