import { Request, Response, NextFunction } from 'express';
import {
  loginService,
  refreshTokenService,
  getMeService,
  forgotPasswordService,
  resetPasswordService,
} from './auth.service';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';
import { logActivity } from '../../utils/activityLog';
import { env } from '../../config/env';

const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
};

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await loginService(input);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    await logActivity(req, 'login', `User logged in: ${user.email}`);

    res.json({ success: true, data: { accessToken, user } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE);
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ success: false, message: 'No refresh token' });
      return;
    }

    const tokens = await refreshTokenService(token);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    res.json({ success: true, data: { accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getMeService(req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    await forgotPasswordService(input);
    // Always return success (don't reveal if email exists)
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await resetPasswordService(input);
    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}
