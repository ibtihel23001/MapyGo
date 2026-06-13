import { ImapFlow } from 'imapflow';
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

// ─── HTML Parsing Helpers ─────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractText(html: string): string {
  return stripHtml(html)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
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
  const text = extractText(html);

  // ── PNR ──
  // Try body patterns first, then fall back to subject line
  const pnr = tryPatterns(text, [
    /Booking\s+ref(?:erence)?\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /PNR\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /Airline\s+Booking\s+Reference\s*[:\-]?\s*(?:[A-Z]{2,3}\/)?([A-Z0-9]{5,8})/i,
    /Booking\s+Reference\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /\b([A-Z]{2,3}\/[A-Z0-9]{5,6})\b/,
    /\b([A-Z0-9]{6})\b(?=.*Booking)/,
  ]) ?? (subject ? tryPatterns(subject, [
    // e.g. "ZERROUG/ABDELMOUMEN 07JUL2026 ALG IST" — last 3-letter IATA code is destination
    /\b([A-Z0-9]{6})\b/,
  ]) : null);

  const cleanPnr = pnr?.includes('/') ? pnr.split('/').pop()! : pnr;

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
    /(Turkish Airlines|Qatar Airways|Air Alg[eé]rie|Air France|Lufthansa|Emirates|Fly ?Dubai|Transavia|Tunisair|Royal Air Maroc|Amadeus)/i,
  ]);

  // ── Departure / Arrival ──
  const depMatches = [...text.matchAll(/Departure\s+(\d{1,2}\s+\w+)/gi)];
  const arrMatches = [...text.matchAll(/Arrival\s+(\d{1,2}\s+\w+)/gi)];

  const firstDepartureDate = depMatches[0]?.[1] ?? null;
  const lastArrivalDate = arrMatches[arrMatches.length - 1]?.[1] ?? arrMatches[0]?.[1] ?? null;

  // ── Passengers ──
  // Strategy 1: ticket# followed by name with optional (ADT)
  const passengers: ParsedPassenger[] = [];

  // FIX: Made (ADT) optional — Amadeus emails may not include it
  const passengerRowRe = /(\d{3}-\d{10})\s+([\w\/\s]+?)(?:\s*\(ADT\)|\s{3,}|$)/gim;
  let pm: RegExpExecArray | null;
  while ((pm = passengerRowRe.exec(text)) !== null) {
    const ticketNumber = pm[1].trim();
    const passengerName = pm[2].trim().replace(/\s+/g, ' ');

    const blockStart = text.indexOf(ticketNumber);
    const blockEnd = text.indexOf('Restrictions', blockStart);
    const block = blockStart >= 0 ? text.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 2000) : text;

    const airFare = extractAmount(block, [
      /Air\s*Fare\s+DZD\s*([\d,]+)/i,
      /Air\s+Fare\s+([\d,]+(?:\.\d+)?)/i,
    ]);
    const ttc = extractAmount(block, [
      /Total\s+Amount\s+DZD\s*([\d,]+)/i,
      /Total\s+Amount\s+([\d,]+(?:\.\d+)?)/i,
    ]);

    if (passengerName && !passengers.find(p => p.ticketNumber === ticketNumber)) {
      passengers.push({ passengerName, ticketNumber, airFare, ttc });
    }
  }

  // Strategy 2: FIX — Amadeus format: NAME/FIRSTNAME [title] before or after ticket number
  if (passengers.length === 0) {
    // Pattern: "LASTNAME/FIRSTNAME MR 147-2433471701" or reversed
    const amadeusFwdRe = /([A-Z]{2,}\/[A-Z\s]+?(?:\bMR\b|\bMRS\b|\bMS\b|\bMISS\b)?)\s+(\d{3}-\d{10})/gi;
    const amadeusRevRe = /(\d{3}-\d{10})\s+([A-Z]{2,}\/[A-Z\s]+?(?:\bMR\b|\bMRS\b|\bMS\b|\bMISS\b)?)/gi;

    for (const re of [amadeusFwdRe, amadeusRevRe]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const [ticketNumber, passengerName] = re === amadeusFwdRe
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

  // Strategy 3: fallback — just grab ticket numbers
  if (passengers.length === 0) {
    const simpleRe = /(\d{3}-\d{10})/g;
    const tNums: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = simpleRe.exec(text)) !== null) tNums.push(sm[1]);

    // Try to get name from subject ("ZERROUG/ABDELMOUMEN 07JUL2026 ALG IST")
    const subjectNameMatch = subject?.match(/^(?:Fwd?:\s*)?([A-Z]+\/[A-Z\s]+?)\s+\d{2}[A-Z]{3}/i);
    const travelerMatch = text.match(/Traveler\s+([\w\s]+?)(?:\s{2,}|Ticket)/i);
    const fallbackName =
      subjectNameMatch?.[1]?.trim() ??
      travelerMatch?.[1]?.trim() ??
      'Unknown';

    const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d,]+)/i]);
    const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d,]+)/i]);

    for (const tn of [...new Set(tNums)]) {
      passengers.push({ passengerName: fallbackName, ticketNumber: tn, airFare, ttc });
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

// ─── IMAP Fetch using imapflow ────────────────────────────────────────────────

interface ImapConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
}

