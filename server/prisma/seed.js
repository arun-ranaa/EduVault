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

  // Hash passwords
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const userPassword = await bcrypt.hash('User@123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eduvault.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@eduvault.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`Created Admin user: ${admin.email} / Admin@123`);

  // Create normal users
  const user1 = await prisma.user.upsert({
    where: { email: 'user1@eduvault.com' },
    update: {},
    create: {
      name: 'Test User 1',
      email: 'user1@eduvault.com',
      passwordHash: userPassword,
      role: 'USER',
    },
  });
  console.log(`Created Normal user 1: ${user1.email} / User@123`);

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@eduvault.com' },
    update: {},
    create: {
      name: 'Test User 2',
      email: 'user2@eduvault.com',
      passwordHash: userPassword,
      role: 'USER',
    },
  });
  console.log(`Created Normal user 2: ${user2.email} / User@123`);

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
