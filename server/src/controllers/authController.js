const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database.js');
const config = require('../config/index.js');
const { AppError } = require('../middleware/errorHandler');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return next(new AppError('Email is already in use', 409));
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash
      }
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: newUser.id,
        action: 'USER_REGISTERED',
        details: `User ${newUser.name} registered`
      }
    });

    // Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        storageQuota: Number(newUser.storageQuota),
        storageUsed: Number(newUser.storageUsed),
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if user is active
    if (user.isActive === false) {
      return next(new AppError('Your account has been deactivated.', 403));
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        details: `User ${user.name} logged in`
      }
    });

    // Generate token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageQuota: Number(user.storageQuota),
        storageUsed: Number(user.storageUsed),
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!dbUser) {
      return next(new AppError('User not found', 404));
    }

    const { passwordHash, ...userWithoutPassword } = dbUser;

    res.status(200).json({
      success: true,
      user: {
        ...userWithoutPassword,
        storageQuota: Number(dbUser.storageQuota),
        storageUsed: Number(dbUser.storageUsed)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};
