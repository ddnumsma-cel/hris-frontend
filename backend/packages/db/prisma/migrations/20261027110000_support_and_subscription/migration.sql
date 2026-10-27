-- Support tickets with their messages, and the subscription's event log.
CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "filedBy" TEXT NOT NULL,
  "filedById" TEXT NOT NULL,
  "filedByEmployeeId" TEXT,
  "workspace" TEXT NOT NULL DEFAULT 'admin',
  "page" TEXT,
  "assignee" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "by" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "by" TEXT,
  "seats" TEXT NOT NULL,
  "admins" TEXT NOT NULL,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);
