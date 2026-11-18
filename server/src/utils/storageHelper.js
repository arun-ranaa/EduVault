const prisma = require('../config/database');

/**
 * Computes actual storage usage (resources + vault files) grouped by user ID.
 * Returns a Map<number, { resourceBytes: number, vaultBytes: number, totalBytes: number }>.
 */
const getUsersStorageUsageMap = async (userIds = null) => {
  const resourceWhere = Array.isArray(userIds)
    ? { uploadedById: { in: userIds } }
    : undefined;
  const vaultWhere = Array.isArray(userIds)
    ? { ownerId: { in: userIds } }
    : undefined;

  if (Array.isArray(userIds) && userIds.length === 0) {
    return new Map();
  }

  const [resourceSums, vaultSums] = await Promise.all([
    prisma.resource.groupBy({
      by: ['uploadedById'],
      where: resourceWhere,
      _sum: { fileSize: true },
    }),
    prisma.vaultFile.groupBy({
      by: ['ownerId'],
      where: vaultWhere,
      _sum: { fileSize: true },
    }),
  ]);

  const usageMap = new Map();

  for (const row of resourceSums) {
    const resourceBytes = Number(row._sum.fileSize || 0);
    usageMap.set(row.uploadedById, {
      resourceBytes,
      vaultBytes: 0,
      totalBytes: resourceBytes,
    });
  }

  for (const row of vaultSums) {
    const vaultBytes = Number(row._sum.fileSize || 0);
    const existing = usageMap.get(row.ownerId);
    if (existing) {
      existing.vaultBytes = vaultBytes;
      existing.totalBytes = existing.resourceBytes + vaultBytes;
    } else {
      usageMap.set(row.ownerId, {
        resourceBytes: 0,
        vaultBytes,
        totalBytes: vaultBytes,
      });
    }
  }

  return usageMap;
};

/**
 * Computes actual storage usage (resources + vault files) for a single user.
 */
const getUserStorageUsage = async (userId, dbClient = prisma) => {
  const [resourceAgg, vaultAgg] = await Promise.all([
    dbClient.resource.aggregate({
      where: { uploadedById: userId },
      _sum: { fileSize: true },
    }),
    dbClient.vaultFile.aggregate({
      where: { ownerId: userId },
      _sum: { fileSize: true },
    }),
  ]);

  const resourceBytes = Number(resourceAgg._sum.fileSize || 0);
  const vaultBytes = Number(vaultAgg._sum.fileSize || 0);

  return {
    resourceBytes,
    vaultBytes,
    totalBytes: resourceBytes + vaultBytes,
  };
};

/**
 * Computes total platform storage used across all resources and vault files.
 */
const getTotalPlatformStorageUsed = async (dbClient = prisma) => {
  const [resourceAgg, vaultAgg] = await Promise.all([
    dbClient.resource.aggregate({
      _sum: { fileSize: true },
    }),
    dbClient.vaultFile.aggregate({
      _sum: { fileSize: true },
    }),
  ]);

  const resourceBytes = Number(resourceAgg._sum.fileSize || 0);
  const vaultBytes = Number(vaultAgg._sum.fileSize || 0);

  return {
    resourceBytes,
    vaultBytes,
    totalBytes: resourceBytes + vaultBytes,
  };
};

/**
 * Recomputes and persists a user's exact storageUsed (resources + vault files) in the database.
 */
const syncUserStorageUsed = async (tx, userId) => {
  const [resourceAgg, vaultAgg] = await Promise.all([
    tx.resource.aggregate({
      where: { uploadedById: userId },
      _sum: { fileSize: true },
    }),
    tx.vaultFile.aggregate({
      where: { ownerId: userId },
      _sum: { fileSize: true },
    }),
  ]);

  const totalUsed = BigInt(resourceAgg._sum.fileSize || 0) + BigInt(vaultAgg._sum.fileSize || 0);

  await tx.user.update({
    where: { id: userId },
    data: { storageUsed: totalUsed },
  });

  return Number(totalUsed);
};

module.exports = {
  getUsersStorageUsageMap,
  getUserStorageUsage,
  getTotalPlatformStorageUsed,
  syncUserStorageUsed,
};
