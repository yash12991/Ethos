const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { signAccessToken, signRefreshToken } = require('../config/jwt');
const userModel = require('../models/user.model');
const generateAnonUsername = require('../utils/generateAnonUsername');
const mockDataLoader = require('../utils/mockDataLoader');
const { ApiError } = require('../middlewares/error.middleware');
const { logAuditEvent } = require('../services/audit.service');
const { sendHrOtpEmail } = require('../services/email.service');

const hrOtpChallenges = new Map();
const HR_OTP_TTL_MS = 10 * 60 * 1000;
const HR_OTP_MAX_ATTEMPTS = 5;

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function createHrOtpChallenge(user) {
  const otp = String(crypto.randomInt(100000, 1000000));
  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + HR_OTP_TTL_MS;

  hrOtpChallenges.set(challengeId, {
    user,
    otpHash: hashOtp(otp),
    expiresAt,
    attempts: 0,
  });

  return { challengeId, otp, expiresAt };
}

function getOtpPreviewPayload(otp) {
  const exposePreview = process.env.HR_OTP_EXPOSE_IN_RESPONSE === 'true' && process.env.NODE_ENV !== 'production';
  return exposePreview ? { otpPreview: otp } : {};
}

function buildTokenPayload(user) {
  return {
    sub: user.id,
    role: user.role,
    alias: user.username || user.email || user.name,
    userType: user.userType,
  };
}

function authResponseUser(user) {
  if (user.userType === 'hr') {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      userType: user.userType,
    };
  }

  return {
    id: user.id,
    anon_alias: user.username,
    role: user.role,
    userType: user.userType,
    credibility_score: user.credibility_score,
    trust_flag: user.trust_flag,
    created_at: user.created_at,
    last_login: user.last_login || null,
  };
}

