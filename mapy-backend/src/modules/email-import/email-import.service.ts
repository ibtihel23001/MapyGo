import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { Readable } from 'stream';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── HTML Parsing Helpers ────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractText(html: string): string {
  // Decode common HTML entities
  return stripHtml(html)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Try many regex patterns and return first match group[1] */
function tryPatterns(text: string, patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// ─── Core Parser ─────────────────────────────────────────────────────────────

export function parseEmailHtml(html: string): ParsedEmail {
  const text = extractText(html);

  // ── PNR / Booking Reference ──
  const pnr = tryPatterns(text, [
    /Booking\s+ref(?:erence)?\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /PNR\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /Airline\s+Booking\s+Reference\s*[:\-]?\s*(?:[A-Z]{2,3}\/)?([A-Z0-9]{5,8})/i,
    /Booking\s+Reference\s*[:\-]?\s*([A-Z0-9]{5,8})/i,
    /\b([A-Z]{2,3}\/[A-Z0-9]{5,6})\b/,   // e.g. TK/8RZPRB  or  GR/FWWFL8
    /\b([A-Z0-9]{6})\b(?=.*Booking)/,
  ]);

  // Normalise "TK/8RZPRB" → "8RZPRB"
  const cleanPnr = pnr?.includes('/') ? pnr.split('/').pop()! : pnr;

  // ── Document Issue Date ──
  const dateOfIssue = tryPatterns(text, [
    /Document\s+Issue\s+Date\s*[:\-]?\s*(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /Ticketed\s+Date\s*[:\-]?\s*(\d{1,2}\s*\w+\s*\d{2,4})/i,
    /Issue\s+Date\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  ]);

  // ── Airline ──
  const airline = tryPatterns(text, [
    /Issuing\s+Airline\s*[:\-]?\s*([\w\s]+?)(?:\s{2,}|Ticket|\n)/i,
    /Operated\s+By\s+([\w\s]+?),\s*[A-Z]{2}\)/i,
    /(Turkish Airlines|Qatar Airways|Air Algerie|Air France|Lufthansa|Emirates|Fly Dubai|Transavia|Tunisair|Royal Air Maroc)/i,
  ]);

  // ── Flight dates: collect all dates from Departure/Arrival rows ──
  const depMatches = [...text.matchAll(/Departure\s+(\d{1,2}\s+\w+)/gi)];
  const arrMatches = [...text.matchAll(/Arrival\s+(\d{1,2}\s+\w+)/gi)];

  const firstDepartureDate = depMatches[0]?.[1] ?? null;
  const lastArrivalDate = arrMatches[arrMatches.length - 1]?.[1] ?? arrMatches[0]?.[1] ?? null;

  // ── Passengers: find all ticket rows in Receipt section ──
  const passengers: ParsedPassenger[] = [];

  // Pattern: look for sections "Ticket number ... <name>(ADT) ... Ticketed Date"
  // Works for both Turkish Airlines and Qatar Airways format
  const receiptBlocks = html.split(/<tr[^>]*>/i);

  // Strategy A – extract from receipt table rows with ticket number patterns
  // Matches "235-2172347705   Younes Kenzi Iheb Zerroug(ADT)  Ticketed Date: 11Jun26"
  const passengerRowRe = /(\d{3}-\d{10})\s+([\w\s]+?)\s*\(ADT\)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = passengerRowRe.exec(text)) !== null) {
    const ticketNumber = pm[1].trim();
    const passengerName = pm[2].trim();

    // Extract financials for this specific ticket block
    const blockStart = text.indexOf(ticketNumber);
    const blockEnd = text.indexOf('157-', blockStart + 1) !== -1
      ? Math.min(text.indexOf('Restrictions', blockStart), text.indexOf('Issuing Airline', blockStart) + 500)
      : text.indexOf('Restrictions', blockStart);

    const block = blockStart >= 0 ? text.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 2000) : text;

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

  // Strategy B – fallback: simpler ticket number scan when Strategy A finds nothing
  if (passengers.length === 0) {
    const simpleRe = /(\d{3}-\d{10})/g;
    const tNums: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = simpleRe.exec(text)) !== null) tNums.push(sm[1]);

    const travelerRe = /Traveler\s+([\w\s]+?)(?:\s{2,}|Ticket)/i;
    const travelerMatch = text.match(travelerRe);
    const fallbackName = travelerMatch?.[1]?.trim() ?? 'Unknown';

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
    rawHtml: html.slice(0, 5000), // store first 5k chars
  };
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

// ─── IMAP Fetch ───────────────────────────────────────────────────────────────

interface ImapConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
  tls?: boolean;
}

