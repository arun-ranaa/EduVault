const prisma = require('../config/database');
const s3Service = require('../services/s3Service');
const { AppError } = require('../middleware/errorHandler');
const { serializeBigInt, paginate, buildPaginationResponse } = require('../utils/helpers');
const {
  getUsersStorageUsageMap,
  getUserStorageUsage,
  getTotalPlatformStorageUsed,
  syncUserStorageUsed,
} = require('../utils/storageHelper');
const {
  getCategoriesWithCounts,
  buildCategoryFilterCondition,
} = require('../utils/categoryHelper');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, totalResources, totalVaultFiles, storageTotals] = await Promise.all([
      prisma.user.count(),
      prisma.resource.count(),
      prisma.vaultFile.count(),
      getTotalPlatformStorageUsed(),
    ]);

    const totalStorageUsed = storageTotals.totalBytes;

    const resourcesGrouped = await prisma.resource.groupBy({
      by: ['resourceType'],
      _count: { resourceType: true },
    });
    const resourcesByType = resourcesGrouped.map(item => ({
      type: item.resourceType,
      count: item._count.resourceType,
    }));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivityCount = await prisma.activity.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalResources,
        totalVaultFiles,
        totalStorageUsed,
        resourceStorageUsed: storageTotals.resourceBytes,
        vaultStorageUsed: storageTotals.vaultBytes,
        resourcesByType,
        recentActivityCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          storageQuota: true,
          storageUsed: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const usageMap = await getUsersStorageUsageMap(users.map((u) => u.id));
    const enrichedUsers = users.map((user) => {
      const usage = usageMap.get(user.id) || { resourceBytes: 0, vaultBytes: 0, totalBytes: 0 };
      return {
        ...serializeBigInt(user),
        storageUsed: usage.totalBytes,
        resourceStorageUsed: usage.resourceBytes,
        vaultStorageUsed: usage.vaultBytes,
      };
    });

    res.status(200).json({
      success: true,
      data: enrichedUsers,
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid user ID', 400);

    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          storageQuota: true,
          storageUsed: true,
          createdAt: true,
          _count: {
            select: {
              resources: true,
              vaultFiles: true,
              bookmarks: true,
            },
          },
        },
      }),
      getUserStorageUsage(id),
    ]);

    if (!user) throw new AppError('User not found', 404);

    res.status(200).json({
      success: true,
      data: {
        ...serializeBigInt(user),
        storageUsed: usage.totalBytes,
        resourceStorageUsed: usage.resourceBytes,
        vaultStorageUsed: usage.vaultBytes,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid user ID', 400);

    if (id === req.user.id) {
      throw new AppError('Cannot deactivate your own account', 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('User not found', 404);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserQuota = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid user ID', 400);

    const { storageQuota } = req.body;
    const numericQuota = Number(storageQuota);

    if (storageQuota === undefined || isNaN(numericQuota) || numericQuota <= 0) {
      throw new AppError('Invalid storage quota', 400);
    }

    const [updatedUser, usage] = await Promise.all([
      prisma.user.update({
        where: { id },
        data: { storageQuota: BigInt(Math.round(numericQuota)) },
        select: { id: true, name: true, email: true, storageQuota: true, storageUsed: true },
      }),
      getUserStorageUsage(id),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...serializeBigInt(updatedUser),
        storageUsed: usage.totalBytes,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdminResources = async (req, res, next) => {
  try {
    const { page, limit, search, category, resourceType, type } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = {};
    const andConditions = [];
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
        ],
      });
    }
    if (category) {
      const categoryCondition = await buildCategoryFilterCondition(prisma, category);
      if (categoryCondition) {
        andConditions.push(categoryCondition);
      }
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const effectiveResourceType = resourceType || type;
    if (effectiveResourceType) {
      where.resourceType = effectiveResourceType;
    }

    const [total, resources] = await Promise.all([
      prisma.resource.count({ where }),
      prisma.resource.findMany({
        where,
        skip,
        take,
        include: {
          category: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: serializeBigInt(resources),
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdminResource = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid resource ID', 400);

    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new AppError('Resource not found', 404);

    if (resource.s3Key) {
      await s3Service.deleteS3Object(resource.s3Key);
    }

    await prisma.$transaction(async (tx) => {
      await tx.resourceTag.deleteMany({ where: { resourceId: id } });
      await tx.bookmark.deleteMany({ where: { resourceId: id } });
      await tx.resource.delete({ where: { id } });
      await syncUserStorageUsed(tx, resource.uploadedById);
      await tx.activity.create({
        data: {
          action: 'RESOURCE_DELETED',
          userId: req.user.id,
          details: `Admin deleted resource: ${resource.title}`,
          metadata: { resourceId: resource.id, title: resource.title },
        },
      });
    });

    res.status(200).json({ success: true, message: 'Resource deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await getCategoriesWithCounts(prisma);

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) throw new AppError('Category with this name already exists', 409);

    const category = await prisma.category.create({
      data: { name, description: description || null },
    });

    await prisma.activity.create({
      data: {
        action: 'CATEGORY_CREATED',
        userId: req.user.id,
        details: `Created category: ${category.name}`,
        metadata: { categoryId: category.id, name: category.name },
      },
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid category ID', 400);

    const { name, description } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new AppError('Category not found', 404);

    if (name && name !== category.name) {
      const existing = await prisma.category.findUnique({ where: { name } });
      if (existing) throw new AppError('Category name already in use', 409);
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { name, description: description !== undefined ? description : category.description },
    });

    await prisma.activity.create({
      data: {
        action: 'CATEGORY_UPDATED',
        userId: req.user.id,
        details: `Updated category: ${updatedCategory.name}`,
        metadata: { categoryId: updatedCategory.id, name: updatedCategory.name },
      },
    });

    res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid category ID', 400);

    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { resources: true } } },
    });

    if (!category) throw new AppError('Category not found', 404);
    if (category._count.resources > 0) {
      throw new AppError('Cannot delete category containing resources. Remove or reassign resources first.', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await tx.activity.create({
        data: {
          action: 'CATEGORY_DELETED',
          userId: req.user.id,
          details: `Deleted category: ${category.name}`,
          metadata: { categoryId: id, name: category.name },
        },
      });
    });

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getActivities = async (req, res, next) => {
  try {
    const { page, limit, action } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = {};
    if (action) where.action = action;

    const [total, activities] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: activities,
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.getStorageStats = async (req, res, next) => {
  try {
    const [users, usageMap] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, storageUsed: true, storageQuota: true },
      }),
      getUsersStorageUsageMap(),
    ]);

    let totalUsed = 0;
    let totalQuota = 0;

    const userBreakdown = users
      .map(user => {
        const usage = usageMap.get(user.id) || { resourceBytes: 0, vaultBytes: 0, totalBytes: 0 };
        const used = usage.totalBytes;
        const quota = Number(user.storageQuota || 0);
        totalUsed += used;
        totalQuota += quota;
        return {
          ...user,
          storageUsed: used,
          resourceStorageUsed: usage.resourceBytes,
          vaultStorageUsed: usage.vaultBytes,
          storageQuota: quota,
        };
      })
      .sort((a, b) => b.storageUsed - a.storageUsed);

    res.status(200).json({
      success: true,
      data: {
        totalUsed,
        totalQuota,
        userBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};
