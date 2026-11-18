const bcrypt = require('bcryptjs');
const prisma = require('../config/database.js');
const { AppError } = require('../middleware/errorHandler');
const { getUserStorageUsage } = require('../utils/storageHelper');

const getProfile = async (req, res, next) => {
  try {
    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          storageQuota: true,
          storageUsed: true
        }
      }),
      getUserStorageUsage(req.user.id)
    ]);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        ...user,
        storageQuota: Number(user.storageQuota),
        storageUsed: usage.totalBytes,
        resourceStorageUsed: usage.resourceBytes,
        vaultStorageUsed: usage.vaultBytes
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const jwt = require('jsonwebtoken');
    const config = require('../config/index');

    // Get full user object including passwordHash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isPasswordValid) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password and revoke all previously issued JWTs
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date()
      }
    });

    // Issue a fresh JWT for the current session
    const token = jwt.sign(
      { id: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      token
    });
  } catch (error) {
    next(error);
  }
};

const getStorageInfo = async (req, res, next) => {
  try {
    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          storageQuota: true,
          storageUsed: true
        }
      }),
      getUserStorageUsage(req.user.id)
    ]);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const used = usage.totalBytes;
    const quota = Number(user.storageQuota);
    const percentage = quota > 0 ? (used / quota) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        used,
        quota,
        resourceUsed: usage.resourceBytes,
        vaultUsed: usage.vaultBytes,
        percentage: parseFloat(percentage.toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getStorageInfo
};
