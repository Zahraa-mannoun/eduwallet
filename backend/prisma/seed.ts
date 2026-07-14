import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import type { UserType } from '@prisma/client';

const prisma = new PrismaClient();

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
const SEED_WALLET_BALANCE = 1000;

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

async function main(): Promise<void> {
  await seedUserWithWallet('admin@eduwallet.com', 'Admin123!', 'Admin User', 'ADMIN');
  await seedUserWithWallet('student@test.com', 'Student123!', 'Test Student', 'STUDENT');
  await seedUserWithWallet('parent@test.com', 'Parent123!', 'Test Parent', 'PARENT');
  await seedUserWithWallet(
    'institution@test.com',
    'Institution123!',
    'Test Institution',
    'INSTITUTION'
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
