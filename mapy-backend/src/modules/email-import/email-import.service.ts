import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

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

// ─── Core Parser ──────────────────────────────────────────────────────────────

export function parseEmailHtml(html: string, subject?: string): ParsedEmail {
  const text = stripHtml(html);

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

  // ── Date of Issue ──
  const dateOfIssue = tryPatterns(text, [
    /Document\s+Issue\s+Date\s*[:\-]?\s*(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /Ticketed\s+Date\s*[:\-]?\s*(\d{1,2}\s*\w+\s*\d{2,4})/i,
    /Issue\s+Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Date\s+d.?(?:émission|emission)\s*[:\-]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i,
  ]);

  // ── Airline ──
  const airline = tryPatterns(text, [
    /Issuing\s+Airline\s*[:\-]?\s*([\w\s]+?)(?:\s{2,}|Ticket|\n)/i,
    /Operated\s+By\s+([\w\s]+?),\s*[A-Z]{2}\)/i,
    /(Volotea|Turkish Airlines|Qatar Airways|Air Alg[eé]rie|Air France|Lufthansa|Emirates|Fly ?Dubai|Transavia|Tunisair|Royal Air Maroc)/i,
  ]);

  // ── Departure / Arrival ──
  const depMatches = [...text.matchAll(/Departure\s+(\d{1,2}\s+\w+)/gi)];
  const arrMatches = [...text.matchAll(/Arrival\s+(\d{1,2}\s+\w+)/gi)];
  const firstDepartureDate = depMatches[0]?.[1] ?? null;
  const lastArrivalDate = arrMatches[arrMatches.length - 1]?.[1] ?? arrMatches[0]?.[1] ?? null;

  // ── Passengers ──
  const passengers: ParsedPassenger[] = [];

  // Strategy 1: standard format — ticket# then name (ADT optional)
  // e.g. "712-2400057853 Rafik Smati(ADT)" or "712-2400057853 Rafik Smati"
  const passengerRowRe = /(\d{3}-\d{10})\s+([\w\/\s]+?)(?:\s*\(ADT\)|\s*\(INF\)|\s*\(CHD\)|\s{3,}|$)/gim;
  let pm: RegExpExecArray | null;
  while ((pm = passengerRowRe.exec(text)) !== null) {
    const ticketNumber = pm[1].trim();
    const passengerName = pm[2].trim().replace(/\s+/g, ' ');
    if (!passengerName || passengerName.length < 2) continue;

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

    if (!passengers.find(p => p.ticketNumber === ticketNumber)) {
      passengers.push({ passengerName, ticketNumber, airFare, ttc });
    }
  }

  // Strategy 2: name then ticket# (Amadeus style: "SMATI/RAFIK MR 712-2400057853")
  if (passengers.length === 0) {
    const fwdRe = /([A-Z]{2,}\/[A-Z\s]+?(?:\b(?:MR|MRS|MS|MISS)\b)?)\s+(\d{3}-\d{10})/gi;
    const revRe = /(\d{3}-\d{10})\s+([A-Z]{2,}\/[A-Z\s]+?(?:\b(?:MR|MRS|MS|MISS)\b)?)/gi;

    for (const re of [fwdRe, revRe]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const [ticketNumber, passengerName] = re === fwdRe
          ? [m[2].trim(), m[1].trim()]
          : [m[1].trim(), m[2].trim()];

        const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d,]+)/i]);
        const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d,]+)/i]);

        if (!passengers.find(p => p.ticketNumber === ticketNumber)) {
          passengers.push({ passengerName, ticketNumber, airFare, ttc });
        }
      }
      if (passengers.length > 0) break;
    }
  }

  // Strategy 3: Traveler field + ticket number anywhere in body
  // Amadeus receipts: "Traveler Rafik Smati  Ticket number 712-2400057853"
  if (passengers.length === 0) {
    const travelerMatch = text.match(/Traveler\s+([\w\s]+?)\s{2,}Ticket/i);
    const ticketMatches = [...text.matchAll(/(\d{3}-\d{10})/g)];
    const fallbackName =
      travelerMatch?.[1]?.trim() ??
      subject?.match(/^(?:Fwd?:\s*)?([A-Z]+\/[A-Z\s]+?)\s+\d{2}[A-Z]{3}/i)?.[1]?.trim() ??
      'Unknown';

    const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d,]+)/i]);
    const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d,]+)/i]);

    for (const tm of ticketMatches) {
      const tn = tm[1];
      if (!passengers.find(p => p.ticketNumber === tn)) {
        passengers.push({ passengerName: fallbackName, ticketNumber: tn, airFare, ttc });
      }
    }
  }

  return {
    pnr: cleanPnr ?? null,
    dateOfIssue,
    airline: airline?.trim() ?? null,
    firstDepartureDate,
    lastArrivalDate,
    passengers,
    rawHtml: html.slice(0, 5000),
  };
}

