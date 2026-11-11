CREATE SEQUENCE ticket_number_seq;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('PROBLEM', 'SUGGESTION', 'POSITIVE_FEEDBACK');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'IN_PROGRESS', 'IMPLEMENTED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "HistoryAction" AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'CLARIFICATION_REQUESTED', 'CLARIFICATION_PROVIDED', 'ARCHIVED', 'RESTORED');

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canViewCompanyAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "sequence" SERIAL NOT NULL,
    "number" TEXT NOT NULL DEFAULT ('MP-'::text || lpad((nextval('ticket_number_seq'::regclass))::text, 8, '0'::text)),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "categoryId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "assigneeId" UUID,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "resolution" TEXT,
    "outcome" "TicketStatus",
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "firstRespondedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "sourceAuthorRole" TEXT,
    "sourceAssigneeRole" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketHistory" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" "HistoryAction" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingRule" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "departmentId" UUID,
    "assigneeId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_departmentId_role_idx" ON "User"("departmentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_sequence_key" ON "Ticket"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE INDEX "Ticket_departmentId_status_createdAt_idx" ON "Ticket"("departmentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_authorId_createdAt_idx" ON "Ticket"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_status_idx" ON "Ticket"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Ticket_dueAt_status_idx" ON "Ticket"("dueAt", "status");

-- CreateIndex
CREATE INDEX "Ticket_categoryId_type_priority_idx" ON "Ticket"("categoryId", "type", "priority");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketHistory_ticketId_createdAt_idx" ON "TicketHistory"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "RoutingRule_categoryId_departmentId_isActive_idx" ON "RoutingRule"("categoryId", "departmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketHistory" ADD CONSTRAINT "TicketHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketHistory" ADD CONSTRAINT "TicketHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active route per exact scope; department-specific routes beat global routes.
CREATE UNIQUE INDEX "routing_active_department_unique" ON "RoutingRule" ("categoryId", "departmentId") WHERE "isActive" AND "departmentId" IS NOT NULL;
CREATE UNIQUE INDEX "routing_active_global_unique" ON "RoutingRule" ("categoryId") WHERE "isActive" AND "departmentId" IS NULL;
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_no_self_assignment" CHECK ("assigneeId" IS NULL OR "assigneeId" <> "authorId");
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_terminal_result" CHECK ("status" NOT IN ('IMPLEMENTED','REJECTED','CLOSED') OR (length(trim("resolution")) >= 5 AND "closedAt" IS NOT NULL AND "outcome" IS NOT NULL));
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_archive_only_resolved" CHECK ("archivedAt" IS NULL OR "status" IN ('IMPLEMENTED','REJECTED','CLOSED'));
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_first_response_order" CHECK ("firstRespondedAt" IS NULL OR "firstRespondedAt" >= "createdAt");
ALTER TABLE "Attachment" ADD CONSTRAINT "attachment_size" CHECK ("size" > 0 AND "size" <= 5242880);
CREATE FUNCTION deny_ticket_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Tickets cannot be deleted; archive resolved tickets instead'; END $$;
CREATE TRIGGER ticket_no_delete BEFORE DELETE ON "Ticket" FOR EACH ROW EXECUTE FUNCTION deny_ticket_delete();
CREATE FUNCTION deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History and comments are append-only'; END $$;
CREATE TRIGGER history_append_only BEFORE UPDATE OR DELETE ON "TicketHistory" FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();
CREATE TRIGGER comment_append_only BEFORE UPDATE OR DELETE ON "TicketComment" FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();