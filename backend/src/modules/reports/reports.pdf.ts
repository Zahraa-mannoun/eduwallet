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
const COLOR_PRIMARY_LIGHT = '#4A7FD4';
const COLOR_BORDER = '#E2E8F0';
const COLOR_ROW_ALT = '#F8FAFC';
const COLOR_HEADER_BG = '#E4EDFB';
const COLOR_HIGHLIGHT_BG = '#EFF6FF';
const COLOR_WHITE = '#FFFFFF';

const HEADER_BAR_HEIGHT = 80;
const SECTION_TITLE_HEIGHT = 24;
const TABLE_HEADER_HEIGHT = 20;
const CELL_PADDING = 6;
const FOOTER_HEIGHT = 40;

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
// (space) instead of the hyphenated "Auto-Approved" used everywhere else in the app. PENDING
// only ever fires when a P2P transfer is over the parent's threshold and waiting on them, so it
// gets the same "Awaiting Parent Approval" wording as every other surface in the app (mobile's
// transactionDisplay.ts, web's transactionStatus.ts) — kept in lockstep with those on purpose.
const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting Parent Approval',
  AUTO_APPROVED: 'Auto-Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EMERGENCY: 'Emergency',
};

function transactionStatusLabel(status: string): string {
  return TRANSACTION_STATUS_LABELS[status] ?? titleCaseEnum(status);
}

// ReceiptVerificationStatus labels for the withdrawal history table.
const RECEIPT_STATUS_LABELS: Record<string, string> = {
  NOT_UPLOADED: 'Not Uploaded',
  PROCESSING: 'Processing',
  AUTO_VERIFIED: 'Auto Verified',
  MANUALLY_VERIFIED: 'Manually Verified',
  FLAGGED: 'Flagged',
  REJECTED: 'Rejected',
  PENDING: 'Pending Review',
};

function receiptStatusLabel(status: string): string {
  return RECEIPT_STATUS_LABELS[status] ?? titleCaseEnum(status);
}

// General cash withdrawals never go through receipt verification (no merchant category to
// check the receipt against), so the receipt status column would otherwise show a misleading
// NOT_UPLOADED/"Not Uploaded" as if one were expected and missing.
function withdrawalReceiptLabel(withdrawal: { category: string; receiptVerificationStatus: string }): string {
  if (withdrawal.category === 'GENERAL') {
    return 'No receipt required';
  }
  return receiptStatusLabel(withdrawal.receiptVerificationStatus);
}

// PARENT/INSTITUTION senders are always funding a student's wallet, never a peer-to-peer
// payment — checked before the STUDENT-to-STUDENT case since a parent's own userType is never
// STUDENT, so the two checks can't overlap.
function transferTypeLabel(tx: {
  fromWallet: { user: { userType: string } } | null;
  toWallet: { user: { userType: string } } | null;
}): string {
  const fromType = tx.fromWallet?.user.userType;
  const toType = tx.toWallet?.user.userType;
  if (fromType === 'PARENT' || fromType === 'INSTITUTION') {
    return 'Funding';
  }
  if (fromType === 'STUDENT' && toType === 'STUDENT') {
    return 'P2P Transfer';
  }
  return 'Transfer';
}

// This report is scoped to one student and their parent — a sender who is any OTHER student
// must not have their name printed in someone else's report. PARENT/INSTITUTION senders (and
// the report's own student) are always safe to name; email (unique, unlike fullName) is what
// identifies "the report's own student" here since fromWallet.user has no direct link back to
// the ReportRequest itself.
function transferSenderLabel(
  tx: { fromWallet: { user: { email: string; fullName: string; userType: string } } | null },
  studentEmail: string
): string {
  const sender = tx.fromWallet?.user;
  if (!sender) return '—';
  if (sender.email === studentEmail) return sender.fullName;
  if (sender.userType === 'STUDENT') return 'Student Transfer';
  return sender.fullName;
}

// Merchant column shows ONLY an actual merchant name or "—" — every status-related case
// (no receipt required, not uploaded, still pending review) is already covered by the Receipt
// Status column and must not be repeated here.
function withdrawalMerchantLabel(withdrawal: {
  category: string;
  receiptPath: string | null;
  receiptVerificationStatus: string;
  merchantName: string | null;
}): string {
  if (withdrawal.category === 'GENERAL') {
    return '—';
  }
  if (!withdrawal.receiptPath) {
    return '—';
  }
  if (withdrawal.receiptVerificationStatus === 'PENDING' && !withdrawal.merchantName) {
    return '—';
  }
  return withdrawal.merchantName ?? '—';
}

