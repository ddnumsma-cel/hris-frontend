-- Emails and texts waiting to go out (addresses stored encrypted).
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutboxMessage_at_idx" ON "OutboxMessage"("at");
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
