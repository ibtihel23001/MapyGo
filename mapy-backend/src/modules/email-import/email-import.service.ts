import { ImapFlow } from 'imapflow';
import * as pdfParse from 'pdf-parse';
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
      const num = parseFloat(m[1].replace(/[,\s]/g, ''));
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

// ─── Core Parser (works on plain text from HTML body or PDF) ─────────────────

export function parseTicketText(text: string, subject?: string): ParsedEmail {

  // ── PNR ──
  const pnr = tryPatterns(text, [
    /Booking\s+ref(?:erence)?\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /PNR\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /Airline\s+Booking\s+Reference\s*[:\-]?\s*(?:[A-Z]{2,3}\/)?([A-Z0-9]{5,8})/i,
    /Booking\s+Reference\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /\b([A-Z]{2,3}\/[A-Z0-9]{5,6})\b/,
  ]) ?? (subject ? tryPatterns(subject, [/\b([A-Z0-9]{6})\b/]) : null);

  const cleanPnr = pnr?.includes('/') ? pnr.split('/').pop()! : pnr;

  // ── Date of Issue ──
  const dateOfIssue = tryPatterns(text, [
    /Document\s+Issue\s+Date\s*[:\-]?\s*(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /Ticketed?\s+(?:On\s+)?Date\s*[:\-]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i,
    /Issue\s+Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Date\s+d['\u2019](?:[ée]mission)\s*[:\-]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i,
  ]);

  // ── Airline ──
  const airline = tryPatterns(text, [
    /Issuing\s+Airline\s*[:\-]?\s*([\w\s]+?)(?:\s{2,}|Ticket|\n)/i,
    /(Turkish Airlines|Qatar Airways|Air Alg[eé]rie|Air France|Lufthansa|Emirates|Fly ?Dubai|Transavia|Tunisair|Royal Air Maroc)/i,
  ]);

  // ── Dates ──
  const depMatches = [...text.matchAll(/Departure\s+(\d{1,2}\s+\w+)/gi)];
  const arrMatches = [...text.matchAll(/Arrival\s+(\d{1,2}\s+\w+)/gi)];
  const firstDepartureDate = depMatches[0]?.[1] ?? null;
  const lastArrivalDate = arrMatches[arrMatches.length - 1]?.[1] ?? null;

  // ── Passengers ──
  // Amadeus ticket numbers: 3-digit airline code + hyphen + 7 digits (e.g. 124-2433471)
  // Sometimes written with 10 digits — support both
  const TICKET_RE = /\d{3}-\d{7,10}/g;
  const passengers: ParsedPassenger[] = [];

  // Strategy 1: ticket# then name (with optional ADT marker)
  const fwdTicketRe = /(\d{3}-\d{7,10})\s+([\w\/\s\-]+?)(?:\s*\(ADT\)|\s{2,}|\n|$)/gim;
  let m: RegExpExecArray | null;
  while ((m = fwdTicketRe.exec(text)) !== null) {
    const ticketNumber = m[1].trim();
    const passengerName = m[2].trim().replace(/\s+/g, ' ');
    if (!passengerName || passengerName.length < 3) continue;
    if (passengers.find(p => p.ticketNumber === ticketNumber)) continue;

    const blockStart = text.indexOf(ticketNumber);
    const block = text.slice(blockStart, blockStart + 2000);
    const airFare = extractAmount(block, [/Air\s*Fare\s+DZD\s*([\d\s,]+)/i, /Air\s+Fare\s+([\d,]+(?:\.\d+)?)/i]);
    const ttc = extractAmount(block, [/Total\s+Amount\s+DZD\s*([\d\s,]+)/i, /Total\s+Amount\s+([\d,]+(?:\.\d+)?)/i]);
    passengers.push({ passengerName, ticketNumber, airFare, ttc });
  }

  // Strategy 2: Amadeus "NAME/FIRSTNAME [title]  ticketNumber" (name before ticket)
  if (passengers.length === 0) {
    const nameFirstRe = /([A-Z]{2,}\/[A-Z][A-Z\s]+?(?:\s+(?:MR|MRS|MS|MISS))?)\s{1,10}(\d{3}-\d{7,10})/gi;
    while ((m = nameFirstRe.exec(text)) !== null) {
      const passengerName = m[1].trim();
      const ticketNumber = m[2].trim();
      if (passengers.find(p => p.ticketNumber === ticketNumber)) continue;
      const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d\s,]+)/i]);
      const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d\s,]+)/i]);
      passengers.push({ passengerName, ticketNumber, airFare, ttc });
    }
  }

  // Strategy 3: fallback — grab all ticket numbers, use subject name
  if (passengers.length === 0) {
    const tNums = [...new Set([...text.matchAll(TICKET_RE)].map(x => x[0]))];
    const subjectName = subject?.match(/^(?:Fwd?:\s*)?([A-Z]+\/[A-Z\s]+?)\s+\d{2}[A-Z]{3}/i)?.[1]?.trim();
    const bodyName = text.match(/Traveler\s+([\w\s]+?)(?:\s{2,}|Ticket)/i)?.[1]?.trim();
    const fallbackName = subjectName ?? bodyName ?? 'Unknown';
    const airFare = extractAmount(text, [/Air\s*Fare\s+(?:DZD\s*)?([\d\s,]+)/i]);
    const ttc = extractAmount(text, [/Total\s+Amount\s+(?:DZD\s*)?([\d\s,]+)/i]);
    for (const tn of tNums) {
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
    rawHtml: text.slice(0, 5000),
  };
}

