import prisma from '../config/prisma';
import { Request } from 'express';

export async function logActivity(
  req: Request,
  action: string,
  description?: string,
  overrideUserId?: number,
  overrideAgencyId?: number | null,
): Promise<void> {
  try {
    const userId = overrideUserId ?? req.user?.id ?? null;
    const agencyId = overrideAgencyId !== undefined ? overrideAgencyId : (req.user?.agencyId ?? null);

    await prisma.activityLog.create({
      data: {
        userId,
        agencyId,
        action,
        description: description ?? '',
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? '',
        userAgent: req.headers['user-agent'] ?? '',
      },
    });
  } catch {
    // Silent — logging should never crash the request
  }
}

