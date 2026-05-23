import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database...');

  // ─── Roles ────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { slug: 'superadmin' },
      update: {},
      create: {
        name: 'Super Admin',
        slug: 'superadmin',
        description: 'Platform-wide administrator',
      },
    }),
    prisma.role.upsert({
      where: { slug: 'admin' },
      update: {},
      create: {
        name: 'Admin',
        slug: 'admin',
        description: 'Agency administrator',
      },
    }),
    prisma.role.upsert({
      where: { slug: 'accountant' },
      update: {},
      create: {
        name: 'Accountant',
        slug: 'accountant',
        description: 'Agency accountant — financial access only',
      },
    }),
  ]);

  console.log(`✅  Roles created: ${roles.map((r) => r.slug).join(', ')}`);

  // ─── Default superadmin ───────────────────────────────────
  const superadminRole = roles.find((r) => r.slug === 'superadmin')!;
  const password = await bcrypt.hash('Admin@1234', 12);

  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@mapticket.com' },
    update: {},
    create: {
      roleId: superadminRole.id,
      username: 'superadmin',
      email: 'superadmin@mapticket.com',
      password,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅  Superadmin created: ${superadmin.email}`);
  console.log('\n🔑  Default credentials:');
  console.log('    Email    : superadmin@mapticket.com');
  console.log('    Password : Admin@1234');
  console.log('\n⚠️   Change the default password immediately after first login!\n');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
