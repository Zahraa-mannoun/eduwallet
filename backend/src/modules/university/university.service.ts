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

// Sums every completed transfer into this student's wallet(s) sent by a user of the given
// role — "received" (INSTITUTION) and "parentSent" (PARENT) both funnel through this, since
// the only thing distinguishing scholarship money from a parent's locked transfer is who sent
// it (fromWallet.user.userType), not anything recorded on the wallet/LockedFund itself.
async function getTransfersFromRole(
  userId: string,
  senderRole: 'INSTITUTION' | 'PARENT'
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
      fromWallet: { user: { userType: senderRole } },
    },
    _sum: { amount: true },
  });

  return Number(aggregate._sum.amount ?? 0);
}

// Excludes any student currently selected for Tab 2 (PENDING) or already individually funded
// via Tab 3 (FUNDED) — the InstitutionStudentSelection row is what enforces "no double
// funding" across the Institution dashboard's 3 tabs (see schema.prisma's model comment).
export async function getVerifiedUniversityStudents(): Promise<UniversityStudentSummary[]> {
  const students = await prisma.universityStudent.findMany({
    where: { userId: { not: null }, user: { kycStatus: 'VERIFIED' }, selection: null },
    include: { enrolledCourses: true, university: true },
    orderBy: { fullName: 'asc' },
  });

  return Promise.all(
    students.map(async (student) => {
      // Guaranteed non-null by the `userId: { not: null }` filter above — Prisma's generated
      // type still widens it to string | null since the filter isn't visible to the type system.
      const userId = student.userId as string;
      const totalCreditCost = Number(student.totalCreditCost);
      const [received, parentSent] = await Promise.all([
        getTransfersFromRole(userId, 'INSTITUTION'),
        getTransfersFromRole(userId, 'PARENT'),
      ]);

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
        fundingGap: formatMoney(Math.max(0, totalCreditCost - received - parentSent)),
      };
    })
  );
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

  await Promise.all(
    students.map(async (student) => {
      const parentalControls = await prisma.parentalControl.findMany({
        where: { studentUserId: student.userId as string },
      });
      if (parentalControls.length === 0) return;

      const totalCreditCost = Number(student.totalCreditCost);
      const status = computeFundingStatus(input.amountPerStudent, totalCreditCost);
      const message = `Your child ${student.fullName} has been selected for a $${input.amountPerStudent.toFixed(2)} scholarship — ${status === 'FULL' ? 'Fully' : 'Partially'} funded`;

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

  return selections.map((selection) => {
    const student = selection.universityStudent;
    const totalCreditCost = Number(student.totalCreditCost);
    const amount = Number(selection.amount);
    return {
      selectionId: selection.id,
      universityStudentId: student.id,
      userId: student.userId as string,
      studentNumber: student.studentNumber,
      fullName: student.fullName,
      totalCreditCost: formatMoney(totalCreditCost),
      amount: formatMoney(amount),
      fundingStatus: computeFundingStatus(amount, totalCreditCost),
    };
  });
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