// ─── IMAP Fetch using imapflow + mailparser ───────────────────────────────────

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
  const client = new ImapFlow({
    host: config.host ?? 'imap.gmail.com',
    port: config.port ?? 993,
    secure: true,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const emails: RawEmail[] = [];

  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      // Search for ticket-related emails
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

      // Fetch up to last 100 emails
      const toFetch = uids.slice(-100);

      for await (const msg of client.fetch(toFetch, { source: true })) {
        try {
          if (!msg.source) continue;

          // Use mailparser for robust MIME decoding (handles base64, QP, multipart, etc.)
          const parsed = await simpleParser(msg.source);

          const html = parsed.html || '';
          const text = parsed.text || '';
          const subject = parsed.subject || '';

          // Only process emails that likely contain ticket info
          if (!html && !text) continue;

          // Use HTML if available, fall back to converting plain text
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

  // "18 June 2026" or "18 Jun 26"
  const longMatch = raw.match(/(\d{1,2})\s+(\w+)\s*(\d{2,4})?/);
  if (longMatch) {
    const day = parseInt(longMatch[1]);
    const month = longMatch[2];
    const year = longMatch[3] ? parseInt(longMatch[3]) : new Date().getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    const d = new Date(`${month} ${day}, ${fullYear}`);
    if (!isNaN(d.getTime())) return d;
  }

  // "18JUN2026" compact Amadeus format
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

  let emails: RawEmail[];
  try {
    emails = await fetchEmailsFromImap({
      user: cfg.emailAddress,
      password: cfg.emailPassword,
      host: cfg.imapHost ?? undefined,
      port: cfg.imapPort ?? undefined,
    });
  } catch (err: any) {
    throw createError(`IMAP connection failed: ${err.message}`, 502);
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [], tickets: [] };

  for (const mail of emails) {
    if (!mail.html && !mail.text) continue;

    let parsed: ParsedEmail;
    try {
      parsed = parseEmailHtml(mail.html || mail.text, mail.subject);
    } catch (e: any) {
      result.errors.push(`Parse error in email "${mail.subject}": ${e.message}`);
      continue;
    }

    if (!parsed.passengers.length) {
      // Log which emails are being skipped for debugging
      console.log(`[EmailImport] No passengers found in: "${mail.subject}"`);
      result.skipped++;
      continue;
    }

    for (const pax of parsed.passengers) {
      if (!pax.ticketNumber) { result.skipped++; continue; }

      // Check by ticketNumber only (it's globally unique in schema)
      const exists = await prisma.ticket.findUnique({
        where: { ticketNumber: pax.ticketNumber },
      });

      if (exists) {
        // If it belongs to a different agency, log it as an error, not a silent skip
        if (exists.agencyId !== agencyId) {
          result.errors.push(`Ticket ${pax.ticketNumber} already exists under a different agency.`);
        } else {
          result.skipped++;
        }
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
        result.imported++;
        result.tickets.push({ ticketNumber: pax.ticketNumber, passengerName: pax.passengerName });
      } catch (e: any) {
        // Handle race condition: another process inserted between our check and create
        if (e.code === 'P2002') {
          result.skipped++;
        } else {
          result.errors.push(`DB error for ticket ${pax.ticketNumber}: ${e.message}`);
        }
      }
    }
  }

  await prisma.agencyApiConfig.update({
    where: { agencyId },
    data: { lastSync: new Date() },
  });

  return result;
}
