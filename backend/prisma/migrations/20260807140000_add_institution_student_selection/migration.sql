-- CreateEnum
CREATE TYPE "InstitutionSelectionStatus" AS ENUM ('PENDING', 'FUNDED');

-- CreateTable
CREATE TABLE "institution_student_selections" (
    "id" TEXT NOT NULL,
    "institutionUserId" TEXT NOT NULL,
    "universityStudentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "InstitutionSelectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_student_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_student_selections_universityStudentId_key" ON "institution_student_selections"("universityStudentId");

-- CreateIndex
CREATE INDEX "institution_student_selections_institutionUserId_idx" ON "institution_student_selections"("institutionUserId");

-- AddForeignKey
ALTER TABLE "institution_student_selections" ADD CONSTRAINT "institution_student_selections_institutionUserId_fkey" FOREIGN KEY ("institutionUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_student_selections" ADD CONSTRAINT "institution_student_selections_universityStudentId_fkey" FOREIGN KEY ("universityStudentId") REFERENCES "university_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