// SavingsHistoryStatus labels — kept in lockstep with mobile's PersonalSavingsScreen.tsx
// STATUS_META. PENDING is a parent-approval wait state here too, not a generic "Pending".
const SAVINGS_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting Parent Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

// A ROLLOVER row's status is always the schema default 'APPROVED' (see runRollover() in
// savings.service.ts) — but "Approved" implies a parent had to sign off on it, when a rollover
// is really an automatic monthly sweep. "Completed" reads correctly for that case without
// touching the underlying status value or any other status-driven logic.
function savingsRowStatusLabel(entry: PersonalSavingsHistory): string {
  if (entry.type === 'ROLLOVER') {
    return 'Completed';
  }
  return SAVINGS_STATUS_LABELS[entry.status] ?? titleCaseEnum(entry.status);
}

// A ROLLOVER row's categoryBreakdown is a {category: amount} snapshot captured at rollover time
// (see the field comment on PersonalSavingsHistory in schema.prisma) — turns it into "Books
// $205.00 · Food $267.01" instead of the caller having to show just the pre-summed total.
function formatCategoryBreakdown(breakdown: unknown): string {
  if (!breakdown || typeof breakdown !== 'object') {
    return '—';
  }
  const entries = Object.entries(breakdown as Record<string, number>);
  if (entries.length === 0) {
    return '—';
  }
  return entries.map(([category, amount]) => `${titleCaseEnum(category)} ${formatMoney(amount)}`).join(' · ');
}

export type LockedFundBreakdownRow = {
  category: string;
  totalReceived: number;
  totalSpent: number;
  remaining: number;
  status: string;
};

export type ReportData = {
  studentName: string;
  studentEmail: string;
  parentName: string;
  enrollmentNumber: string | null;
  university: string | null;
  period: ReportPeriod;
  generatedAt: Date;
  cardPurchases: CardHistory[] | null;
  transfers: TransactionWithParties[] | null;
  // agent is resolved separately in reports.service.ts (WithdrawalRequest.agentId has no
  // Prisma relation to User) and merged onto each row before it reaches this type.
  withdrawals: (WithdrawalRequest & { agent: { id: string; fullName: string } | null })[] | null;
  flagged: (TransactionWithParties & { fraudAlerts: FraudAlert[] })[] | null;
  pending: TransactionWithParties[] | null;
  savings: PersonalSavingsHistory[] | null;
  lockedFunds: LockedFundBreakdownRow[];
  summary: {
    byCategory: Array<{ category: string; total: number }>;
    totalSpent: number;
    totalWithdrawn: number;
    totalSaved: number;
  };
};

type Column = { label: string; width: number };

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, rowHeight: number): number {
  const bottom = doc.page.height - doc.page.margins.bottom - FOOTER_HEIGHT;
  if (y + rowHeight > bottom) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

// The blue "SECTION TITLE" band every table (and the Summary box) sits under — the one
// consistent landmark a reader can scan down the page for, regardless of how many rows a given
// section has.
function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, width: number): number {
  doc.rect(x, y, width, SECTION_TITLE_HEIGHT).fill(COLOR_PRIMARY);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLOR_WHITE)
    .text(title.toUpperCase(), x + 10, y + 7, { width: width - 20 });
  return y + SECTION_TITLE_HEIGHT + 8;
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: Column[], x: number, y: number): number {
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  doc.rect(x, y, width, TABLE_HEADER_HEIGHT).fill(COLOR_HEADER_BG);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_PRIMARY);
  let cx = x;
  for (const col of columns) {
    doc.text(col.label.toUpperCase(), cx + CELL_PADDING, y + 6, { width: col.width - CELL_PADDING * 2 });
    cx += col.width;
  }
  return y + TABLE_HEADER_HEIGHT;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  title: string,
  columns: Column[],
  rows: string[][],
  startY: number
): number {
  const x = PAGE_MARGIN;
  const width = columns.reduce((sum, c) => sum + c.width, 0);

  // An empty section only ever needs room for its title band + one line of "No records" text —
  // reserving as much as a populated table (title + header row) would round up to a page break
  // more often than the section's real height ever requires.
  const reserveHeight = rows.length === 0 ? SECTION_TITLE_HEIGHT + 24 : SECTION_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + 18;
  let y = ensureSpace(doc, startY, reserveHeight);

  y = drawSectionTitle(doc, title, x, y, width);

  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_MUTED).text('No records for this period.', x, y);
    return y + 24;
  }

  y = drawTableHeader(doc, columns, x, y);

  const rowHeight = 18;
  doc.font('Helvetica').fontSize(8.5);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    y = ensureSpace(doc, y, rowHeight);
    if (y === doc.page.margins.top) {
      y = drawTableHeader(doc, columns, x, y);
      doc.font('Helvetica').fontSize(8.5);
    }

    doc.rect(x, y, width, rowHeight).fill(rowIndex % 2 === 0 ? COLOR_WHITE : COLOR_ROW_ALT);
    doc.fillColor(COLOR_HEADING);

    const row = rows[rowIndex]!;
    let cx = x;
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? '', cx + CELL_PADDING, y + 5, { width: columns[i]!.width - CELL_PADDING * 2 });
      cx += columns[i]!.width;
    }
    y += rowHeight;
  }

  return y + 16;
}

