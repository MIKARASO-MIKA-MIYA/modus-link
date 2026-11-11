ALTER TYPE "HistoryAction" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TABLE "Attachment" DROP CONSTRAINT "attachment_size";
ALTER TABLE "Attachment" ADD CONSTRAINT "attachment_size" CHECK ("size" > 0 AND "size" <= 10485760);