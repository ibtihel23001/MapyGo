import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { runImport } from './email-import.controller';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
router.use(authenticate);

/**
 * POST /api/email-import/run
 * Manual trigger – admin only.
 */
router.post('/run', authorize('admin'), runImport);

/**
 * GET /api/email-import/logs
 * List all log files for the current agency.
 */
router.get('/logs', authorize('admin'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) return res.status(403).json({ success: false, message: 'No agency' });

    const logsRoot = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsRoot)) return res.json({ success: true, data: [] });

    // Find folders matching this agency
    const allFolders = fs.readdirSync(logsRoot).filter(f => f.startsWith(`agency-${agencyId}-`));
    const files: Array<{ name: string; folder: string; size: number; createdAt: string }> = [];

    for (const folder of allFolders) {
      const folderPath = path.join(logsRoot, folder);
      const logFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.log'));
      for (const file of logFiles) {
        const stat = fs.statSync(path.join(folderPath, file));
        files.push({ name: file, folder, size: stat.size, createdAt: stat.birthtime.toISOString() });
      }
    }

    files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ success: true, data: files });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/email-import/logs/:folder/:filename
 * Read a specific log file content.
 */
router.get('/logs/:folder/:filename', authorize('admin'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) return res.status(403).json({ success: false, message: 'No agency' });

    const { folder, filename } = req.params;

    // Security: make sure this folder belongs to this agency
    if (!folder.startsWith(`agency-${agencyId}-`)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Safety: reject path traversal attempts
    if (folder.includes('..') || filename.includes('..')) {
      return res.status(400).json({ success: false, message: 'Invalid path' });
    }

    const filePath = path.join(process.cwd(), 'logs', folder, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return res.json({ success: true, data: { content, filename, folder } });
  } catch (err) {
    next(err);
  }
});

export default router;
