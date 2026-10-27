-- CreateEnum
CREATE TYPE "DeviceCommandStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" SERIAL NOT NULL,
    "deviceSerial" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "requestedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),
    "doneAt" TIMESTAMPTZ(3),

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceUser" (
    "deviceSerial" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "name" TEXT,
    "seenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceUser_pkey" PRIMARY KEY ("deviceSerial","pin")
);

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceSerial_status_idx" ON "DeviceCommand"("deviceSerial", "status");
