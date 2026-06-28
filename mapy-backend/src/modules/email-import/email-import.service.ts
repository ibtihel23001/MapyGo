import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { importFromEmailBody } from '../tickets/tickets.service';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  tickets: Array<{ ticketNumber: string; passengerName: string }>;
  logFile?: string;
  emailLogs: Array<{
    subject: string;
    format: string;
    extracted: number;
    inserted: number;
    skipped: number;
    extractionLog: string[];
  }>;
}

// ─── Per-agency file logger ───────────────────────────────────────────────────

function createAgencyLogger(agencyId: number, agencySlug: string) {
  const logsRoot = path.join(process.cwd(), 'logs', `agency-${agencyId}-${agencySlug}`);
  fs.mkdirSync(logsRoot, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(logsRoot, `import-${timestamp}.log`);
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  const write = (msg: string) => stream.write(`[${new Date().toISOString()}] ${msg}\n`);

  return {
    filePath,
    log: write,
    section: (title: string) => write(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`),
  };
}

// ─── IMAP Fetch ───────────────────────────────────────────────────────────────

interface ImapConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
}

interface RawEmail {
  subject: string;
  html: string;
  text: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchEmailsFromImap(config: ImapConfig): Promise<RawEmail[]> {
  const host = config.host ?? 'imap.gmail.com';
  const port = config.port ?? 993;

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  client.on('error', (err: Error) => {
    console.error(`[EmailImport] IMAP client error (${host}:${port}):`, err.message);
  });

  const emails: RawEmail[] = [];

  try {
    await client.connect();
  } catch (err: any) {
    const hint =
      host.includes('gmail') && (err.message ?? '').includes('auth')
        ? ' — Gmail requires an App Password. Enable 2FA then generate one at myaccount.google.com/apppasswords.'
        : '';
    throw new Error(`Cannot connect to ${host}:${port} as ${config.user}: ${err.message}${hint}`);
  }

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const uids = await client.search({
        or: [
          { from: 'confirmation@amadeus.com' },
          { from: 'amadeus.com' },
          { from: 'noreply@turkish.com' },
          { from: 'eticket@qatarairways.com.qa' },
          { from: 'brenztravels@gmail.com' },
          { subject: 'Electronic Ticket' },
          { subject: 'e-ticket' },
          { subject: 'eticket' },
          { subject: 'billet' },
          { subject: 'QSF' },
          { subject: 'ALG' },
        ],
        since: sinceDate,
      });

      if (!uids || uids.length === 0) return emails;

      // ⚠️ Limit to last 20 emails to avoid burning Groq token quota.
      // Emails are sorted oldest→newest; slice(-20) takes the most recent ones.
      const toFetch = uids.slice(-20);

      for await (const msg of client.fetch(toFetch, { source: true })) {
        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const html = parsed.html || '';
          const text = parsed.text || '';
          const subject = parsed.subject || '';
          if (!html && !text) continue;
          emails.push({ subject, html: html || `<pre>${text}</pre>`, text });
        } catch (err: any) {
          console.error('[EmailImport] Failed to parse message:', err.message);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}

// ─── Import Orchestrator ──────────────────────────────────────────────────────

export async function importTicketsFromEmail(agencyId: number): Promise<ImportResult> {
  const cfg = await prisma.agencyApiConfig.findUnique({ where: { agencyId } });

  if (!cfg || !cfg.isActive) {
    throw createError('Email import not configured for this agency. Please set it up in API Settings.', 400);
  }

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { slug: true } });
  const fileLogger = createAgencyLogger(agencyId, agency?.slug ?? 'unknown');

  fileLogger.section(`EMAIL IMPORT STARTED — Agency ${agencyId} (${agency?.slug ?? 'unknown'})`);
  fileLogger.log(`Config: host=${cfg.imapHost} port=${cfg.imapPort} user=${cfg.emailAddress}`);

  // Only fetch emails newer than the last successful sync (saves Groq tokens)
  const sinceDate = cfg.lastSync
    ? new Date(cfg.lastSync.getTime() - 60 * 60 * 1000) // 1hr overlap to avoid missing edge cases
    : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })();

  let emails: RawEmail[];
  try {
    emails = await fetchEmailsFromImap({
      user: cfg.emailAddress,
      password: cfg.emailPassword,
      host: cfg.imapHost ?? undefined,
      port: cfg.imapPort ?? undefined,
    });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    fileLogger.log(`IMAP ERROR: ${msg}`);
    throw createError(msg.startsWith('Cannot connect') ? msg : `IMAP connection failed: ${msg}`, 502);
  }

  fileLogger.log(`Fetched ${emails.length} emails from IMAP`);

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    tickets: [],
    logFile: fileLogger.filePath,
    emailLogs: [],
  };

  for (let i = 0; i < emails.length; i++) {
    const mail = emails[i];
    if (!mail.html && !mail.text) continue;

    fileLogger.section(`Email ${i + 1}/${emails.length}: "${mail.subject}"`);

    // Strip HTML to plain text for the format-aware parser
    const plainText = mail.html ? stripHtml(mail.html) : mail.text;

    let parseResult: Awaited<ReturnType<typeof importFromEmailBody>>;
    try {
      parseResult = await importFromEmailBody(plainText, agencyId, undefined, prisma);
    } catch (e: any) {
      const msg = `Parse/import error in "${mail.subject}": ${e.message}`;
      result.errors.push(msg);
      fileLogger.log(`ERROR: ${msg}`);
      continue;
    }

    // Write the detailed per-line extraction log to file
    for (const line of parseResult.extractionLog) {
      fileLogger.log(`  ${line}`);
    }

    // Add to the per-email summary returned in the API response
    result.emailLogs.push({
      subject: mail.subject,
      format: parseResult.format,
      extracted: parseResult.total,
      inserted: parseResult.inserted,
      skipped: parseResult.skipped,
      extractionLog: parseResult.extractionLog,
    });

    result.imported += parseResult.inserted;
    result.skipped  += parseResult.skipped;
    result.errors.push(...parseResult.errors);

    // Collect ticket summaries for inserted ones
    // (We re-query to get names since importFromEmailBody doesn't return them directly)
    if (parseResult.inserted > 0) {
      const recent = await prisma.ticket.findMany({
        where: { agencyId },
        orderBy: { createdAt: 'desc' },
        take: parseResult.inserted,
        select: { ticketNumber: true, passengerName: true },
      });
      result.tickets.push(...recent);
    }
  }

  fileLogger.section(`IMPORT COMPLETE — inserted=${result.imported} skipped=${result.skipped} errors=${result.errors.length}`);

  await prisma.agencyApiConfig.update({
    where: { agencyId },
    data: { lastSync: new Date() },
  });

  return result;
}