// ─── MIME Helpers ─────────────────────────────────────────────────────────────

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractHeaderFromMime(raw: string, header: string): string {
  const match = raw.match(new RegExp(`^${header}:\\s*(.+)`, 'im'));
  return match?.[1]?.trim() ?? '';
}

/**
 * Parse a raw MIME message and return all text/html parts and PDF attachments.
 */
function parseMimeParts(raw: string): { htmlBodies: string[]; pdfBuffers: Buffer[] } {
  const htmlBodies: string[] = [];
  const pdfBuffers: Buffer[] = [];

  // Split by MIME boundaries
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  const boundary = boundaryMatch?.[1];

  const parts = boundary
    ? raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`))
    : [raw];

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const headers = part.slice(0, headerEnd);
    const body = part.slice(headerEnd + 4);

    const contentType = headers.match(/Content-Type:\s*([^\r\n;]+)/i)?.[1]?.trim().toLowerCase() ?? '';
    const encoding = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() ?? '';

    if (contentType.includes('text/html')) {
      let decoded = body.trim();
      if (encoding === 'quoted-printable') decoded = decodeQuotedPrintable(decoded);
      else if (encoding === 'base64') {
        try { decoded = Buffer.from(decoded.replace(/\s/g, ''), 'base64').toString('utf8'); } catch {}
      }
      if (decoded) htmlBodies.push(decoded);
    }

    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') || headers.match(/filename="?.*\.pdf"?/i)) {
      if (encoding === 'base64') {
        try {
          const buf = Buffer.from(body.replace(/\s/g, ''), 'base64');
          pdfBuffers.push(buf);
        } catch {}
      }
    }
  }

  return { htmlBodies, pdfBuffers };
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
  textFromHtml: string;
  textFromPdfs: string[];
}

async function fetchEmailsFromImap(config: ImapConfig): Promise<RawEmail[]> {
  const client = new ImapFlow({
    host: config.host ?? 'imap.gmail.com',
    port: config.port ?? 993,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const emails: RawEmail[] = [];
  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - 180); // 6 months

      const uids = await client.search({
        or: [
          { from: 'noreply@turkish.com' },
          { from: 'eticket@qatarairways.com.qa' },
          { from: 'confirmation@amadeus.com' },
          { from: 'amadeus.com' },
          { from: 'eticket' },
          { subject: 'Electronic Ticket' },
          { subject: 'ALG' },
          { subject: 'e-ticket' },
          { subject: 'eticket' },
          { subject: 'billet' },
        ],
        since,
      });

      if (!uids || uids.length === 0) return emails;

      const toFetch = uids.slice(-100);

      for await (const msg of client.fetch(toFetch, { source: true })) {
        try {
          if (!msg.source) continue;
          const raw = msg.source.toString('binary'); // binary to preserve PDF bytes
          const subject = extractHeaderFromMime(raw, 'subject');

          const { htmlBodies, pdfBuffers } = parseMimeParts(raw);

          // Extract text from HTML parts
          const textFromHtml = htmlBodies.map(h => extractText(h)).join('\n');

          // Extract text from PDF attachments
          const textFromPdfs: string[] = [];
          for (const pdfBuf of pdfBuffers) {
            try {
              const parsed = await pdfParse(pdfBuf);
              if (parsed.text) textFromPdfs.push(parsed.text);
            } catch {
              // skip unreadable PDFs
            }
          }

          emails.push({ subject, textFromHtml, textFromPdfs });
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

// ─── Date Parser ──────────────────────────────────────────────────────────────

function parseDateLoose(raw: string): Date | undefined {
  if (!raw) return undefined;
  // Amadeus compact: 07JUL2026
  const compact = raw.match(/(\d{1,2})([A-Za-z]{3})(\d{2,4})/);
  if (compact) {
    let year = parseInt(compact[3]);
    if (year < 100) year += 2000;
    const d = new Date(`${compact[2]} ${compact[1]}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }
  const longMatch = raw.match(/(\d{1,2})\s+(\w+)\s*(\d{2,4})?/);
  if (longMatch) {
    const year = longMatch[3] ? parseInt(longMatch[3]) : new Date().getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    const d = new Date(`${longMatch[2]} ${longMatch[1]}, ${fullYear}`);
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
    // Build a combined text corpus: HTML body first, then each PDF
    // We parse each source separately so PDF data doesn't bleed between tickets
    const sources: string[] = [];
    if (mail.textFromHtml.trim()) sources.push(mail.textFromHtml);
    sources.push(...mail.textFromPdfs);

    // If no text anywhere, skip
    if (sources.length === 0) { result.skipped++; continue; }

    // Parse each source independently and merge unique passengers
    const allPassengers: ParsedPassenger[] = [];
    let sharedMeta: Omit<ParsedEmail, 'passengers' | 'rawHtml'> | null = null;

    for (const src of sources) {
      let parsed: ParsedEmail;
      try {
        parsed = parseTicketText(src, mail.subject);
      } catch (e: any) {
        result.errors.push(`Parse error in "${mail.subject}": ${e.message}`);
        continue;
      }
      if (!sharedMeta) sharedMeta = { pnr: parsed.pnr, dateOfIssue: parsed.dateOfIssue, airline: parsed.airline, firstDepartureDate: parsed.firstDepartureDate, lastArrivalDate: parsed.lastArrivalDate };
      for (const pax of parsed.passengers) {
        if (!allPassengers.find(p => p.ticketNumber === pax.ticketNumber)) {
          allPassengers.push(pax);
        }
      }
    }

    if (allPassengers.length === 0) { result.skipped++; continue; }

    for (const pax of allPassengers) {
      if (!pax.ticketNumber) { result.skipped++; continue; }

      const exists = await prisma.ticket.findUnique({ where: { ticketNumber: pax.ticketNumber } });
      if (exists) { result.skipped++; continue; }

      try {
        await prisma.ticket.create({
          data: {
            agencyId,
            ticketNumber: pax.ticketNumber,
            pnr: sharedMeta?.pnr ?? undefined,
            passengerName: pax.passengerName,
            airline: sharedMeta?.airline ?? undefined,
            dateOfIssue: sharedMeta?.dateOfIssue ? parseDateLoose(sharedMeta.dateOfIssue) : undefined,
            departureDate: sharedMeta?.firstDepartureDate ? parseDateLoose(sharedMeta.firstDepartureDate) : undefined,
            arrivalDate: sharedMeta?.lastArrivalDate ? parseDateLoose(sharedMeta.lastArrivalDate) : undefined,
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
