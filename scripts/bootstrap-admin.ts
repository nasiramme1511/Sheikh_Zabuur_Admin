import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

async function main() {
  console.log('=================================================================');
  console.log('👑  Sheikh Zabuur Admin — Super Admin Account Bootstrap CLI');
  console.log('=================================================================\n');

  const email = getArg('--email') || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = getArg('--password') || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = getArg('--name') || process.env.BOOTSTRAP_ADMIN_NAME || 'Super Administrator';

  if (!email || !password) {
    console.error('❌ Error: Missing required arguments.');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/bootstrap-admin.ts --email <email> --password <password> [--name <name>]\n');
    console.log('Or set environment variables:');
    console.log('  BOOTSTRAP_ADMIN_EMAIL=admin@sheikhzabur.com BOOTSTRAP_ADMIN_PASSWORD=... npx tsx scripts/bootstrap-admin.ts\n');
    process.exit(1);
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('❌ Error: Invalid email format.');
    process.exit(1);
  }

  // Validate password length
  if (password.length < 10) {
    console.error('❌ Error: Password must be at least 10 characters for administrative security.');
    process.exit(1);
  }

  // Check if role exists
  const superAdminRole = await prisma.adminRole.findUnique({
    where: { id: 'SUPER_ADMIN' },
  });

  if (!superAdminRole) {
    console.error('❌ Error: SUPER_ADMIN role not found. Please run "npm run db:seed" first.');
    process.exit(1);
  }

  // Check if user already exists
  const existingUser = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    console.error(`❌ Error: An administrator with email "${email}" already exists (User ID: ${existingUser.id}).`);
    process.exit(1);
  }

  console.log(`🔐 Hashing password with Argon2id (memoryCost: 65,536 KiB, timeCost: 3)...`);
  const passwordHash = await hashPassword(password);

  console.log(`📝 Creating Super Admin user record in database...`);
  const newUser = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash,
      roleId: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // Record audit event
  await prisma.auditLog.create({
    data: {
      adminUserId: newUser.id,
      action: 'ADMIN_BOOTSTRAP',
      entityType: 'AdminUser',
      entityId: newUser.id,
      details: {
        email: newUser.email,
        name: newUser.name,
        roleId: newUser.roleId,
        source: 'CLI_BOOTSTRAP',
      },
    },
  });

  console.log('\n✅ Super Administrator account provisioned successfully!');
  console.log(`   User ID: ${newUser.id}`);
  console.log(`   Email:   ${newUser.email}`);
  console.log(`   Name:    ${newUser.name}`);
  console.log(`   Role:    ${newUser.roleId}`);
  console.log('\nYou can now log in through the admin dashboard.\n');
}

main()
  .catch((e) => {
    console.error('❌ Bootstrap failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