async function register(req, res, next) {
  try {
    const { password, alias } = req.body;

    const anonAlias = alias || generateAnonUsername();
    const existingUser = await userModel.findAnonByAlias(anonAlias);

    if (existingUser) {
      throw new ApiError(409, 'Alias already exists. Please choose another one.');
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await userModel.createUser({ username: anonAlias, password_hash });

    const tokenPayload = buildTokenPayload(user);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.register',
      userType: 'anon',
    });

    return res.status(201).json({
      success: true,
      data: {
        user: authResponseUser(user),
        tokens: {
          accessToken: signAccessToken(tokenPayload),
          refreshToken: signRefreshToken(tokenPayload),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new ApiError(400, 'Refresh token is required');

    const { verifyRefreshToken } = require('../config/jwt');
    try {
      const payload = verifyRefreshToken(refreshToken);
      const isHrToken = payload.userType === 'hr' || ['hr', 'committee', 'admin'].includes(payload.role);
      const user = isHrToken
        ? await userModel.findHrById(payload.sub)
        : await userModel.findAnonById(payload.sub);
      if (!user) throw new ApiError(401, 'Invalid refresh token');

      const newTokenPayload = buildTokenPayload(user);
      const accessToken = signAccessToken(newTokenPayload);

      return res.json({
        success: true,
        data: {
          tokens: {
            accessToken,
            refreshToken, // Optionally rotate this too
          },
        },
      });
    } catch (err) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { alias, password } = req.body;

    const user = await userModel.findAnonByAlias(alias);
    if (!user) throw new ApiError(401, 'Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    await userModel.updateAnonLastLogin(user.id);

    const tokenPayload = buildTokenPayload(user);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.login',
      userType: 'anon',
    });

    return res.json({
      success: true,
      data: {
        user: authResponseUser(user),
        tokens: {
          accessToken: signAccessToken(tokenPayload),
          refreshToken: signRefreshToken(tokenPayload),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function hrLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await userModel.findHrByEmail(email);
    if (!user) throw new ApiError(401, 'Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    if (!user.two_factor_enabled) {
      const tokenPayload = buildTokenPayload(user);
      await logAuditEvent({
        actorUserId: user.id,
        action: 'auth.hr.login',
        userType: 'hr',
      });

      return res.json({
        success: true,
        data: {
          requiresOtp: false,
          user: authResponseUser(user),
          tokens: {
            accessToken: signAccessToken(tokenPayload),
            refreshToken: signRefreshToken(tokenPayload),
          },
        },
      });
    }

    const { challengeId, otp, expiresAt } = createHrOtpChallenge(user);

    try {
      await sendHrOtpEmail({
        to: user.email,
        otp,
        expiresAt,
        name: user.name,
      });
    } catch (emailError) {
      hrOtpChallenges.delete(challengeId);
      throw emailError;
    }

    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.hr.login.otp_issued',
      userType: 'hr',
    });

    return res.json({
      success: true,
      data: {
        requiresOtp: true,
        challengeId,
        email: user.email,
        expiresAt,
        ...getOtpPreviewPayload(otp),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function hrVerifyOtp(req, res, next) {
  try {
    const { challengeId, otp } = req.body;
    const challenge = hrOtpChallenges.get(challengeId);

    if (!challenge) throw new ApiError(401, 'Invalid OTP challenge');
    if (Date.now() > challenge.expiresAt) {
      hrOtpChallenges.delete(challengeId);
      throw new ApiError(401, 'OTP expired');
    }

    challenge.attempts += 1;
    if (challenge.attempts > HR_OTP_MAX_ATTEMPTS) {
      hrOtpChallenges.delete(challengeId);
      throw new ApiError(429, 'Too many OTP attempts');
    }

    const providedHash = hashOtp(otp);
    if (providedHash !== challenge.otpHash) {
      throw new ApiError(401, 'Invalid OTP');
    }

    const user = challenge.user;
    hrOtpChallenges.delete(challengeId);

    const tokenPayload = buildTokenPayload(user);
    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.hr.login.otp_verified',
      userType: 'hr',
    });

    return res.json({
      success: true,
      data: {
        user: authResponseUser(user),
        tokens: {
          accessToken: signAccessToken(tokenPayload),
          refreshToken: signRefreshToken(tokenPayload),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function hrRegister(req, res, next) {
  try {
    const setupKey = req.headers['x-setup-key'];
    if (!process.env.HR_REGISTRATION_SETUP_KEY) {
      throw new ApiError(500, 'HR_REGISTRATION_SETUP_KEY is not configured');
    }
    if (setupKey !== process.env.HR_REGISTRATION_SETUP_KEY) {
      throw new ApiError(403, 'Invalid setup key');
    }

    const { name, email, password, role, two_factor_enabled } = req.body;

    const existing = await userModel.findHrByEmail(email);
    if (existing) {
      throw new ApiError(409, 'HR user already exists for this email');
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await userModel.createHrUser({
      name,
      email,
      password_hash,
      role,
      two_factor_enabled: Boolean(two_factor_enabled),
    });

    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.hr.register',
      userType: 'system',
      metadata: { email: user.email, role: user.role },
    });

    return res.status(201).json({
      success: true,
      data: authResponseUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = req.user.userType === 'hr'
      ? await userModel.findHrById(req.user.id)
      : await userModel.findAnonById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');

    return res.json({ success: true, data: authResponseUser(user) });
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    if (req.user.userType !== 'anon') {
      throw new ApiError(403, 'Password change is only available for anonymous users');
    }

    const { currentPassword, newPassword } = req.body;
    const user = await userModel.findAnonAuthById(req.user.id);

    if (!user) throw new ApiError(404, 'User not found');

    const validCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validCurrentPassword) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new ApiError(400, 'New password must be different from current password');
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await userModel.updateAnonPassword(user.id, password_hash);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.password.change',
      userType: 'anon',
    });

    return res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    return next(err);
  }
}

async function getAliasSuggestions(req, res, next) {
  try {
    let suggestions = [];
    const targetCount = 5;
    let attempts = 0;
    const maxAttempts = 3;

    while (suggestions.length < targetCount && attempts < maxAttempts) {
      attempts += 1;
      const needed = targetCount - suggestions.length;
      const batch = await mockDataLoader.fetchExternalAliases(needed + 2);

      for (const alias of batch) {
        if (suggestions.length >= targetCount) break;

        const existing = await userModel.findAnonByAlias(alias);
        if (!existing && !suggestions.includes(alias)) {
          suggestions.push(alias);
        }
      }
    }

    if (suggestions.length === 0) {
      suggestions = [
        generateAnonUsername(),
        generateAnonUsername(),
        generateAnonUsername(),
        generateAnonUsername(),
        generateAnonUsername(),
      ];
    }

    return res.json({ success: true, aliases: suggestions.slice(0, 5) });
  } catch (err) {
    return next(err);
  }
}

async function getRecoveryPhrase(req, res, next) {
  try {
    const phrase = mockDataLoader.getRandomRecoveryPhrase();
    return res.json({ success: true, phrase });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  hrRegister,
  hrLogin,
  hrVerifyOtp,
  me,
  changePassword,
  getAliasSuggestions,
  getRecoveryPhrase,
  refresh,
};
