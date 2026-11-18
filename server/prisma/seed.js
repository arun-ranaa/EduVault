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

  // Only reset existing admin password when ADMIN_SEED_PASSWORD is explicitly provided
  const envAdminPassword = process.env.ADMIN_SEED_PASSWORD;
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@eduvault.com';
  const initialPassword = envAdminPassword || 'Admin@123';
  const adminPasswordHash = await bcrypt.hash(initialPassword, 12);

  const updateData = {
    role: 'ADMIN',
    isActive: true,
    isEmailVerified: true,
    ...(envAdminPassword ? { passwordHash: adminPasswordHash } : {}),
  };

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: updateData,
    create: {
      name: 'Admin User',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
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
