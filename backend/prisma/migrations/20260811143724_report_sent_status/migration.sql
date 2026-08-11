-- Admin "preview before sending" workflow: GENERATED means the PDF exists but is admin-only;
-- SENT means the admin reviewed it and the parent's report list may now treat it as ready.
ALTER TYPE "ReportStatus" ADD VALUE 'SENT';

ALTER TABLE "report_requests" ADD COLUMN "sentAt" TIMESTAMP(3);
