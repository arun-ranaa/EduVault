const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database.js');
const config = require('../config/index.js');
const { AppError } = require('../middleware/errorHandler');
const { getUserStorageUsage } = require('../utils/storageHelper');
const { sendVerificationEmail } = require('../utils/emailHelper');

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Lightweight in-memory store used only to support "Resend verification email".
// Actual verification is stateless (encrypted inside the link token) and does NOT write to the DB until verified.
const pendingRegistrations = new Map();

const pruneExpiredPending = () => {
  const now = Date.now();
  for (const [email, entry] of pendingRegistrations.entries()) {
    if (entry.expiresAt <= now) {
      pendingRegistrations.delete(email);
    }
  }
};

const getEncryptionKey = () =>
  crypto.createHash('sha256').update(String(config.jwt.secret)).digest();

const createVerificationToken = (payload) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const data = JSON.stringify({
    ...payload,
    purpose: 'email_verification',
    exp: Date.now() + VERIFY_TOKEN_TTL_MS,
  });
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
};

const parseVerificationToken = (token) => {
  try {
    const raw = Buffer.from(String(token), 'base64url');
    if (raw.length < 29) return null; // 12 (iv) + 16 (authTag) + >=1 (ciphertext)
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted);
    if (parsed.purpose !== 'email_verification') return null;
    return parsed;
  } catch {
    return null;
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const register = async (req, res, next) => {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;

    // Check if a verified/registered user already exists in the database
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return next(new AppError('Email is already in use', 409));
    }

    // Hash password now so plaintext password is never stored anywhere
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create encrypted, tamper-proof verification token (nothing is written to the database yet)
    const verifyToken = createVerificationToken({ name, email, passwordHash });

    // Send verification email before responding so SMTP errors are caught immediately
    try {
      await sendVerificationEmail(email, name, verifyToken);
    } catch (err) {
      console.error('Failed to send verification email:', err.message);
      return next(new AppError('Failed to send verification email. Please try again later.', 500));
    }

    // Keep in memory temporarily in case user clicks "Resend email"
    pruneExpiredPending();
    pendingRegistrations.set(email, {
      name,
      email,
      passwordHash,
      expiresAt: Date.now() + VERIFY_TOKEN_TTL_MS,
    });

    res.status(200).json({
      success: true,
      message: 'Verification email sent! Please check your inbox and click the link to complete registration.',
      emailSent: true
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return next(new AppError('Verification token is required', 400));
    }

    const payload = parseVerificationToken(token);

    if (!payload || !payload.email || !payload.name || !payload.passwordHash) {
      return next(new AppError('Invalid or expired verification link', 400));
    }

    if (Date.now() > payload.exp) {
      return next(new AppError('Verification link has expired. Please register again.', 400));
    }

    const email = payload.email.trim().toLowerCase();

    // If user already completed verification (e.g. clicked link twice)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      pendingRegistrations.delete(email);
      return res.status(200).json({
        success: true,
        message: 'Email is already verified. You can log in.'
      });
    }

    // Only NOW register the user in the database (already verified)
    try {
      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: payload.name,
            email,
            passwordHash: payload.passwordHash,
            isEmailVerified: true,
          }
        });

        await tx.activity.create({
          data: {
            userId: newUser.id,
            action: 'USER_REGISTERED',
            details: `User ${newUser.name} verified email and registered`
          }
        });
      });
    } catch (err) {
      // Handle simultaneous double-click race condition gracefully
      if (err.code === 'P2002') {
        pendingRegistrations.delete(email);
        return res.status(200).json({
          success: true,
          message: 'Email is already verified. You can log in.'
        });
      }
      throw err;
    }

    pendingRegistrations.delete(email);

    res.status(200).json({
      success: true,
      message: 'Email verified and account registered successfully! You can now log in.'
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const rawEmail = req.body.email;

    if (!rawEmail) {
      return next(new AppError('Email is required', 400));
    }

    const email = rawEmail.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('This email is already verified. You can log in.', 400));
    }

    pruneExpiredPending();
    const pending = pendingRegistrations.get(email);

    if (!pending) {
      return next(new AppError('No pending verification found for this email. Please register again.', 400));
    }

    const verifyToken = createVerificationToken({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
    });

    try {
      await sendVerificationEmail(pending.email, pending.name, verifyToken);
    } catch (err) {
      console.error('Failed to resend verification email:', err.message);
      return next(new AppError('Failed to resend verification email. Please try again.', 500));
    }

    pending.expiresAt = Date.now() + VERIFY_TOKEN_TTL_MS;

    res.status(200).json({
      success: true,
      message: 'Verification email resent! Please check your inbox.'
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

    // Block unverified users
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email address before logging in. Check your inbox for the verification link.', 403));
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

    const [dbUser, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id }
      }),
      getUserStorageUsage(user.id)
    ]);

    if (!dbUser) {
      return next(new AppError('User not found', 404));
    }

    const { passwordHash, emailVerifyToken, emailVerifyExpiry, ...userWithoutSensitive } = dbUser;

    res.status(200).json({
      success: true,
      user: {
        ...userWithoutSensitive,
        storageQuota: Number(dbUser.storageQuota),
        storageUsed: usage.totalBytes
      }
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
  getMe
};
