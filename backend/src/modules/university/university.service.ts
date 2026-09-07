import type { Prisma, TransactionCategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { createNotification } from '../notifications/notifications.service';
import { bulkDisburse } from '../scholarship/scholarship.service';
import type {
  DisburseSelectedInput,
  FundIndividualInput,
  PrepareDisbursementInput,
  SelectStudentsInput,
} from './university.schema';

function formatMoney(amount: number | string | { toString(): string }): string {
  return Number(amount.toString()).toFixed(2);
}

export type UniversityStudentCourse = {
  id: string;
  courseName: string;
  credits: number;
  costPerCredit: string;
  totalCost: string;
  semester: string;
};

export type UniversityStudentSummary = {
  id: string;
  userId: string;
  studentNumber: string;
  fullName: string;
  email: string;
  universityName: string;
  totalCreditCost: string;
  courses: UniversityStudentCourse[];
  received: string;
  parentSent: string;
  fundingGap: string;
};

// Institution scholarships can fund any of the 3 academic categories the disbursement flow
// allows (university.schema.ts's academicCategoryEnum) — TUITION, BOOKS, or SOFTWARE.
const INSTITUTION_FUNDABLE_CATEGORIES: readonly TransactionCategory[] = [
  'TUITION',
  'BOOKS',
  'SOFTWARE',
];

// A parent locking BOOKS or SOFTWARE money is a separate spending allowance, not a tuition
// payment — only a parent's TUITION lock actually offsets the university funding gap.
const PARENT_TUITION_CATEGORIES: readonly TransactionCategory[] = ['TUITION'];

// Sums completed transfers into this student's wallet(s) sent by a user of the given role,
// restricted to the given categories. LockedFund itself carries no record of who locked it —
// a parent's transfer and an institution's disbursement both upsert the exact same row (see
// schema.prisma's LockedFund comment) — so Transaction, which does record the sender, is the
// only place either "received" or "parentSent" can be computed from.
async function getEducationTransfersFromRole(
  userId: string,
  senderRole: 'INSTITUTION' | 'PARENT',
  categories: readonly TransactionCategory[]
): Promise<number> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true } });
  const walletIds = wallets.map((wallet) => wallet.id);
  if (walletIds.length === 0) {
    return 0;
  }

  const aggregate = await prisma.transaction.aggregate({
    where: {
      toWalletId: { in: walletIds },
      status: { in: ['AUTO_APPROVED', 'APPROVED'] },
      category: { in: [...categories] },
      fromWallet: { user: { userType: senderRole } },
    },
    _sum: { amount: true },
  });

  return Number(aggregate._sum.amount ?? 0);
}

// The full received/parentSent/fundingGap breakdown for one student — shared by every place
// that needs to know how much of totalCreditCost is still uncovered (the student list, the
// Tab 1 "Notify & Proceed" notification, Tab 2's selected-students list, and admin.service.ts's
// Scholarship Analytics fully/partially-funded counts), so they can never drift out of sync
// with each other.
export async function getFundingBreakdown(
  userId: string,
  totalCreditCost: number
): Promise<{ received: number; parentSent: number; fundingGap: number }> {
  const [received, parentSent] = await Promise.all([
    getEducationTransfersFromRole(userId, 'INSTITUTION', INSTITUTION_FUNDABLE_CATEGORIES),
    getEducationTransfersFromRole(userId, 'PARENT', PARENT_TUITION_CATEGORIES),
  ]);
  return { received, parentSent, fundingGap: Math.max(0, totalCreditCost - received - parentSent) };
}

type UniversityStudentWithRelations = Prisma.UniversityStudentGetPayload<{
  include: { enrolledCourses: true; university: true };
}>;

