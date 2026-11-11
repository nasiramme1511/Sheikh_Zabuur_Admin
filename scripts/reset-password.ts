import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const newPassword = process.argv[2];
  if (!newPassword) {
    console.error("Usage: npx tsx scripts/reset-password.ts <new-password>");
    process.exit(1);
  }

  const hash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.adminUser.update({
    where: { email: "admin@sheikhzabur.com" },
    data: {
      passwordHash: hash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log("✅ Password successfully updated for admin@sheikhzabur.com!");
  console.log("You can now log in with the new password.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
