/**
 * tickets.service.ts
 *
 * AI-powered ticket extraction using Groq (llama-3.3-70b).
 * All emails — regardless of format — are sent directly to Groq for extraction.
 * No regex parsers, no format detection.
 */

import prisma from '../../config/prisma';
import type { PrismaClient } from '@prisma/client';
import type {
  CreateTicketInput,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from './tickets.schema';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import { extractWithGroq } from './ai-extractor';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EmailFormat =
  | 'CONFIRMATION'
  | 'ETICKET'
  | 'NOREPLY'
  | 'TELEX'
  | 'SOLEIL'
  | 'AI_EXTRACTED'
  | 'UNKNOWN';

export interface ExtractedTicket {
  ticketNumber: string;
  passengerName: string;
  pnr: string;
  airline: string;
  itinerary: string;
  departureDate: Date | null;
  arriveDate: Date | null;
  airFare: number | null;
  ttc: number | null;
  agency: string;
  detectedAgencyName: string;
  format: EmailFormat;
}

export interface ImportResult {
  format: EmailFormat;
  total: number;
  inserted: number;
  skipped: number;
  errors: string[];
  extractionLog: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENCY DETECTION (DB-driven)
// ─────────────────────────────────────────────────────────────────────────────

async function detectAgency(
  body: string,
  db: PrismaClient = prisma
): Promise<{ agencyCode: string; agencyName: string } | null> {
  try {
    const agencies = await db.agency.findMany({
      select: { name: true, slug: true },
    });
    for (const ag of agencies) {
      if (ag.name && body.toLowerCase().includes(ag.name.toLowerCase())) {
        return { agencyCode: ag.slug, agencyName: ag.name };
      }
    }
  } catch (_) {
    // Silently skip if lookup fails
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — EXTRACT + UPSERT (AI only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a raw email body to Groq AI, extract ticket records,
 * and upsert them into the Prisma `ticket` table.
 *
 * @param rawBody   Decoded plain-text email body (HTML stripped before passing in)
 * @param agencyId  The Prisma agency ID for the receiving mailbox
 * @param emailDate Date the email was received (unused, kept for API compat)
 * @param db        Prisma client (defaults to shared instance)
 */
export async function importFromEmailBody(
  rawBody: string,
  agencyId: number,
  emailDate?: string | Date,
  db: PrismaClient = prisma
): Promise<ImportResult> {
  const result: ImportResult = {
    format: 'AI_EXTRACTED',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    extractionLog: [],
  };

  const log = (msg: string) => {
    result.extractionLog.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[EmailImport] ${msg}`);
  };

  log(`Body length: ${rawBody.length} chars`);
  log(`Body preview (first 500): ${rawBody.slice(0, 500).replace(/\n/g, ' ↵ ')}`);

  // 1. AI Extraction
  let records: ExtractedTicket[] = [];
  try {
    log('Sending email to Groq AI extractor...');
    records = await extractWithGroq(rawBody, log);
  } catch (err: any) {
    const msg = `AI extraction error: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    log(`ERROR: ${msg}`);
    return result;
  }

  result.total = records.length;
  log(`Extraction complete: ${records.length} record(s) found`);

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    log(`  Record ${i + 1}: ticket="${rec.ticketNumber}" | passenger="${rec.passengerName}" | airline="${rec.airline}" | pnr="${rec.pnr}" | airFare=${rec.airFare} | ttc=${rec.ttc}`);
  }

  if (records.length === 0) {
    result.errors.push('No ticket records extracted from email body');
    log('WARN: No records extracted — check email content');
    return result;
  }

  // 2. Agency detection
  const detectedAgency = await detectAgency(rawBody, db);
  if (detectedAgency) log(`Detected agency in body: "${detectedAgency.agencyName}"`);

  // 3. Upsert into DB
  for (const rec of records) {
    try {
      if (detectedAgency) {
        rec.detectedAgencyName = detectedAgency.agencyName;
      }

      const existing = await db.ticket.findFirst({
        where: {
          agencyId,
          ticketNumber: rec.ticketNumber,
        },
      });

      if (existing) {
        log(`  SKIPPED (already exists): ticket="${rec.ticketNumber}"`);
        result.skipped++;
        continue;
      }

      await db.ticket.create({
        data: {
          agencyId,
          ticketNumber:  rec.ticketNumber,
          passengerName: rec.passengerName,
          pnr:           rec.pnr || null,
          airline:       rec.airline || null,
          departureDate: rec.departureDate,
          arriveDate:    rec.arriveDate,
          airFare:       rec.airFare !== null ? rec.airFare : undefined,
          ttc:           rec.ttc    !== null ? rec.ttc    : undefined,
          status:        'approved',
        },
      });

      log(`  INSERTED: ticket="${rec.ticketNumber}" | passenger="${rec.passengerName}"`);
      result.inserted++;
    } catch (err: any) {
      const msg = `Insert error for ${rec.ticketNumber}: ${err?.message ?? String(err)}`;
      result.errors.push(msg);
      log(`  ERROR: ${msg}`);
    }
  }

  log(`DONE: inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors.length}`);
  return result;
}

/**
 * Preview extraction WITHOUT writing to DB.
 * Useful for dry-run mode on the frontend.
 */
export async function previewEmailImport(
  rawBody: string
): Promise<{ format: EmailFormat; records: ExtractedTicket[] }> {
  const log = (msg: string) => console.log(`[PreviewImport] ${msg}`);
  const records = await extractWithGroq(rawBody, log);
  return { format: 'AI_EXTRACTED', records };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — listTickets, getTicket, createTicket, updateTicket, deleteTicket, exportTicketsCsv
// ─────────────────────────────────────────────────────────────────────────────

function isSuperAdmin(roleSlug?: string) {
  return roleSlug === 'super_admin' || roleSlug === 'superadmin';
}

function agencyFilter(agencyId?: number | null, roleSlug?: string) {
  if (isSuperAdmin(roleSlug)) return {};
  return agencyId ? { agencyId } : { agencyId: -1 };
}

export async function listTickets(
  query: Record<string, any>,
  _userId: number,
  agencyId?: number | null,
  roleSlug?: string,
) {
  const { page, perPage: limit, skip } = getPagination(query);

  const where: any = { ...agencyFilter(agencyId, roleSlug) };
  if (query.search) {
    where.OR = [
      { ticketNumber:  { contains: query.search, mode: 'insensitive' } },
      { passengerName: { contains: query.search, mode: 'insensitive' } },
      { pnr:           { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status)  where.status  = query.status;
  if (query.airline) where.airline = { contains: query.airline, mode: 'insensitive' };
  if (query.dateFrom || query.dateTo) {
    where.departureDate = {};
    if (query.dateFrom) where.departureDate.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.departureDate.lte = new Date(query.dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.ticket.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
}

export async function getTicket(id: number, agencyId?: number | null, roleSlug?: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw createError('Ticket not found', 404);
  if (!isSuperAdmin(roleSlug) && agencyId && ticket.agencyId !== agencyId)
    throw createError('Forbidden', 403);
  return ticket;
}

export async function createTicket(input: CreateTicketInput, agencyId: number) {
  return prisma.ticket.create({
    data: {
      agencyId,
      ticketNumber:  input.ticketNumber,
      pnr:           input.pnr ?? null,
      passengerName: input.passengerName,
      airline:       input.airline ?? null,
      departureDate: input.departureDate ? new Date(input.departureDate) : null,
      arriveDate:    input.arriveDate    ? new Date(input.arriveDate)    : null,
      airFare:       input.airFare ?? null,
      ttc:           input.ttc ?? null,
    },
  });
}

export async function updateTicket(
  id: number,
  input: UpdateTicketInput,
  agencyId?: number | null,
  roleSlug?: string,
) {
  const ticket = await getTicket(id, agencyId, roleSlug);
  return prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      ...(input.ticketNumber  !== undefined && { ticketNumber:  input.ticketNumber }),
      ...(input.pnr           !== undefined && { pnr:           input.pnr }),
      ...(input.passengerName !== undefined && { passengerName: input.passengerName }),
      ...(input.airline       !== undefined && { airline:       input.airline }),
      ...(input.departureDate !== undefined && { departureDate: input.departureDate ? new Date(input.departureDate) : null }),
      ...(input.arriveDate    !== undefined && { arriveDate:    input.arriveDate    ? new Date(input.arriveDate)    : null }),
      ...(input.airFare       !== undefined && { airFare:       input.airFare }),
      ...(input.ttc           !== undefined && { ttc:           input.ttc }),
    },
  });
}

export async function updateTicketStatus(
  id: number,
  input: UpdateTicketStatusInput,
  agencyId?: number | null,
  roleSlug?: string,
) {
  const ticket = await getTicket(id, agencyId, roleSlug);
  return prisma.ticket.update({ where: { id: ticket.id }, data: { status: input.status as any } });
}

export async function deleteTicket(id: number, agencyId?: number | null, roleSlug?: string) {
  const ticket = await getTicket(id, agencyId, roleSlug);
  await prisma.ticket.delete({ where: { id: ticket.id } });
}

export async function exportTicketsCsv(
  query: Record<string, any>,
  agencyId?: number | null,
  roleSlug?: string,
): Promise<string> {
  const where: any = { ...agencyFilter(agencyId, roleSlug) };
  if (query.search) where.OR = [
    { ticketNumber:  { contains: query.search, mode: 'insensitive' } },
    { passengerName: { contains: query.search, mode: 'insensitive' } },
  ];
  if (query.status)  where.status  = query.status;
  if (query.dateFrom || query.dateTo) {
    where.departureDate = {};
    if (query.dateFrom) where.departureDate.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.departureDate.lte = new Date(query.dateTo);
  }

  const tickets = await prisma.ticket.findMany({ where, orderBy: { createdAt: 'desc' } });

  const header = 'Ticket #,PNR,Passenger,Airline,Departure,Arrival,Air Fare,TTC,Status\n';
  const rows = tickets.map(t => [
    t.ticketNumber,
    t.pnr ?? '',
    t.passengerName,
    t.airline ?? '',
    t.departureDate ? t.departureDate.toISOString().slice(0, 10) : '',
    t.arriveDate    ? t.arriveDate.toISOString().slice(0, 10)    : '',
    t.airFare?.toString() ?? '',
    t.ttc?.toString() ?? '',
    t.status,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

  return header + rows;
}
