require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // Create default categories
  const categories = [
    'Notes',
    'Books',
    'Question Papers',
    'Assignments',
    'Study Material',
    'Lab Resources'
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`Seeded category: ${name}`);
  }

  // Require explicit ADMIN_SEED_PASSWORD when creating/updating admin (never use hardcoded default credentials)
  const envAdminPassword = process.env.ADMIN_SEED_PASSWORD;
  const adminEmail = (process.env.ADMIN_SEED_EMAIL || 'admin@eduvault.com').trim().toLowerCase();

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin && (!envAdminPassword || envAdminPassword.length < 12)) {
    throw new Error(
      'ADMIN_SEED_PASSWORD (min 12 characters) must be set in environment variables to create the initial admin user.'
    );
  }

  if (envAdminPassword && envAdminPassword.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters long.');
  }

  const adminPasswordHash = envAdminPassword ? await bcrypt.hash(envAdminPassword, 12) : undefined;

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { email: adminEmail },
        data: {
          role: 'ADMIN',
          isActive: true,
          isEmailVerified: true,
          ...(adminPasswordHash
            ? { passwordHash: adminPasswordHash, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } }
            : {}),
        },
      })
    : await prisma.user.create({
        data: {
          name: 'Admin User',
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: 'ADMIN',
          isActive: true,
          isEmailVerified: true,
        },
      });
  console.log(`Seeded Admin user: ${admin.email} (password unchanged unless ADMIN_SEED_PASSWORD was provided)`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
