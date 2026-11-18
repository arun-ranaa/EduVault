const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // Create categories
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
    console.log(`Created category: ${name}`);
  }

  // Hash password
  const adminPassword = await bcrypt.hash('Admin@123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eduvault.com' },
    update: {
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
    create: {
      name: 'Admin User',
      email: 'admin@eduvault.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`Seeded Admin user: ${admin.email} / Admin@123`);

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
