const prisma = require('../config/database');

const RESOURCE_TYPES = [
  'NOTES',
  'BOOK',
  'QUESTION_PAPER',
  'ASSIGNMENT',
  'STUDY_MATERIAL',
  'QUESTION_BANK',
  'LAB_RESOURCE',
  'OTHER',
];

/**
 * Normalizes a category name or ResourceType enum value for singular/plural matching.
 * Example: 'Question Papers' -> 'question paper', 'QUESTION_PAPER' -> 'question paper'
 */
const normalizeCategoryKey = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '');

const RESOURCE_TYPE_BY_KEY = new Map(
  RESOURCE_TYPES.map((type) => [normalizeCategoryKey(type), type])
);

/**
 * Returns the matching ResourceType enum value if a category name corresponds to one, else null.
 */
const getResourceTypeForCategoryName = (categoryName) => {
  if (!categoryName) return null;
  return RESOURCE_TYPE_BY_KEY.get(normalizeCategoryKey(categoryName)) || null;
};

/**
 * Finds an existing category ID whose name matches the given ResourceType.
 */
const findMatchingCategoryId = async (dbClient, resourceType) => {
  if (!resourceType) return null;
  const targetKey = normalizeCategoryKey(resourceType);
  const categories = await dbClient.category.findMany({
    select: { id: true, name: true },
  });

  const matched = categories.find(
    (cat) => normalizeCategoryKey(cat.name) === targetKey
  );
  return matched ? matched.id : null;
};

/**
 * Returns all categories with accurate resource counts, including uncategorized resources
 * (categoryId = null) whose resourceType matches the category name.
 */
const getCategoriesWithCounts = async (dbClient = prisma) => {
  const [categories, uncategorizedGrouped] = await Promise.all([
    dbClient.category.findMany({
      include: {
        _count: { select: { resources: true } },
      },
      orderBy: { name: 'asc' },
    }),
    dbClient.resource.groupBy({
      by: ['resourceType'],
      where: { categoryId: null },
      _count: { id: true },
    }),
  ]);

  const uncategorizedCountByType = new Map(
    uncategorizedGrouped.map((row) => [row.resourceType, row._count.id])
  );

  return categories.map((cat) => {
    const matchedType = getResourceTypeForCategoryName(cat.name);
    const fallbackCount = matchedType ? (uncategorizedCountByType.get(matchedType) || 0) : 0;
    const explicitCount = cat._count?.resources || 0;

    return {
      ...cat,
      _count: {
        ...cat._count,
        resources: explicitCount + fallbackCount,
      },
    };
  });
};

/**
 * Builds a Prisma condition for filtering resources by category ID, including legacy
 * uncategorized resources whose resourceType matches the category's name.
 */
const buildCategoryFilterCondition = async (dbClient, categoryId) => {
  const parsedId = parseInt(categoryId, 10);
  if (isNaN(parsedId)) return null;

  const category = await dbClient.category.findUnique({
    where: { id: parsedId },
    select: { id: true, name: true },
  });

  if (!category) {
    return { categoryId: parsedId };
  }

  const matchedType = getResourceTypeForCategoryName(category.name);
  if (!matchedType) {
    return { categoryId: parsedId };
  }

  return {
    OR: [
      { categoryId: parsedId },
      { categoryId: null, resourceType: matchedType },
    ],
  };
};

module.exports = {
  RESOURCE_TYPES,
  normalizeCategoryKey,
  getResourceTypeForCategoryName,
  findMatchingCategoryId,
  getCategoriesWithCounts,
  buildCategoryFilterCondition,
};