async function buildStudentSummary(
  student: UniversityStudentWithRelations
): Promise<UniversityStudentSummary> {
  // Guaranteed non-null by both callers' `userId: { not: null }` filter — Prisma's generated
  // type still widens it to string | null since the filter isn't visible to the type system.
  const userId = student.userId as string;
  const totalCreditCost = Number(student.totalCreditCost);
  const { received, parentSent, fundingGap } = await getFundingBreakdown(userId, totalCreditCost);

  return {
    id: student.id,
    userId,
    studentNumber: student.studentNumber,
    fullName: student.fullName,
    email: student.email,
    universityName: student.university.name,
    totalCreditCost: formatMoney(totalCreditCost),
    courses: student.enrolledCourses.map((course) => ({
      id: course.id,
      courseName: course.courseName,
      credits: course.credits,
      costPerCredit: formatMoney(course.costPerCredit),
      totalCost: formatMoney(course.totalCost),
      semester: course.semester,
    })),
    received: formatMoney(received),
    parentSent: formatMoney(parentSent),
    fundingGap: formatMoney(fundingGap),
  };
}

// Excludes any student currently selected for Tab 2 (PENDING) or already individually funded
// via Tab 3 (FUNDED) — the InstitutionStudentSelection row is what enforces "no double
// funding" across the Institution dashboard's 3 tabs (see schema.prisma's model comment). Feeds
// Tab 1 (select students to fund) and Tab 3 (individual funding search) — both need only the
// students still eligible for a new disbursement.
export async function getVerifiedUniversityStudents(): Promise<UniversityStudentSummary[]> {
  const students = await prisma.universityStudent.findMany({
    where: { userId: { not: null }, user: { kycStatus: 'VERIFIED' }, selection: null },
    include: { enrolledCourses: true, university: true },
    orderBy: { fullName: 'asc' },
  });

  return Promise.all(students.map(buildStudentSummary));
}

// Every verified student regardless of selection/funded state — the read-only "Students" bottom
// tab, unlike getVerifiedUniversityStudents() above, deliberately does NOT hide students who are
// currently selected (Tab 2, PENDING) or already funded (Tab 3, FUNDED): it's a roster view, not
// a picker, so there's no "no double funding" exclusion to enforce here.
export async function getAllUniversityStudents(): Promise<UniversityStudentSummary[]> {
  const students = await prisma.universityStudent.findMany({
    where: { userId: { not: null }, user: { kycStatus: 'VERIFIED' } },
    include: { enrolledCourses: true, university: true },
    orderBy: { fullName: 'asc' },
  });

  return Promise.all(students.map(buildStudentSummary));
}

export type FundingStatus = 'FULL' | 'PARTIAL';

export type DisbursementPreviewEntry = {
  universityStudentId: string;
  userId: string;
  fullName: string;
  email: string;
  totalCreditCost: string;
  amountPerStudent: string;
  fundingStatus: FundingStatus;
  fundingGap: string;
};

// Preview only — no wallet/LockedFund writes and no Transaction rows here. The actual money
// movement still goes through the existing scholarship.service.ts bulkDisburse(), which the
// mobile app calls separately from ScholarshipPortalScreen after this preview is confirmed.
export async function prepareDisbursement(
  input: PrepareDisbursementInput
): Promise<DisbursementPreviewEntry[]> {
  const uniqueStudentIds = [...new Set(input.studentIds)];

  const students = await prisma.universityStudent.findMany({
    where: { id: { in: uniqueStudentIds }, userId: { not: null } },
  });
  if (students.length !== uniqueStudentIds.length) {
    throw new AppError(
      400,
      'INVALID_STUDENT',
      'One or more selected students were not found or are not linked to an EduWallet account'
    );
  }

  return students.map((student) => {
    const totalCreditCost = Number(student.totalCreditCost);
    const fundingGap = Math.max(0, totalCreditCost - input.amountPerStudent);

    return {
      universityStudentId: student.id,
      userId: student.userId as string,
      fullName: student.fullName,
      email: student.email,
      totalCreditCost: formatMoney(totalCreditCost),
      amountPerStudent: formatMoney(input.amountPerStudent),
      fundingStatus: input.amountPerStudent >= totalCreditCost ? 'FULL' : 'PARTIAL',
      fundingGap: formatMoney(fundingGap),
    };
  });
}

function computeFundingStatus(amount: number, totalCreditCost: number): FundingStatus {
  return amount >= totalCreditCost ? 'FULL' : 'PARTIAL';
}

export type SelectedStudentSummary = {
  selectionId: string;
  universityStudentId: string;
  userId: string;
  studentNumber: string;
  fullName: string;
  totalCreditCost: string;
  amount: string;
  fundingStatus: FundingStatus;
  fundingGap: string;
};