function drawInfoCard(doc: PDFKit.PDFDocument, data: ReportData, y: number): number {
  const x = PAGE_MARGIN;
  const width = contentWidth(doc);
  const cardPad = 18;
  const rowHeight = 34;
  const rows = 3;
  const height = cardPad * 2 + rowHeight * rows;

  doc.lineWidth(1).roundedRect(x, y, width, height, 8).fillAndStroke(COLOR_WHITE, COLOR_BORDER);

  const colWidth = (width - cardPad * 2) / 2;
  const fields: Array<[string, string]> = [
    ['Student Name', data.studentName],
    ['Email', data.studentEmail],
    ['Student ID / Enrollment No.', data.enrollmentNumber ?? '—'],
    ['University', data.university ?? '—'],
    ['Report Period', PERIOD_LABELS[data.period]],
    ['Requested By', data.parentName],
  ];

  for (let i = 0; i < fields.length; i++) {
    const [label, value] = fields[i]!;
    const row = Math.floor(i / 2);
    const col = i % 2;
    const fx = x + cardPad + col * colWidth;
    const fy = y + cardPad + row * rowHeight;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(label.toUpperCase(), fx, fy, { width: colWidth - cardPad, characterSpacing: 0.3 });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_HEADING)
      .text(value, fx, fy + 13, { width: colWidth - cardPad });
  }

  return y + height + 20;
}

function drawSummaryBox(doc: PDFKit.PDFDocument, data: ReportData, startY: number): number {
  const x = PAGE_MARGIN;
  const width = contentWidth(doc);
  const height = 92;
  const y = ensureSpace(doc, startY, height + 8);

  doc.lineWidth(1.5).roundedRect(x, y, width, height, 8).fillAndStroke(COLOR_HIGHLIGHT_BG, COLOR_PRIMARY);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_PRIMARY).text('Summary', x + 18, y + 14);

  const stats: Array<[string, string]> = [
    ['Total Spent', formatMoney(data.summary.totalSpent)],
    ['Total Withdrawn', formatMoney(data.summary.totalWithdrawn)],
    ['Total Saved', formatMoney(data.summary.totalSaved)],
  ];
  const colWidth = width / 3;
  for (let i = 0; i < stats.length; i++) {
    const [label, value] = stats[i]!;
    const cx = x + i * colWidth + 18;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(label.toUpperCase(), cx, y + 44, { characterSpacing: 0.3 });
    doc.font('Helvetica-Bold').fontSize(17).fillColor(COLOR_HEADING).text(value, cx, y + 57);
  }

  return y + height + 20;
}

