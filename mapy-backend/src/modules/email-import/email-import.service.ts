import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedPassenger {
  passengerName: string;
  ticketNumber: string;
  airFare: number | null;
  ttc: number | null;
}

export interface ParsedEmail {
  pnr: string | null;
  dateOfIssue: string | null;
  airline: string | null;
  firstDepartureDate: string | null;
  lastArrivalDate: string | null;
  passengers: ParsedPassenger[];
  rawHtml: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  tickets: Array<{ ticketNumber: string; passengerName: string }>;
  logFile?: string;
}

// ─── Per-agency file logger ───────────────────────────────────────────────────

function createAgencyLogger(agencyId: number, agencySlug: string): {
  log: (msg: string) => void;
  section: (title: string) => void;
  dump: (label: string, value: unknown) => void;
  filePath: string;
} {
  const logsRoot = path.join(process.cwd(), 'logs', `agency-${agencyId}-${agencySlug}`);
  fs.mkdirSync(logsRoot, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(logsRoot, `import-${timestamp}.log`);
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  const write = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    stream.write(line + '\n');
    console.log(`[Agency ${agencyId}] ${msg}`);
  };

  return {
    filePath,
    log: (msg: string) => write(msg),
    section: (title: string) => write(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`),
    dump: (label: string, value: unknown) =>
      write(`${label}:\n${JSON.stringify(value, null, 2)}`),
  };
}

// ─── Text Helpers ─────────────────────────────────────────────────────────────

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

function tryPatterns(text: string, patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractAmount(text: string, patterns: RegExp[]): number | null {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

// ─── Known Airlines (used to prevent airline bleeding into passenger name) ───

const KNOWN_AIRLINES = [
  'Volotea', 'Turkish Airlines', 'Qatar Airways', 'Air Algérie', 'Air Algerie',
  'Air France', 'Lufthansa', 'Emirates', 'FlyDubai', 'Fly Dubai', 'Transavia',
  'Tunisair', 'Royal Air Maroc', 'Vueling Airlines', 'Vueling', 'British Airways',
  'easyJet', 'Ryanair', 'Wizz Air', 'Saudi Arabian Airlines', 'Saudia',
  'Etihad Airways', 'flydubai', 'Air Arabia', 'Pegasus Airlines',
  'Nouvelair', 'Corsair', 'XL Airways', 'Aigle Azur',
];

function knownAirlinePattern(): RegExp {
  const escaped = KNOWN_AIRLINES.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'i');
}

/**
 * Ticket number formats:
 *  Type 1:  3digits - 10digits             e.g. 712-2400057853
 *  Type 2:  3digits - 10digits - 2digits   e.g. 030-2403650280-34
 *  Type 3:  3digits - 10digits - 3digits   e.g. 157-2200186061-001
 *
 * The regex captures the full ticket including optional suffix.
 */
const TICKET_RE = /\b(\d{3}-\d{10}(?:-\d{2,3})?)\b/g;
const TICKET_RE_SINGLE = /\b(\d{3}-\d{10}(?:-\d{2,3})?)\b/;

// ─── Core Parser ──────────────────────────────────────────────────────────────

export function parseEmailHtml(
  html: string,
  subject?: string,
  logger?: ReturnType<typeof createAgencyLogger>,
): ParsedEmail {
  const text = stripHtml(html);
  const log = logger?.log ?? (() => {});
  const dump = logger?.dump ?? (() => {});

  log(`Raw stripped text length: ${text.length} chars`);
  if (text.length < 2000) dump('Full stripped text', text);
  else dump('First 2000 chars of stripped text', text.slice(0, 2000));

  // ── PNR ──
  const pnrRaw = tryPatterns(text, [
    /Booking\s+ref(?:erence)?\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /PNR\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /Airline\s+Booking\s+Reference\s*[:\-]?\s*(?:[A-Z]{2,3}\/)?([A-Z0-9]{5,8})/i,
    /Booking\s+Reference\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /\b([A-Z]{2,3}\/[A-Z0-9]{5,6})\b/,
    /\b([A-Z0-9]{6})\b(?=.*Booking)/,
  ]) ?? (subject ? tryPatterns(subject, [/\b([A-Z0-9]{6})\b/]) : null);

  const cleanPnr = pnrRaw?.includes('/') ? pnrRaw.split('/').pop()! : pnrRaw;
  log(`PNR extracted: ${cleanPnr ?? 'null'}`);

  // ── Date of Issue ──
  const dateOfIssue = tryPatterns(text, [
    /Document\s+Issue\s+Date\s*[:\-]?\s*(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /Ticketed\s+Date\s*[:\-]?\s*(\d{1,2}\s*\w+\s*\d{2,4})/i,
    /Issue\s+Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Date\s+d.?(?:émission|emission)\s*[:\-]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i,
  ]);
  log(`Date of issue: ${dateOfIssue ?? 'null'}`);

  // ── Airline ──
  // Strategy: first try explicit label, then known name list
  const airlineRaw = tryPatterns(text, [
    /Issuing\s+Airline\s*[:\-]?\s*([\w\s]+?)(?:\s{2,}|Ticket|\n)/i,
    /Operated\s+By\s+([\w\s]+?),\s*[A-Z]{2}\)/i,
  ]) ?? tryPatterns(text, [knownAirlinePattern()]);
  const airline = airlineRaw?.trim() ?? null;
  log(`Airline extracted: ${airline ?? 'null'}`);

  // ── Departure / Arrival ──
  const depMatches = [...text.matchAll(/Departure\s+(\d{1,2}\s+\w+)/gi)];
  const arrMatches = [...text.matchAll(/Arrival\s+(\d{1,2}\s+\w+)/gi)];
  const firstDepartureDate = depMatches[0]?.[1] ?? null;
  const lastArrivalDate = arrMatches[arrMatches.length - 1]?.[1] ?? arrMatches[0]?.[1] ?? null;
  log(`Departure: ${firstDepartureDate ?? 'null'} | Arrival: ${lastArrivalDate ?? 'null'}`);

  // ── Find ALL ticket numbers in the text (all 3 formats) ──
  const allTicketMatches = [...text.matchAll(TICKET_RE)];
  const allTicketNumbers = [...new Set(allTicketMatches.map(m => m[1]))];
  log(`All ticket numbers found in text: [${allTicketNumbers.join(', ')}]`);

  // ── Passengers ──
  const passengers: ParsedPassenger[] = [];
  const airlinePat = knownAirlinePattern();

  // Strategy 1: ticket# immediately followed by passenger name
  // Handles: "712-2400057853 Rafik Smati(ADT)"  or  "030-2403650280-34 John Doe"
  const passengerRowRe = /(\d{3}-\d{10}(?:-\d{2,3})?)\s+([\w\/\s]+?)(?:\s*\((?:ADT|INF|CHD)\)|\s{3,}|$)/gim;
  let pm: RegExpExecArray | null;
  while ((pm = passengerRowRe.exec(text)) !== null) {
    const ticketNumber = pm[1].trim();
    let passengerName = pm[2].trim().replace(/\s+/g, ' ');

    // Strip known airline names that bled into passenger name
    passengerName = passengerName.replace(airlinePat, '').trim();

    // Reject if name is suspiciously short or looks like an airline/code
    if (!passengerName || passengerName.length < 3) {
      log(`  Strategy 1: Skipping ticket ${ticketNumber} — name too short: "${passengerName}"`);
      continue;
    }
    if (/^\d+$/.test(passengerName)) {
      log(`  Strategy 1: Skipping ticket ${ticketNumber} — name is digits: "${passengerName}"`);
      continue;
    }

    const blockStart = text.indexOf(ticketNumber);
    const blockEnd = text.indexOf('Restrictions', blockStart);
    const block = blockStart >= 0
      ? text.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 3000)
      : text;

    const airFare = extractAmount(block, [
      /Air\s*Fare\s+DZD\s*([\d,]+)/i,
      /Air\s+Fare\s+([\d,]+(?:\.\d+)?)/i,
    ]);
    const ttc = extractAmount(block, [
      /Total\s+Amount\s+DZD\s*([\d,]+)/i,
      /Total\s+Amount\s+([\d,]+(?:\.\d+)?)/i,
    ]);

    log(`  Strategy 1: ticket=${ticketNumber} | name="${passengerName}" | airFare=${airFare} | ttc=${ttc}`);

    if (!passengers.find(p => p.ticketNumber === ticketNumber)) {
      passengers.push({ passengerName, ticketNumber, airFare, ttc });
    }
  }

  // Strategy 2: name/firstname LASTNAME format then ticket# (Amadeus)
  // e.g. "SMATI/RAFIK MR 712-2400057853"  or  "712-2400057853 SMATI/RAFIK MR"
  if (passengers.length === 0) {
    log('Strategy 1 found nothing — trying Strategy 2 (Amadeus NAME/FIRSTNAME format)');
    const fwdRe = /([A-Z]{2,}\/[A-Z\s]+?(?:\b(?:MR|MRS|MS|MISS)\b)?)\s+(\d{3}-\d{10}(?:-\d{2,3})?)/gi;
    const revRe = /(\d{3}-\d{10}(?:-\d{2,3})?)\s+([A-Z]{2,}\/[A-Z\s]+?(?:\b(?:MR|MRS|MS|MISS)\b)?)/gi;

    for (const re of [fwdRe, revRe]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const [ticketNumber, passengerName] = re === fwdRe
          ? [m[2].trim(), m[1].trim()]
          : [m[1].trim(), m[2].trim()];

        const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d,]+)/i]);
        const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d,]+)/i]);

        log(`  Strategy 2: ticket=${ticketNumber} | name="${passengerName}"`);

        if (!passengers.find(p => p.ticketNumber === ticketNumber)) {
          passengers.push({ passengerName, ticketNumber, airFare, ttc });
        }
      }
      if (passengers.length > 0) break;
    }
  }

  // Strategy 3: Traveler label + all ticket numbers found in body
  if (passengers.length === 0) {
    log('Strategy 2 found nothing — trying Strategy 3 (Traveler label fallback)');
    const travelerMatch = text.match(/Traveler\s+([\w\s]+?)\s{2,}Ticket/i);
    const fallbackName =
      travelerMatch?.[1]?.trim() ??
      subject?.match(/^(?:Fwd?:\s*)?([A-Z]+\/[A-Z\s]+?)\s+\d{2}[A-Z]{3}/i)?.[1]?.trim() ??
      'Unknown';

    const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d,]+)/i]);
    const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d,]+)/i]);

    for (const tn of allTicketNumbers) {
      if (!passengers.find(p => p.ticketNumber === tn)) {
        log(`  Strategy 3: ticket=${tn} | name="${fallbackName}" (fallback)`);
        passengers.push({ passengerName: fallbackName, ticketNumber: tn, airFare, ttc });
      }
    }
  }

  log(`Total passengers extracted: ${passengers.length}`);
  dump('Final passengers', passengers);

  return {
    pnr: cleanPnr ?? null,
    dateOfIssue,
    airline: airline ?? null,
    firstDepartureDate,
    lastArrivalDate,
    passengers,
    rawHtml: html.slice(0, 5000),
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
        since,
      });

      if (!uids || uids.length === 0) return emails;

      const toFetch = uids.slice(-100);

      for await (const msg of client.fetch(toFetch, { source: true })) {
        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const html = parsed.html || '';
          const text = parsed.text || '';
          const subject = parsed.subject || '';
          if (!html && !text) continue;
          const content = html || `<pre>${text}</pre>`;
          emails.push({ subject, html: content, text });
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

// ─── Date Parser ──────────────────────────────────────────────────────────────

function parseDateLoose(raw: string): Date | undefined {
  if (!raw) return undefined;

  const longMatch = raw.match(/(\d{1,2})\s+(\w+)\s*(\d{2,4})?/);
  if (longMatch) {
    const day = parseInt(longMatch[1]);
    const month = longMatch[2];
    const year = longMatch[3] ? parseInt(longMatch[3]) : new Date().getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    const d = new Date(`${month} ${day}, ${fullYear}`);
    if (!isNaN(d.getTime())) return d;
  }

  const compact = raw.match(/(\d{1,2})([A-Za-z]{3})(\d{2,4})/);
  if (compact) {
    const day = parseInt(compact[1]);
    const month = compact[2];
    let year = parseInt(compact[3]);
    if (year < 100) year += 2000;
    const d = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

// ─── Import Orchestrator ──────────────────────────────────────────────────────

export async function importTicketsFromEmail(agencyId: number): Promise<ImportResult> {
  const cfg = await prisma.agencyApiConfig.findUnique({ where: { agencyId } });

  if (!cfg || !cfg.isActive) {
    throw createError('Email import not configured for this agency. Please set it up in API Settings.', 400);
  }

  // Get agency slug for readable log folder name
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { slug: true } });
  const logger = createAgencyLogger(agencyId, agency?.slug ?? 'unknown');

  logger.section(`EMAIL IMPORT STARTED — Agency ${agencyId} (${agency?.slug ?? 'unknown'})`);
  logger.log(`Config: host=${cfg.imapHost} port=${cfg.imapPort} user=${cfg.emailAddress}`);

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
    logger.log(`IMAP ERROR: ${msg}`);
    throw createError(msg.startsWith('Cannot connect') ? msg : `IMAP connection failed: ${msg}`, 502);
  }

  logger.log(`Fetched ${emails.length} emails from IMAP`);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [], tickets: [], logFile: logger.filePath };

  for (let i = 0; i < emails.length; i++) {
    const mail = emails[i];
    if (!mail.html && !mail.text) continue;

    logger.section(`Email ${i + 1}/${emails.length}: "${mail.subject}"`);

    let parsed: ParsedEmail;
    try {
      parsed = parseEmailHtml(mail.html || mail.text, mail.subject, logger);
    } catch (e: any) {
      const msg = `Parse error in email "${mail.subject}": ${e.message}`;
      logger.log(`ERROR: ${msg}`);
      result.errors.push(msg);
      continue;
    }

    if (!parsed.passengers.length) {
      logger.log(`No passengers extracted — skipping email`);
      result.skipped++;
      continue;
    }

    for (const pax of parsed.passengers) {
      if (!pax.ticketNumber) {
        logger.log(`Skipping passenger "${pax.passengerName}" — no ticket number`);
        result.skipped++;
        continue;
      }

      const exists = await prisma.ticket.findFirst({
        where: { agencyId, ticketNumber: pax.ticketNumber },
      });

      if (exists) {
        logger.log(`Ticket ${pax.ticketNumber} already exists — skipping`);
        result.skipped++;
        continue;
      }

      try {
        await prisma.ticket.create({
          data: {
            agencyId,
            ticketNumber: pax.ticketNumber,
            pnr: parsed.pnr ?? undefined,
            passengerName: pax.passengerName,
            airline: parsed.airline ?? undefined,
            departureDate: parsed.firstDepartureDate
              ? parseDateLoose(parsed.firstDepartureDate)
              : undefined,
            arriveDate: parsed.lastArrivalDate
              ? parseDateLoose(parsed.lastArrivalDate)
              : undefined,
            airFare: pax.airFare ?? undefined,
            ttc: pax.ttc ?? undefined,
            status: 'approved',
          },
        });
        logger.log(`✓ IMPORTED: ticket=${pax.ticketNumber} | passenger="${pax.passengerName}" | airline="${parsed.airline}"`);
        result.imported++;
        result.tickets.push({ ticketNumber: pax.ticketNumber, passengerName: pax.passengerName });
      } catch (e: any) {
        if (e.code === 'P2002') {
          result.skipped++;
        } else {
          const msg = `DB error for ticket ${pax.ticketNumber}: ${e.message}`;
          logger.log(`ERROR: ${msg}`);
          result.errors.push(msg);
        }
      }
    }
  }

  logger.section(`IMPORT COMPLETE`);
  logger.log(`Imported: ${result.imported} | Skipped: ${result.skipped} | Errors: ${result.errors.length}`);

  await prisma.agencyApiConfig.update({
    where: { agencyId },
    data: { lastSync: new Date() },
  });

  return result;
}