// Tab 1's "Notify & Proceed" — declares intent (creates a PENDING selection row per student,
// enforced unique per UniversityStudent so a student can't land in two lists at once) and
// notifies parents. No money moves here; that only happens at Tab 2's disburseSelected() or
// Tab 3's fundIndividual() below.
export async function selectStudents(
  institutionUserId: string,
  input: SelectStudentsInput
): Promise<SelectedStudentSummary[]> {
  const uniqueStudentIds = [...new Set(input.studentIds)];

  const students = await prisma.universityStudent.findMany({
    where: {
      id: { in: uniqueStudentIds },
      userId: { not: null },
      user: { kycStatus: 'VERIFIED' },
      selection: null,
    },
  });
  if (students.length !== uniqueStudentIds.length) {
    throw new AppError(
      400,
      'INVALID_STUDENT',
      'One or more selected students are not eligible — they may already be selected, funded, or not KYC-verified'
    );
  }

  const created = await Promise.all(
    students.map((student) =>
      prisma.institutionStudentSelection.create({
        data: {
          institutionUserId,
          universityStudentId: student.id,
          amount: input.amountPerStudent,
          status: 'PENDING',
        },
      })
    )
  );

  const institution = await prisma.user.findUnique({
    where: { id: institutionUserId },
    select: { fullName: true },
  });
  const institutionName = institution?.fullName ?? 'Your institution';

  const fundingGaps = await Promise.all(
    students.map((student) =>
      getFundingBreakdown(student.userId as string, Number(student.totalCreditCost))
    )
  );

  await Promise.all(
    students.map(async (student, index) => {
      const parentalControls = await prisma.parentalControl.findMany({
        where: { studentUserId: student.userId as string },
      });
      if (parentalControls.length === 0) return;

      // fundingGap is what's outstanding BEFORE this selection's amount is applied — the same
      // basis the funding-status badges use (ScholarshipPortalTab.tsx, UniversityStudentsTab.tsx)
      // — not just totalCreditCost, which ignores money the parent or a prior disbursement
      // already covered and would otherwise report "still partial" on an already-funded student.
      const { fundingGap } = fundingGaps[index];
      const amountLabel = input.amountPerStudent.toFixed(2);
      const message =
        input.amountPerStudent >= fundingGap
          ? `${institutionName} has fully funded your child ${student.fullName}'s semester ($${amountLabel})`
          : `${institutionName} has partially funded your child ${student.fullName}'s semester ($${amountLabel}). Remaining gap: $${(fundingGap - input.amountPerStudent).toFixed(2)}`;

      await Promise.all(
        parentalControls.map((link) =>
          createNotification(link.parentUserId, 'Scholarship Selection', message, 'SCHOLARSHIP_SELECTED')
        )
      );
    })
  );

  return students.map((student, index) => ({
    selectionId: created[index].id,
    universityStudentId: student.id,
    userId: student.userId as string,
    studentNumber: student.studentNumber,
    fullName: student.fullName,
    totalCreditCost: formatMoney(student.totalCreditCost),
    amount: formatMoney(input.amountPerStudent),
    fundingStatus: computeFundingStatus(input.amountPerStudent, Number(student.totalCreditCost)),
    fundingGap: formatMoney(fundingGaps[index].fundingGap),
  }));
}

// Tab 2's list — students currently selected and awaiting a bulk send, scoped to the calling
// institution (unlike getVerifiedUniversityStudents()'s exclusion check, which is global).
export async function getSelectedStudents(institutionUserId: string): Promise<SelectedStudentSummary[]> {
  const selections = await prisma.institutionStudentSelection.findMany({
    where: { institutionUserId, status: 'PENDING' },
    include: { universityStudent: true },
    orderBy: { createdAt: 'asc' },
  });

  return Promise.all(
    selections.map(async (selection) => {
      const student = selection.universityStudent;
      const totalCreditCost = Number(student.totalCreditCost);
      const amount = Number(selection.amount);
      const { fundingGap } = await getFundingBreakdown(student.userId as string, totalCreditCost);
      return {
        selectionId: selection.id,
        universityStudentId: student.id,
        userId: student.userId as string,
        studentNumber: student.studentNumber,
        fullName: student.fullName,
        totalCreditCost: formatMoney(totalCreditCost),
        amount: formatMoney(amount),
        fundingStatus: computeFundingStatus(amount, totalCreditCost),
        fundingGap: formatMoney(fundingGap),
      };
    })
  );
}