function drawFooters(doc: PDFKit.PDFDocument, data: ReportData): void {
  const range = doc.bufferedPageRange();
  const generatedLabel = `Generated by EduWallet · ${formatDate(data.generatedAt)}`;

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pageWidth = doc.page.width;
    const y = doc.page.height - FOOTER_HEIGHT + 8;

    doc
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN, y)
      .lineTo(pageWidth - PAGE_MARGIN, y)
      .strokeColor(COLOR_BORDER)
      .stroke();

    // The footer sits inside the page's own bottom margin by design (y is past
    // doc.page.maxY() = page.height - margins.bottom). PDFKit's text() checks that boundary on
    // every call regardless of the explicit x/y given, and silently calls addPage() when it's
    // exceeded — without this, every footer line was spawning a genuinely blank extra page (one
    // per doc.text() call below). Zeroing the bottom margin just for these two calls disables
    // that check without affecting anything else on the page.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUTED);
    doc.text(generatedLabel, PAGE_MARGIN, y + 8, { width: 300, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, pageWidth - PAGE_MARGIN - 150, y + 8, {
      width: 150,
      align: 'right',
      lineBreak: false,
    });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

export function renderReportPdf(doc: PDFKit.PDFDocument, data: ReportData): void {
  const pageWidth = doc.page.width;

  // Header bar — full-bleed gradient, independent of the page margins used by everything below it.
  const gradient = doc.linearGradient(0, 0, pageWidth, 0);
  gradient.stop(0, COLOR_PRIMARY).stop(1, COLOR_PRIMARY_LIGHT);
  doc.rect(0, 0, pageWidth, HEADER_BAR_HEIGHT).fill(gradient);

  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLOR_WHITE).text('EduWallet', PAGE_MARGIN, 22);
  doc.font('Helvetica').fontSize(11).fillColor(COLOR_WHITE).text('Financial Report', PAGE_MARGIN, 46);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLOR_WHITE)
    .text(`Generated: ${formatDate(data.generatedAt)}`, pageWidth - PAGE_MARGIN - 200, 34, {
      width: 200,
      align: 'right',
    });

  let y = HEADER_BAR_HEIGHT + 20;
  y = drawInfoCard(doc, data, y);

  if (data.cardPurchases) {
    y = drawTable(
      doc,
      'Card Purchases',
      [
        { label: 'Date', width: 80 },
        { label: 'Merchant', width: 160 },
        { label: 'Category', width: 100 },
        { label: 'Amount', width: 80 },
        { label: 'Card', width: 75 },
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
        { label: 'Date', width: 75 },
        { label: 'Type', width: 70 },
        { label: 'Sender', width: 110 },
        { label: 'Category', width: 75 },
        { label: 'Amount', width: 60 },
        { label: 'Status', width: 80 },
      ],
      data.transfers.map((tx) => [
        formatDate(tx.createdAt),
        transferTypeLabel(tx),
        transferSenderLabel(tx, data.studentEmail),
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
        { label: 'Date', width: 75 },
        { label: 'Category', width: 60 },
        { label: 'Amount', width: 50 },
        { label: 'Agent', width: 70 },
        { label: 'Merchant', width: 130 },
        { label: 'Receipt Status', width: 95 },
      ],
      data.withdrawals.map((w) => [
        formatDate(w.createdAt),
        titleCaseEnum(w.category),
        formatMoney(w.amount),
        w.agent?.fullName ?? '—',
        withdrawalMerchantLabel(w),
        withdrawalReceiptLabel(w),
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

  y = drawTable(
    doc,
    'Locked Funds Breakdown',
    [
      { label: 'Category', width: 95 },
      { label: 'Total Received', width: 100 },
      { label: 'Total Spent', width: 100 },
      { label: 'Remaining', width: 100 },
      { label: 'Status', width: 100 },
    ],
    data.lockedFunds.map((row) => [
      titleCaseEnum(row.category),
      formatMoney(row.totalReceived),
      formatMoney(row.totalSpent),
      formatMoney(row.remaining),
      titleCaseEnum(row.status),
    ]),
    y
  );

  if (data.savings) {
    y = drawTable(
      doc,
      'Personal Savings',
      [
        { label: 'Date', width: 85 },
        { label: 'Type', width: 110 },
        { label: 'Amount', width: 85 },
        { label: 'Status', width: 90 },
        { label: 'Details', width: 125 },
      ],
      data.savings.map((entry) => [
        formatDate(entry.createdAt),
        entry.type === 'ROLLOVER' ? 'Rollover' : 'Withdrawal',
        formatMoney(entry.amount),
        savingsRowStatusLabel(entry),
        entry.type === 'ROLLOVER' ? formatCategoryBreakdown(entry.categoryBreakdown) : '—',
      ]),
      y
    );
  }

  y = drawSummaryBox(doc, data, y);

  if (data.summary.byCategory.length > 0) {
    y = drawTable(
      doc,
      'Totals by Category',
      [
        { label: 'Category', width: 250 },
        { label: 'Total', width: 245 },
      ],
      data.summary.byCategory.map((row) => [titleCaseEnum(row.category), formatMoney(row.total)]),
      y
    );
  }

  drawFooters(doc, data);
}

export async function generateReportBuffer(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderReportPdf(doc, data);

    doc.end();
  });
}
