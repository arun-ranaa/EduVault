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
  console.log(`Created Admin user: ${admin.email} / Admin@123`);

  // Create normal users
  const user1 = await prisma.user.upsert({
    where: { email: 'user1@eduvault.com' },
    update: {
      passwordHash: userPassword,
      isActive: true,
      isEmailVerified: true,
    },
    create: {
      name: 'Test User 1',
      email: 'user1@eduvault.com',
      passwordHash: userPassword,
      role: 'USER',
      isEmailVerified: true,
    },
  });
  console.log(`Created Normal user 1: ${user1.email} / User@123`);

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@eduvault.com' },
    update: { passwordHash: userPassword, isActive: true, isEmailVerified: true },
    create: {
      name: 'Test User 2',
      email: 'user2@eduvault.com',
      passwordHash: userPassword,
      role: 'USER',
      isEmailVerified: true,
    },
  });
  console.log(`Created Normal user 2: ${user2.email} / User@123`);

  // 10 Dummy Student Accounts
  const dummyUsers = [
    { name: 'Aarav Sharma', email: 'aarav@eduvault.com' },
    { name: 'Priya Patel', email: 'priya@eduvault.com' },
    { name: 'Rahul Verma', email: 'rahul@eduvault.com' },
    { name: 'Sneha Reddy', email: 'sneha@eduvault.com' },
    { name: 'Vikram Singh', email: 'vikram@eduvault.com' },
    { name: 'Ananya Iyer', email: 'ananya@eduvault.com' },
    { name: 'Rohan Gupta', email: 'rohan@eduvault.com' },
    { name: 'Neha Joshi', email: 'neha@eduvault.com' },
    { name: 'Aditya Nair', email: 'aditya@eduvault.com' },
    { name: 'Pooja Mehta', email: 'pooja@eduvault.com' }
  ];

  for (const u of dummyUsers) {
    const student = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash: userPassword, isActive: true, isEmailVerified: true },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: userPassword,
        role: 'USER',
        isEmailVerified: true,
      },
    });
    console.log(`Created Student: ${student.name} (${student.email}) / User@123`);
  }

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
