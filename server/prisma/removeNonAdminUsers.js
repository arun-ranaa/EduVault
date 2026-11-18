require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const s3Service = require('../src/services/s3Service');

const prisma = new PrismaClient();

async function main() {
  console.log('Finding all non-admin users...');

  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    select: {
      id: true,
      name: true,
      email: true,
      resources: { select: { s3Key: true } },
      vaultFiles: { select: { s3Key: true } },
    },
  });

  if (nonAdminUsers.length === 0) {
    console.log('No non-admin users found. Only admin account(s) exist.');
    return;
  }

  console.log(`Found ${nonAdminUsers.length} non-admin user(s) to remove:`);
  nonAdminUsers.forEach((u) => console.log(`  - ${u.name} (${u.email})`));

  const userIds = nonAdminUsers.map((u) => u.id);

  // Clean up any S3 files belonging to removed users
  const s3Keys = [
    ...nonAdminUsers.flatMap((u) => u.resources.map((r) => r.s3Key)),
    ...nonAdminUsers.flatMap((u) => u.vaultFiles.map((v) => v.s3Key)),
  ].filter(Boolean);

  if (s3Keys.length > 0) {
    console.log(`Deleting ${s3Keys.length} S3 object(s) owned by removed users...`);
    for (let i = 0; i < s3Keys.length; i += 1000) {
      const batch = s3Keys.slice(i, i + 1000);
      try {
        await s3Service.deleteMultipleS3Objects(batch);
      } catch (err) {
        console.warn('Warning: S3 cleanup batch failed (continuing DB cleanup):', err.message);
      }
    }
  }

  // Delete activity logs created by removed users
  const deletedActivities = await prisma.activity.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log(`Deleted ${deletedActivities.count} activity log(s) for removed users.`);

  // Delete all non-admin users (cascades to their resources, bookmarks, and vault files)
  const deletedUsers = await prisma.user.deleteMany({
    where: { role: { not: 'ADMIN' } },
  });
  console.log(`Deleted ${deletedUsers.count} non-admin user(s).`);

  // Verify remaining users
  const remaining = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isEmailVerified: true },
  });
  console.log('\nRemaining user(s) in database:');
  remaining.forEach((u) =>
    console.log(`  - [${u.role}] ${u.name} (${u.email}) | verified: ${u.isEmailVerified}`)
  );
}

main()
  .catch((e) => {
    console.error('Error removing non-admin users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