export type DisburseSelectedResult = {
  disbursedCount: number;
  totalDisbursed: number;
  stillPending: number;
};

// Tab 2's "Send Disbursement" — pays out every PENDING selection for this institution at its
// stored (per-student) amount, in the chosen category, then clears the rows it successfully
// paid so those students become available again in Tab 1 and Tab 3. Reuses
// scholarship.service.ts's bulkDisburse() for the actual money movement (wallet debit/credit,
// LockedFund, student + parent notifications) rather than duplicating it — one call per
// student since each selection can carry a different amount. A student whose disbursement
// fails (e.g. the institution runs out of balance partway through the batch) is simply left
// PENDING for a later retry instead of aborting the whole batch.
export async function disburseSelected(
  institutionUserId: string,
  input: DisburseSelectedInput
): Promise<DisburseSelectedResult> {
  const pending = await prisma.institutionStudentSelection.findMany({
    where: { institutionUserId, status: 'PENDING' },
    include: { universityStudent: true },
  });

  const disbursedSelectionIds: string[] = [];
  let totalDisbursed = 0;

  for (const selection of pending) {
    const studentUserId = selection.universityStudent.userId;
    if (!studentUserId) continue;

    try {
      const result = await bulkDisburse(institutionUserId, {
        studentIds: [studentUserId],
        amountPerStudent: Number(selection.amount),
        currency: 'USD',
        category: input.category,
      });
      if (result.transactions.length > 0) {
        disbursedSelectionIds.push(selection.id);
        totalDisbursed += Number(selection.amount);
      }
      // Empty transactions means bulkDisburse skipped this student (e.g. KYC status changed
      // since selection) — leave PENDING rather than treating it as fatal for the batch.
    } catch (error) {
      // Most likely INSUFFICIENT_BALANCE — leave this student PENDING and keep going instead
      // of aborting every remaining student in the batch over one failure.
      if (!(error instanceof AppError)) {
        throw error;
      }
    }
  }

  if (disbursedSelectionIds.length > 0) {
    await prisma.institutionStudentSelection.deleteMany({
      where: { id: { in: disbursedSelectionIds } },
    });
  }

  return {
    disbursedCount: disbursedSelectionIds.length,
    totalDisbursed,
    stillPending: pending.length - disbursedSelectionIds.length,
  };
}

export type FundIndividualResult = {
  fundingStatus: FundingStatus;
  amount: string;
};

// Tab 3's "Fund This Student" — disburses directly to one student (same underlying logic as
// bulkDisburse, reused rather than duplicated) and, unlike Tab 2, marks the student FUNDED
// afterward instead of clearing the row — they stay hidden from Tab 1 and Tab 3 going
// forward, per the "no double funding" rule (schema.prisma's InstitutionSelectionStatus).
export async function fundIndividual(
  institutionUserId: string,
  input: FundIndividualInput
): Promise<FundIndividualResult> {
  const student = await prisma.universityStudent.findFirst({
    where: { userId: input.studentUserId, user: { kycStatus: 'VERIFIED' }, selection: null },
  });
  if (!student) {
    throw new AppError(
      400,
      'INVALID_STUDENT',
      'This student is not eligible — they may already be selected, funded, or not KYC-verified'
    );
  }

  const result = await bulkDisburse(institutionUserId, {
    studentIds: [input.studentUserId],
    amountPerStudent: input.amount,
    currency: 'USD',
    category: input.category,
  });
  if (result.transactions.length === 0) {
    throw new AppError(400, 'STUDENT_NOT_VERIFIED', 'This student is no longer KYC-verified');
  }

  await prisma.institutionStudentSelection.create({
    data: {
      institutionUserId,
      universityStudentId: student.id,
      amount: input.amount,
      status: 'FUNDED',
    },
  });

  return {
    fundingStatus: computeFundingStatus(input.amount, Number(student.totalCreditCost)),
    amount: formatMoney(input.amount),
  };
}
