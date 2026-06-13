/**
 * Email Import Cron Job
 * Runs every 30 minutes for all agencies that have active email config.
 * Wire this up in app.ts: import './jobs/email-import.job'
 */

import prisma from '../config/prisma';
import { importTicketsFromEmail } from '../modules/email-import/email-import.service';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function runForAllAgencies() {
  try {
    const configs = await prisma.agencyApiConfig.findMany({
      where: { isActive: true },
      select: { agencyId: true, emailAddress: true },
    });

    if (!configs.length) return;

    console.log(`[EmailImportJob] Running for ${configs.length} agency/agencies…`);

    for (const cfg of configs) {
      try {
        const result = await importTicketsFromEmail(cfg.agencyId);
        if (result.imported > 0) {
          console.log(
            `[EmailImportJob] Agency ${cfg.agencyId} (${cfg.emailAddress}): ` +
            `+${result.imported} imported, ${result.skipped} skipped`,
          );
        }
      } catch (err: any) {
        console.error(`[EmailImportJob] Agency ${cfg.agencyId} failed: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error('[EmailImportJob] Prisma error:', err.message);
  }
}

// Start immediately, then repeat
runForAllAgencies();
const job = setInterval(runForAllAgencies, INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', () => clearInterval(job));
process.on('SIGINT',  () => clearInterval(job));

export default job;