interface RawEmail {
  subject: string;
  html: string;
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

      // FIX: Expanded search to match Amadeus / forwarded ticket emails
      const uids = await client.search({
        or: [
          { from: 'noreply@turkish.com' },
          { from: 'eticket@qatarairways.com.qa' },
          { from: 'confirmation@amadeus.com' },  // ← your actual sender
          { from: 'amadeus.com' },               // ← catch all amadeus domains
          { from: 'eticket' },
          { subject: 'Electronic Ticket' },
          { subject: 'ALG' },                    // ← your route-based subjects
          { subject: 'e-ticket' },
          { subject: 'eticket' },
          { subject: 'billet' },                 // ← French "ticket"
        ],
        since,
      });

      if (!uids || uids.length === 0) return emails;

      // Fetch last 50
      const toFetch = uids.slice(-50);

      for await (const msg of client.fetch(toFetch, { source: true })) {
        try {
          if (!msg.source) continue;
          const raw = msg.source.toString('utf8');
          const html = extractHtmlFromMime(raw);
          const subject = extractHeaderFromMime(raw, 'subject');
          if (html) {
            emails.push({ subject, html });
          }
        } catch {
          // skip malformed messages
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

/** Extract the first text/html part from a raw MIME message */
function extractHtmlFromMime(raw: string): string {
  const htmlMatch = raw.match(/Content-Type:\s*text\/html[^\r\n]*[\r\n]+(?:Content-[^\r\n]+[\r\n]+)*[\r\n]+([\s\S]*?)(?:--|$)/i);
  if (htmlMatch?.[1]) {
    const body = htmlMatch[1].trim();
    if (raw.match(/Content-Transfer-Encoding:\s*quoted-printable/i)) {
      return decodeQuotedPrintable(body);
    }
    if (raw.match(/Content-Transfer-Encoding:\s*base64/i)) {
      try { return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8'); } catch { return body; }
    }
    return body;
  }
  const bodyStart = raw.indexOf('\r\n\r\n');
  return bodyStart >= 0 ? raw.slice(bodyStart + 4) : '';
}

function extractHeaderFromMime(raw: string, header: string): string {
  const match = raw.match(new RegExp(`^${header}:\\s*(.+)`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ─── Date parser ──────────────────────────────────────────────────────────────

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
  // Amadeus compact: 07JUL2026
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
    if (!mail.html) continue;

    let parsed: ParsedEmail;
    try {
      // FIX: pass subject so parsers can extract name/PNR from it
      parsed = parseEmailHtml(mail.html, mail.subject);
    } catch (e: any) {
      result.errors.push(`Parse error in email "${mail.subject}": ${e.message}`);
      continue;
    }

    if (!parsed.passengers.length) { result.skipped++; continue; }

    for (const pax of parsed.passengers) {
      if (!pax.ticketNumber) { result.skipped++; continue; }

      const exists = await prisma.ticket.findUnique({ where: { ticketNumber: pax.ticketNumber } });
      if (exists) { result.skipped++; continue; }

      try {
        await prisma.ticket.create({
          data: {
            agencyId,
            ticketNumber: pax.ticketNumber,
            pnr: parsed.pnr ?? undefined,
            passengerName: pax.passengerName,
            airline: parsed.airline ?? undefined,
            dateOfIssue: parsed.dateOfIssue ? parseDateLoose(parsed.dateOfIssue) : undefined,
            departureDate: parsed.firstDepartureDate ? parseDateLoose(parsed.firstDepartureDate) : undefined,
            arrivalDate: parsed.lastArrivalDate ? parseDateLoose(parsed.lastArrivalDate) : undefined,
            airFare: pax.airFare ?? undefined,
            ttc: pax.ttc ?? undefined,
            status: 'pending',
          },
        });
        result.imported++;
        result.tickets.push({ ticketNumber: pax.ticketNumber, passengerName: pax.passengerName });
      } catch (e: any) {
        result.errors.push(`DB error for ticket ${pax.ticketNumber}: ${e.message}`);
      }
    }
  }

  await prisma.agencyApiConfig.update({
    where: { agencyId },
    data: { lastSync: new Date() },
  });

  return result;
}
