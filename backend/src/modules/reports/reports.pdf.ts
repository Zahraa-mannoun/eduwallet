import PDFDocument from 'pdfkit';
import type {
  CardHistory,
  FraudAlert,
  PersonalSavingsHistory,
  ReportPeriod,
  WithdrawalRequest,
} from '@prisma/client';
import type { TransactionWithParties } from '../admin/admin.service';

const PAGE_MARGIN = 50;
const COLOR_HEADING = '#0F172A';
const COLOR_MUTED = '#64748B';
const COLOR_PRIMARY = '#2E5FAC';
const COLOR_BORDER = '#E2E8F0';

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  LAST_WEEK: 'Last Week',
  LAST_MONTH: 'Last Month',
  LAST_YEAR: 'Last Year',
  LAST_2_YEARS: 'Last 2 Years',
};

function formatMoney(amount: number | string | { toString(): string }): string {
  return `$${Number(amount.toString()).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Every status/category value rendered in a table is a SCREAMING_SNAKE_CASE Prisma enum
// (AUTO_APPROVED, PERSONAL_SAVINGS, MANUALLY_VERIFIED, ...) — converting to Title Case both
// reads better and is meaningfully shorter, which is what actually keeps narrow columns like
// STATUS from wrapping/overflowing rather than the column width alone.
function titleCaseEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// TransactionStatus labels specifically — titleCaseEnum() alone would print "Auto Approved"
// (space) instead of the hyphenated "Auto-Approved" used everywhere else in the app, and
// PENDING here is a system queue state ("Processing"), not the parent-approval wording used
// for WithdrawalStatus's PENDING_PARENT_APPROVAL.
const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Processing',
  AUTO_APPROVED: 'Auto-Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EMERGENCY: 'Emergency',
};

function transactionStatusLabel(status: string): string {
  return TRANSACTION_STATUS_LABELS[status] ?? titleCaseEnum(status);
}

export type ReportData = {
  studentName: string;
  parentName: string;
  period: ReportPeriod;
  generatedAt: Date;
  cardPurchases: CardHistory[] | null;
  transfers: TransactionWithParties[] | null;
  withdrawals: WithdrawalRequest[] | null;
  flagged: (TransactionWithParties & { fraudAlerts: FraudAlert[] })[] | null;
  pending: TransactionWithParties[] | null;
  savings: PersonalSavingsHistory[] | null;
  summary: {
    byCategory: Array<{ category: string; total: number }>;
    totalSpent: number;
    totalWithdrawn: number;
    totalSaved: number;
  };
};

type Column = { label: string; width: number };

function drawTableHeader(doc: PDFKit.PDFDocument, columns: Column[], x: number, y: number): number {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_MUTED);
  let cx = x;
  for (const col of columns) {
    doc.text(col.label.toUpperCase(), cx, y, { width: col.width });
    cx += col.width;
  }
  const rowBottom = y + 14;
  doc
    .moveTo(x, rowBottom)
    .lineTo(x + columns.reduce((sum, c) => sum + c.width, 0), rowBottom)
    .strokeColor(COLOR_BORDER)
    .stroke();
  return rowBottom + 6;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, rowHeight: number): number {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + rowHeight > bottom) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  title: string,
  columns: Column[],
  rows: string[][],
  startY: number
): number {
  const x = PAGE_MARGIN;
  let y = ensureSpace(doc, startY, 40);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_HEADING).text(title, x, y);
  y += 20;

  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_MUTED).text('No records for this period.', x, y);
    return y + 20;
  }

  y = drawTableHeader(doc, columns, x, y);

  doc.font('Helvetica').fontSize(9).fillColor(COLOR_HEADING);
  for (const row of rows) {
    y = ensureSpace(doc, y, 16);
    if (y === doc.page.margins.top) {
      y = drawTableHeader(doc, columns, x, y);
      doc.font('Helvetica').fontSize(9).fillColor(COLOR_HEADING);
    }
    let cx = x;
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? '', cx, y, { width: columns[i].width });
      cx += columns[i].width;
    }
    y += 16;
  }

  return y + 14;
}

export function renderReportPdf(doc: PDFKit.PDFDocument, data: ReportData): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLOR_PRIMARY)
    .text('EduWallet');
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLOR_MUTED)
    .text('University-Verified Financial Access for Students in Crisis Economies');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR_HEADING).text(`Report for ${data.studentName}`);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLOR_MUTED)
    .text(`Requested by ${data.parentName}`)
    .text(`Period: ${PERIOD_LABELS[data.period]}`)
    .text(`Generated: ${formatDate(data.generatedAt)}`);
  doc.moveDown(1);

  let y = doc.y;

  if (data.cardPurchases) {
    y = drawTable(
      doc,
      'Card Purchases',
      [
        { label: 'Date', width: 80 },
        { label: 'Merchant', width: 160 },
        { label: 'Category', width: 100 },
        { label: 'Amount', width: 80 },
        { label: 'Card', width: 80 },
      ],
      data.cardPurchases.map((entry) => [
        formatDate(entry.usedAt),
        entry.merchantName ?? '—',
        entry.categoryLock ? titleCaseEnum(entry.categoryLock) : '—',
        formatMoney(entry.amountPaid),
        `•••• ${entry.lastFourDigits}`,
      ]),
      y
    );
  }

  if (data.transfers) {
    y = drawTable(
      doc,
      'Transfers',
      [
        { label: 'Date', width: 65 },
        { label: 'Sender', width: 110 },
        { label: 'Receiver', width: 110 },
        { label: 'Category', width: 80 },
        { label: 'Amount', width: 60 },
        { label: 'Status', width: 70 },
      ],
      data.transfers.map((tx) => [
        formatDate(tx.createdAt),
        tx.fromWallet?.user.fullName ?? '—',
        tx.toWallet?.user.fullName ?? '—',
        titleCaseEnum(tx.category),
        formatMoney(tx.amount),
        transactionStatusLabel(tx.status),
      ]),
      y
    );
  }

  if (data.withdrawals) {
    y = drawTable(
      doc,
      'Cash Withdrawals',
      [
        { label: 'Date', width: 100 },
        { label: 'Category', width: 120 },
        { label: 'Amount', width: 100 },
        { label: 'Receipt Status', width: 130 },
      ],
      data.withdrawals.map((w) => [
        formatDate(w.createdAt),
        titleCaseEnum(w.category),
        formatMoney(w.amount),
        titleCaseEnum(w.receiptVerificationStatus),
      ]),
      y
    );
  }

  if (data.flagged) {
    y = drawTable(
      doc,
      'Flagged Transactions',
      [
        { label: 'Date', width: 90 },
        { label: 'Type', width: 100 },
        { label: 'Amount', width: 90 },
        { label: 'Alert Type', width: 100 },
        { label: 'Resolved', width: 70 },
      ],
      data.flagged.flatMap((tx) =>
        tx.fraudAlerts.map((alert) => [
          formatDate(tx.createdAt),
          titleCaseEnum(tx.category),
          formatMoney(tx.amount),
          titleCaseEnum(alert.alertType),
          alert.resolved ? 'Yes' : 'No',
        ])
      ),
      y
    );
  }

  if (data.pending) {
    y = drawTable(
      doc,
      'Pending Transactions',
      [
        { label: 'Date', width: 100 },
        { label: 'Amount', width: 100 },
        { label: 'Category', width: 120 },
        { label: 'Status', width: 100 },
      ],
      data.pending.map((tx) => [
        formatDate(tx.createdAt),
        formatMoney(tx.amount),
        titleCaseEnum(tx.category),
        transactionStatusLabel(tx.status),
      ]),
      y
    );
  }

  if (data.savings) {
    y = drawTable(
      doc,
      'Personal Savings',
      [
        { label: 'Date', width: 100 },
        { label: 'Type', width: 140 },
        { label: 'Amount', width: 100 },
        { label: 'Status', width: 100 },
      ],
      data.savings.map((entry) => [
        formatDate(entry.createdAt),
        entry.type === 'ROLLOVER' ? 'Rollover' : 'Withdrawal',
        formatMoney(entry.amount),
        titleCaseEnum(entry.status),
      ]),
      y
    );
  }

  y = ensureSpace(doc, y, 100);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_HEADING).text('Summary', PAGE_MARGIN, y);
  y += 20;
  doc.font('Helvetica').fontSize(10).fillColor(COLOR_HEADING);
  doc.text(`Total Spent: ${formatMoney(data.summary.totalSpent)}`, PAGE_MARGIN, y);
  y += 16;
  doc.text(`Total Withdrawn: ${formatMoney(data.summary.totalWithdrawn)}`, PAGE_MARGIN, y);
  y += 16;
  doc.text(`Total Saved: ${formatMoney(data.summary.totalSaved)}`, PAGE_MARGIN, y);
  y += 20;

  if (data.summary.byCategory.length > 0) {
    y = drawTable(
      doc,
      'Totals by Category',
      [
        { label: 'Category', width: 200 },
        { label: 'Total', width: 200 },
      ],
      data.summary.byCategory.map((row) => [titleCaseEnum(row.category), formatMoney(row.total)]),
      y
    );
  }
}

export async function generateReportBuffer(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderReportPdf(doc, data);

    doc.end();
  });
}
