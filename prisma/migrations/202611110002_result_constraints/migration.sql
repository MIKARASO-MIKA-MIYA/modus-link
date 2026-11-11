-- Explicit IS NOT NULL is necessary: SQL CHECK treats UNKNOWN as passing.
ALTER TABLE "Ticket" DROP CONSTRAINT "ticket_terminal_result";
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_terminal_result" CHECK (
  "status" NOT IN ('IMPLEMENTED','REJECTED','CLOSED') OR (
    "resolution" IS NOT NULL AND length(trim("resolution")) >= 5
    AND "closedAt" IS NOT NULL AND "outcome" IN ('IMPLEMENTED','REJECTED','CLOSED')
  )
);
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_outcome_only_terminal" CHECK ("outcome" IS NULL OR "outcome" IN ('IMPLEMENTED','REJECTED','CLOSED'));