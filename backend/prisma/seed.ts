import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import type { UserType } from '@prisma/client';

const prisma = new PrismaClient();

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
const SEED_WALLET_BALANCE = 0;

async function seedUserWithWallet(
  email: string,
  password: string,
  fullName: string,
  userType: UserType
) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      fullName,
      userType,
    },
  });

  const existingWallet = await prisma.wallet.findFirst({
    where: { userId: user.id, currency: 'USD' },
  });

  if (!existingWallet) {
    await prisma.wallet.create({
      data: {
        userId: user.id,
        currency: 'USD',
        balance: SEED_WALLET_BALANCE,
      },
    });
  }

  console.log(`Seeded ${userType} -> ${email}`);
  return user;
}

async function seedMerchants(): Promise<void> {
  const merchants: Array<{
    name: string;
    category: 'FOOD' | 'LIFESTYLE' | 'SOFTWARE' | 'BOOKS';
    city: string;
    country: string;
    type: 'RESTAURANT' | 'SHOPPING_CENTER' | 'SOFTWARE_STORE' | 'BOOKSTORE';
  }> = [
    { name: 'Le Burger Montréal', category: 'FOOD', city: 'Montreal', country: 'Canada', type: 'RESTAURANT' },
    { name: 'Café Vienne', category: 'FOOD', city: 'Montreal', country: 'Canada', type: 'RESTAURANT' },
    { name: 'Restaurant Hakim', category: 'FOOD', city: 'Montreal', country: 'Canada', type: 'RESTAURANT' },
    { name: 'Carrefour Laval', category: 'LIFESTYLE', city: 'Montreal', country: 'Canada', type: 'SHOPPING_CENTER' },
    { name: "Galeries d'Anjou", category: 'LIFESTYLE', city: 'Montreal', country: 'Canada', type: 'SHOPPING_CENTER' },
    { name: 'Centre Eaton', category: 'LIFESTYLE', city: 'Montreal', country: 'Canada', type: 'SHOPPING_CENTER' },
    { name: 'TechZone Montréal', category: 'SOFTWARE', city: 'Montreal', country: 'Canada', type: 'SOFTWARE_STORE' },
    { name: 'iStore MTL', category: 'SOFTWARE', city: 'Montreal', country: 'Canada', type: 'SOFTWARE_STORE' },
    { name: 'Digital Hub', category: 'SOFTWARE', city: 'Montreal', country: 'Canada', type: 'SOFTWARE_STORE' },
    { name: 'Librairie Renaud-Bray', category: 'BOOKS', city: 'Montreal', country: 'Canada', type: 'BOOKSTORE' },
    { name: 'Paragraphe Bookstore', category: 'BOOKS', city: 'Montreal', country: 'Canada', type: 'BOOKSTORE' },
  ];

  for (const merchant of merchants) {
    const existing = await prisma.merchant.findFirst({ where: { name: merchant.name } });
    if (!existing) {
      await prisma.merchant.create({ data: merchant });
    }
  }

  console.log(`Seeded ${merchants.length} merchants`);
}

async function seedUniversity(): Promise<void> {
  const university =
    (await prisma.university.findFirst({ where: { name: 'Université de Montréal' } })) ??
    (await prisma.university.create({
      data: {
        name: 'Université de Montréal',
        city: 'Montreal',
        country: 'Canada',
      },
    }));

  const existingCourses = await prisma.universityCourse.findMany({ where: { universityId: university.id } });
  const courseData = [
    { courseName: 'Introduction to Computer Science', credits: 3, costPerCredit: 250, semester: 'Fall 2026' },
    { courseName: 'Calculus I', credits: 4, costPerCredit: 250, semester: 'Fall 2026' },
    { courseName: 'Financial Accounting', credits: 3, costPerCredit: 250, semester: 'Fall 2026' },
    { courseName: 'Introduction to Psychology', credits: 3, costPerCredit: 250, semester: 'Fall 2026' },
    { courseName: 'Academic Writing', credits: 2, costPerCredit: 250, semester: 'Fall 2026' },
  ];

  const courses =
    existingCourses.length > 0
      ? existingCourses
      : await Promise.all(
          courseData.map((c) =>
            prisma.universityCourse.create({
              data: {
                universityId: university.id,
                courseName: c.courseName,
                credits: c.credits,
                costPerCredit: c.costPerCredit,
                totalCost: c.credits * c.costPerCredit,
                semester: c.semester,
              },
            })
          )
        );

  const existingStudents = await prisma.universityStudent.count({ where: { universityId: university.id } });
  if (existingStudents === 0) {
    for (let i = 1; i <= 10; i += 1) {
      const enrolledCourses = courses.slice(0, 2 + (i % 3));
      const totalCreditCost = enrolledCourses.reduce(
        (sum, c) => sum + Number(c.totalCost),
        0
      );

      await prisma.universityStudent.create({
        data: {
          universityId: university.id,
          studentNumber: `UDM-2026-${String(i).padStart(4, '0')}`,
          fullName: `Student ${i}`,
          email: `student${i}@udm-demo.ca`,
          totalCreditCost,
          enrolledCourses: { connect: enrolledCourses.map((c) => ({ id: c.id })) },
        },
      });
    }
  }

  console.log('Seeded 1 university with 5 courses and 10 enrolled students');
}

async function main(): Promise<void> {
  await seedUserWithWallet('admin@eduwallet.com', 'Admin@123', 'Admin User', 'ADMIN');
  await seedMerchants();
  await seedUniversity();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
