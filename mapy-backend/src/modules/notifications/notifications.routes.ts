import prisma from '../../config/prisma';
import { getPagination, buildMeta } from '../../utils/paginate';
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// ─── Service ─────────────────────────────────────────────────
async function listNotifications(userId: number, agencyId: number | null, query: any) {
  const { page, perPage, skip } = getPagination(query);

  const where: any = {
    OR: [{ userId }, ...(agencyId ? [{ agencyId, userId: null }] : [])],
  };

  const [total, data] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
  ]);

  return { data, meta: buildMeta(total, page, perPage) };
}

async function markRead(id: number, userId: number) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

async function markAllRead(userId: number) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// ─── Controller ───────────────────────────────────────────────
async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listNotifications(req.user!.id, req.user!.agencyId, req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function readOne(req: Request, res: Response, next: NextFunction) {
  try {
    await markRead(Number(req.params.id), req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function readAll(req: Request, res: Response, next: NextFunction) {
  try {
    await markAllRead(req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Router ───────────────────────────────────────────────────
const router = Router();
router.use(authenticate);
router.get('/', list);
router.patch('/:id/read', readOne);
router.patch('/read-all', readAll);

export default router;

