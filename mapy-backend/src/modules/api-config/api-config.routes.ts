import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import * as svc from './api-config.service';
import { upsertApiConfigSchema } from './api-config.schema';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { logActivity } from '../../utils/activityLog';

async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getConfig(req.user!.agencyId!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function upsert(req: Request, res: Response, next: NextFunction) {
  try {
    const input = upsertApiConfigSchema.parse(req.body);
    const data = await svc.upsertConfig(req.user!.agencyId!, input);
    await logActivity(req, 'update_api_config', 'Updated IMAP email configuration');
    // Mask password in response
    res.json({ success: true, data: { ...data, emailPassword: '••••••••' } });
  } catch (err) { next(err); }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteConfig(req.user!.agencyId!);
    res.json({ success: true, message: 'API config deleted' });
  } catch (err) { next(err); }
}

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/', getConfig);
router.put('/', upsert);
router.delete('/', remove);

export default router;
