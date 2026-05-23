import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/prisma';
import { sendMail, passwordResetTemplate } from '../../config/mailer';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import type { LoginInput, ResetPasswordInput, ForgotPasswordInput } from './auth.schema';

export async function loginService(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw createError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw createError('Invalid email or password', 401);
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const payload = {
    id: user.id,
    email: user.email,
    roleSlug: user.role.slug,
    agencyId: user.agencyId,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const { password: _pw, resetToken: _rt, emailVerifyToken: _evt, ...safeUser } = user;

  return { accessToken, refreshToken, user: { ...safeUser, roleSlug: user.role.slug, roleName: user.role.name } };
}

export async function refreshTokenService(token: string) {
  try {
    const payload = verifyRefreshToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw createError('User not found or inactive', 401);
    }

    const newPayload = {
      id: user.id,
      email: user.email,
      roleSlug: user.role.slug,
      agencyId: user.agencyId,
    };

    return {
      accessToken: signAccessToken(newPayload),
      refreshToken: signRefreshToken(newPayload),
    };
  } catch {
    throw createError('Invalid refresh token', 401);
  }
}

export async function getMeService(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      isActive: true,
      emailVerified: true,
      lastLogin: true,
      createdAt: true,
      agencyId: true,
      role: { select: { id: true, name: true, slug: true } },
      agency: { select: { id: true, name: true, status: true } },
    },
  });

  if (!user) throw createError('User not found', 404);
  return user;
}

export async function forgotPasswordService(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Don't reveal whether email exists
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your password — MAP eTicket',
    html: passwordResetTemplate(`${user.firstName} ${user.lastName}`, resetUrl),
  });
}

export async function resetPasswordService(input: ResetPasswordInput) {
  const user = await prisma.user.findFirst({
    where: {
      resetToken: input.token,
      resetTokenExpiry: { gte: new Date() },
    },
  });

  if (!user) {
    throw createError('Reset token is invalid or expired', 400);
  }

  const hashed = await bcrypt.hash(input.password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
}
