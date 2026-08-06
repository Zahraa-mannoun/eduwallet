import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import type { PrepareDisbursementInput } from './university.schema';

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
  totalCreditCost: string;
  courses: UniversityStudentCourse[];
  received: string;
  fundingGap: string;
};

// "Received" is the running total of every institution-to-student transfer that ever landed
// in this wallet — a transaction counts as scholarship money by virtue of who sent it
// (fromWallet.user.userType === 'INSTITUTION'), since disbursements are the only path an
// institution has to move money to a student at all (scholarship.service.ts bulkDisburse()).
async function getScholarshipReceived(userId: string): Promise<number> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true } });
  const walletIds = wallets.map((wallet) => wallet.id);
  if (walletIds.length === 0) {
    return 0;
  }

  const aggregate = await prisma.transaction.aggregate({
    where: {
      toWalletId: { in: walletIds },
      status: { in: ['AUTO_APPROVED', 'APPROVED'] },
      fromWallet: { user: { userType: 'INSTITUTION' } },
    },
    _sum: { amount: true },
  });

  return Number(aggregate._sum.amount ?? 0);
}

export async function getVerifiedUniversityStudents(): Promise<UniversityStudentSummary[]> {
  const students = await prisma.universityStudent.findMany({
    where: { userId: { not: null }, user: { kycStatus: 'VERIFIED' } },
    include: { enrolledCourses: true },
    orderBy: { fullName: 'asc' },
  });

  return Promise.all(
    students.map(async (student) => {
      // Guaranteed non-null by the `userId: { not: null }` filter above — Prisma's generated
      // type still widens it to string | null since the filter isn't visible to the type system.
      const userId = student.userId as string;
      const totalCreditCost = Number(student.totalCreditCost);
      const received = await getScholarshipReceived(userId);

      return {
        id: student.id,
        userId,
        studentNumber: student.studentNumber,
        fullName: student.fullName,
        email: student.email,
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
        fundingGap: formatMoney(Math.max(0, totalCreditCost - received)),
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