async function fetchEmailsFromImap(config: ImapConfig): Promise<ParsedMail[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host ?? 'imap.gmail.com',
      port: config.port ?? 993,
      tls: config.tls ?? true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    });

    const emails: ParsedMail[] = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        // Search for e-ticket emails from last 90 days
        const since = new Date();
        since.setDate(since.getDate() - 90);

        // Filter for typical e-ticket senders
        imap.search(
          [['OR',
            ['FROM', 'noreply@turkish.com'],
            ['OR',
              ['FROM', 'eticket@qatarairways.com.qa'],
              ['OR',
                ['FROM', 'eticket'],
                ['SUBJECT', 'Electronic Ticket']
              ]
            ]
          ]],
          (searchErr, results) => {
            if (searchErr || !results?.length) {
              imap.end();
              return resolve([]);
            }

            const fetch = imap.fetch(results.slice(-50), { bodies: '' }); // last 50 emails
            const promises: Promise<ParsedMail>[] = [];

            fetch.on('message', (msg) => {
              const p = new Promise<ParsedMail>((res2, rej2) => {
                msg.on('body', (stream) => {
                  const chunks: Buffer[] = [];
                  stream.on('data', (c: Buffer) => chunks.push(c));
                  stream.once('end', () => {
                    simpleParser(Readable.from(Buffer.concat(chunks)))
                      .then(res2)
                      .catch(rej2);
                  });
                });
              });
              promises.push(p);
            });

            fetch.once('end', () => {
              Promise.allSettled(promises).then((settled) => {
                settled.forEach((r) => {
                  if (r.status === 'fulfilled') emails.push(r.value);
                });
                imap.end();
              });
            });

            fetch.once('error', () => { imap.end(); resolve(emails); });
          },
        );
      });
    });

    imap.once('error', reject);
    imap.once('end', () => resolve(emails));
    imap.connect();
  });
}

// ─── Import Orchestrator ─────────────────────────────────────────────────────

export async function importTicketsFromEmail(agencyId: number): Promise<ImportResult> {
  // Load email config for this agency
  const cfg = await prisma.agencyApiConfig.findUnique({
    where: { agencyId },
  });

  if (!cfg || !cfg.isActive) {
    throw createError('Email import not configured for this agency. Please set it up in API Settings.', 400);
  }

  let emails: ParsedMail[];
  try {
    emails = await fetchEmailsFromImap({
      user: cfg.emailAddress,
      password: cfg.emailPassword,
      host: cfg.imapHost,
      port: cfg.imapPort,
    });
  } catch (err: any) {
    throw createError(`IMAP connection failed: ${err.message}`, 502);
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [], tickets: [] };

  for (const mail of emails) {
    const html = mail.html || mail.textAsHtml || '';
    if (!html) continue;

    let parsed: ParsedEmail;
    try {
      parsed = parseEmailHtml(html);
    } catch (e: any) {
      result.errors.push(`Parse error in email "${mail.subject}": ${e.message}`);
      continue;
    }

    if (!parsed.passengers.length) {
      result.skipped++;
      continue;
    }

    for (const pax of parsed.passengers) {
      if (!pax.ticketNumber) { result.skipped++; continue; }

      // Check duplicate
      const exists = await prisma.ticket.findUnique({
        where: { ticketNumber: pax.ticketNumber },
      });

      if (exists) { result.skipped++; continue; }

      try {
        await prisma.ticket.create({
          data: {
            agencyId,
            ticketNumber: pax.ticketNumber,
            pnr: parsed.pnr ?? undefined,
            passengerName: pax.passengerName,
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

  // Update lastSync
  await prisma.agencyApiConfig.update({
    where: { agencyId },
    data: { lastSync: new Date() },
  });

  return result;
}

// ─── Date parser – handles "27 June 2026", "11Jun26", "23/05/2026" etc. ─────

function parseDateLoose(raw: string): Date | undefined {
  if (!raw) return undefined;

  // "27 June 2026" or "27 June"
  const longMatch = raw.match(/(\d{1,2})\s+(\w+)\s*(\d{2,4})?/);
  if (longMatch) {
    const day = parseInt(longMatch[1]);
    const month = longMatch[2];
    const year = longMatch[3] ? parseInt(longMatch[3]) : new Date().getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    const d = new Date(`${month} ${day}, ${fullYear}`);
    if (!isNaN(d.getTime())) return d;
  }

  // "11Jun26" (compact)
  const compact = raw.match(/(\d{1,2})([A-Za-z]{3})(\d{2,4})/);
  if (compact) {
    const day = parseInt(compact[1]);
    const month = compact[2];
    let year = parseInt(compact[3]);
    if (year < 100) year += 2000;
    const d = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }

  // ISO or slash format
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}
