const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database.js');
const config = require('../config/index.js');
const { AppError } = require('../middleware/errorHandler');
const { getUserStorageUsage } = require('../utils/storageHelper');
const { sendVerificationEmail } = require('../utils/emailHelper');

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const hashVerificationToken = (rawToken) =>
  crypto.createHash('sha256').update(String(rawToken)).digest('hex');

const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, tv: user.tokenVersion ?? 0 },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' }
  );
};

const cleanupExpiredPending = async () => {
  await prisma.pendingRegistration
    .deleteMany({ where: { expiresAt: { lte: new Date() } } })
    .catch(() => {});
};

const register = async (req, res, next) => {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;

    // Generic response prevents account enumeration
    const genericMessage =
      'If this email is eligible, a verification link has been sent. Please check your inbox and click the link to complete registration.';

    await cleanupExpiredPending();

    const [existingUser, existingPending] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.pendingRegistration.findUnique({ where: { email }, select: { id: true, expiresAt: true } }),
    ]);

    // Never reveal existing verified accounts or allow overwriting an active pending registration's passwordHash
    if (existingUser || (existingPending && existingPending.expiresAt > new Date())) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
        emailSent: true,
      });
    }

    // Hash password so plaintext password is never persisted anywhere
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate cryptographically random opaque token; store only its SHA-256 hash in DB
    const rawToken = generateVerificationToken();
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

    const pendingRecord = await prisma.pendingRegistration.upsert({
      where: { email },
      update: { name, passwordHash, tokenHash, expiresAt },
      create: { name, email, passwordHash, tokenHash, expiresAt },
    });

    try {
      await sendVerificationEmail(email, name, rawToken);
    } catch (err) {
      await prisma.pendingRegistration.delete({ where: { id: pendingRecord.id } }).catch(() => {});
      console.error('Failed to send verification email:', err.message);
      return next(new AppError('Failed to send verification email. Please try again later.', 500));
    }

    res.status(200).json({
      success: true,
      message: genericMessage,
      emailSent: true,
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    if (!rawToken) {
      return next(new AppError('Verification token is required', 400));
    }

    const tokenHash = hashVerificationToken(rawToken);
    const pending = await prisma.pendingRegistration.findUnique({
      where: { tokenHash },
    });

    if (!pending) {
      return next(new AppError('Invalid or expired verification link', 400));
    }

    if (pending.expiresAt <= new Date()) {
      await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});
      return next(new AppError('Verification link has expired. Please register again.', 400));
    }

    const email = pending.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});
      return res.status(200).json({
        success: true,
        message: 'Email is already verified. You can log in.',
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: pending.name,
            email,
            passwordHash: pending.passwordHash,
            isEmailVerified: true,
          },
        });

        await tx.pendingRegistration.delete({ where: { id: pending.id } });

        await tx.activity.create({
          data: {
            userId: newUser.id,
            action: 'USER_REGISTERED',
            details: `User ${newUser.name} verified email and registered`,
          },
        });
      });
    } catch (err) {
      if (err.code === 'P2002') {
        await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});
        return res.status(200).json({
          success: true,
          message: 'Email is already verified. You can log in.',
        });
      }
      throw err;
    }

    res.status(200).json({
      success: true,
      message: 'Email verified and account registered successfully! You can now log in.',
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const genericMessage =
      'If a pending verification exists for this email, a new verification link has been sent.';

    await cleanupExpiredPending();

    const [existingUser, pending] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.pendingRegistration.findUnique({ where: { email } }),
    ]);

    if (existingUser || !pending || pending.expiresAt <= new Date()) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    // Rotate opaque token while keeping the original passwordHash untouched
    const rawToken = generateVerificationToken();
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { tokenHash, expiresAt },
    });

    try {
      await sendVerificationEmail(pending.email, pending.name, rawToken);
    } catch (err) {
      console.error('Failed to resend verification email:', err.message);
      return next(new AppError('Failed to resend verification email. Please try again.', 500));
    }

    res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
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

    // Block unverified users
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email address before logging in. Check your inbox for the verification link.', 403));
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        details: `User ${user.name} logged in`,
      },
    });

    // Generate token
    const token = generateToken(user);
    const usage = await getUserStorageUsage(user.id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageQuota: Number(user.storageQuota),
        storageUsed: usage.totalBytes,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Increment tokenVersion to immediately revoke all active JWTs for this user
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    const [dbUser, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
      }),
      getUserStorageUsage(user.id),
    ]);

    if (!dbUser) {
      return next(new AppError('User not found', 404));
    }

    const { passwordHash, emailVerifyToken, emailVerifyExpiry, tokenVersion, ...userWithoutSensitive } = dbUser;

    res.status(200).json({
      success: true,
      user: {
        ...userWithoutSensitive,
        storageQuota: Number(dbUser.storageQuota),
        storageUsed: usage.totalBytes,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getMe,
};
