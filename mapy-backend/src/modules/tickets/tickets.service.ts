/**
 * email-import.service.ts
 *
 * Full TypeScript port of all five PHP email-parser scripts:
 *   1. parse-gmail-info.php     → FORMAT_CONFIRMATION  (multi-passenger, "Booking ref / Traveler / Ticket number / Issuing Airline" table)
 *   2. parse-gmail2.php         → FORMAT_ETICKET       (single-passenger, "NAME: LAST/FIRST", "TICKET NUMBER: ETKT …", EN + FR variants)
 *   3. parse-gmail-noreply.php  → FORMAT_NOREPLY       (same template as eticket but from doc.mail.amadeus.com)
 *   4. parse-gmail-telex.php    → FORMAT_TELEX         (booking confirmation with "Your trip" + "Booking ref", NO 13-digit ticket)
 *   5. parse_solei.php          → FORMAT_SOLEIL        (Soleil Voyages agency – same ETKT template, agency always = "SOLEIL VOYAGES")
 *
 * Format detection is content-based — NO sender filter.
 * Each detected format delegates to its own extractor, then all results are
 * upserted into the Prisma `ticket` table using the existing field names.
 *
 * Field mapping (PHP → Prisma model):
 *   ticket_number   → ticketNumber
 *   traveler_name   → passengerName
 *   booking_ref     → pnr
 *   issue_date      → createdAt (not stored separately; used for departureDate fallback)
 *   travel_date     → departureDate
 *   airline         → airline
 *   itinerary       → itinerary  (not in current Prisma schema — stored in notes or ignored)
 *   air_fare        → airFare
 *   total_amount    → ttc
 *   agency          → (used to look up agencyId)
 *   detected_agency_name → (same lookup)
 *
 * Usage:
 *   import { importFromEmailBody } from './email-import.service';
 *   const results = await importFromEmailBody(rawEmailText, agencyId, prisma);
 */

import prisma from '../../config/prisma';
import type { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LOOKUP TABLES
// ─────────────────────────────────────────────────────────────────────────────

/** IATA airline prefix (first 3 digits of ticket number) → full airline name */
const AIRLINE_PREFIX_MAP: Record<string, string> = {
  '001': 'AMERICAN AIRLINES',
  '006': 'DELTA AIR LINES',
  '014': 'AIR CANADA',
  '016': 'UNITED AIRLINES',
  '020': 'LUFTHANSA',
  '032': 'LUFTHANSA',
  '057': 'AIR FRANCE',
  '055': 'AIR FRANCE',
  '065': 'SAUDI ARABIAN AIRLINES',
  '071': 'ETHIOPIAN AIRLINES',
  '074': 'KLM ROYAL DUTCH AIRLINES',
  '075': 'IBERIA',
  '077': 'EGYPTAIR',
  '081': 'BRITISH AIRWAYS',
  '082': 'BRUSSELS AIRLINES',
  '083': 'BRITISH AIRWAYS',
  '098': 'AIR INDIA',
  '115': 'EMIRATES',
  '124': 'AIR ALGERIE',
  '125': 'EMIRATES',
  '131': 'JAPAN AIRLINES',
  '147': 'ROYAL AIR MAROC',
  '157': 'QATAR AIRWAYS',
  '160': 'CATHAY PACIFIC',
  '172': 'ETHIOPIAN AIRLINES',
  '176': 'AIR ALGERIE',
  '199': 'TUNISAIR',
  '204': 'PEGASUS AIRLINES',
  '205': 'ALL NIPPON AIRWAYS',
  '217': 'QATAR AIRWAYS',
  '220': 'AIR ALGERIE',
  '232': 'AIR ALGERIE',
  '235': 'TURKISH AIRLINES',
  '236': 'ETIHAD AIRWAYS',
  '257': 'AUSTRIAN AIRLINES',
  '512': 'ROYAL JORDANIAN',
  '515': 'TASSILI AIRLINE',
  '607': 'ETIHAD AIRWAYS',
  '618': 'SINGAPORE AIRLINES',
  '624': 'PEGASUS AIRLINES',
  '706': 'KENYA AIRWAYS',
  '724': 'SWISS INTERNATIONAL AIR LINES',
  '784': 'CHINA SOUTHERN AIRLINES',
  '999': 'AIR CHINA',
};

function airlineFromTicket(ticketNumber: string): string {
  const prefix = ticketNumber.replace('-', '').substring(0, 3);
  return AIRLINE_PREFIX_MAP[prefix] ?? 'UNKNOWN';
}

/** City / airport name → IATA code */
const CITY_IATA_MAP: Record<string, string> = {
  // Algeria
  ALGIERS: 'ALG', ALGER: 'ALG', 'HOUARI BOUMEDIENE': 'ALG', ALG: 'ALG',
  ORAN: 'ORN', ORN: 'ORN', CONSTANTINE: 'CZL', 'MOHAMED BOUDIAF': 'CZL', CZL: 'CZL',
  ANNABA: 'AAE', AAE: 'AAE', TLEMCEN: 'TLM', TLM: 'TLM',
  SETIF: 'QSF', 'SÉTIF': 'QSF', '8 MAI 45': 'QSF', QSF: 'QSF',
  BEJAIA: 'BJA', BJA: 'BJA', CHLEF: 'CFK', CFK: 'CFK',
  TAMANRASSET: 'TMR', GHARDAIA: 'GHA', BISKRA: 'BSK', BATNA: 'BLJ',
  TEBESSA: 'TEE', 'IN AMENAS': 'IAM', 'IN SALAH': 'INZ', TINDOUF: 'TIN',
  'AHMED BEN BELLA': 'ORN',
  // France
  PARIS: 'CDG', 'CHARLES DE GAULLE': 'CDG', CDG: 'CDG',
  ORLY: 'ORY', ORY: 'ORY', 'PARIS ORLY': 'ORY',
  NANTES: 'NTE', ATLANTIQUE: 'NTE', NTE: 'NTE',
  LYON: 'LYS', LYS: 'LYS', NICE: 'NCE', NCE: 'NCE',
  MARSEILLE: 'MRS', MRS: 'MRS', 'PROVENCE MARSEILLE': 'MRS',
  TOULOUSE: 'TLS', TLS: 'TLS', BORDEAUX: 'BOD', BOD: 'BOD',
  MONTPELLIER: 'MPL', STRASBOURG: 'SXB', LILLE: 'LIL',
  RENNES: 'RNS', CLERMONT: 'CFE', GRENOBLE: 'GNB',
  // UK
  LONDON: 'LHR', HEATHROW: 'LHR', LHR: 'LHR',
  GATWICK: 'LGW', LGW: 'LGW', MANCHESTER: 'MAN', MAN: 'MAN',
  BIRMINGHAM: 'BHX', 'LONDON CITY': 'LCY',
  // Middle East
  DUBAI: 'DXB', DXB: 'DXB', 'ABU DHABI': 'AUH', AUH: 'AUH',
  DOHA: 'DOH', HAMAD: 'DOH', DOH: 'DOH',
  RIYADH: 'RUH', 'KING KHALID': 'RUH', RUH: 'RUH',
  JEDDAH: 'JED', 'KING ABDULAZIZ': 'JED', JED: 'JED',
  MEDINA: 'MED', 'PRINCE MOHAMMAD': 'MED', MED: 'MED',
  DAMMAM: 'DMM', DMM: 'DMM',
  KUWAIT: 'KWI', KWI: 'KWI', MUSCAT: 'MCT', MCT: 'MCT',
  BAHRAIN: 'BAH', BAH: 'BAH', SHARJAH: 'SHJ', SHJ: 'SHJ',
  // Turkey
  ISTANBUL: 'IST', IST: 'IST', 'ISTANBUL AIRPORT': 'IST',
  ANKARA: 'ESB', ESB: 'ESB', ANTALYA: 'AYT', AYT: 'AYT',
  'SABIHA GOKCEN': 'SAW', SAW: 'SAW',
  // Africa
  CASABLANCA: 'CMN', 'MOHAMMED V': 'CMN', CMN: 'CMN',
  MARRAKECH: 'RAK', RAK: 'RAK',
  TUNIS: 'TUN', TUN: 'TUN', MIR: 'MIR',
  CAIRO: 'CAI', 'CAIRO INTL': 'CAI', CAI: 'CAI',
  NAIROBI: 'NBO', NBO: 'NBO',
  'ADDIS ABABA': 'ADD', ADD: 'ADD',
  JOHANNESBURG: 'JNB', JNB: 'JNB',
  LUANDA: 'LAD', LAD: 'LAD',
  MAPUTO: 'MPM', MPM: 'MPM',
  DAKAR: 'DSS', BAMAKO: 'BKO',
  NAIROBI2: 'NBO', CAPETOWN: 'CPT', CPT: 'CPT',
  ACCRA: 'ACC', ACC: 'ACC', LAGOS: 'LOS', LOS: 'LOS',
  'ADDIS': 'ADD', DAR: 'DAR', HARARE: 'HRE',
  // Europe
  FRANKFURT: 'FRA', FRA: 'FRA', MUNICH: 'MUC', MUC: 'MUC',
  BERLIN: 'BER', BER: 'BER', HAMBURG: 'HAM', HAM: 'HAM',
  MADRID: 'MAD', MAD: 'MAD', BARCELONA: 'BCN', BCN: 'BCN',
  ROME: 'FCO', FIUMICINO: 'FCO', FCO: 'FCO',
  MILAN: 'MXP', MXP: 'MXP',
  AMSTERDAM: 'AMS', AMS: 'AMS', BRUSSELS: 'BRU', BRU: 'BRU',
  ZURICH: 'ZRH', ZRH: 'ZRH', VIENNA: 'VIE', VIE: 'VIE',
  LISBON: 'LIS', LIS: 'LIS', BAKU: 'GYD', GYD: 'GYD',
  COPENHAGEN: 'CPH', CPH: 'CPH', OSLO: 'OSL', OSL: 'OSL',
  STOCKHOLM: 'ARN', ARN: 'ARN', HELSINKI: 'HEL', HEL: 'HEL',
  WARSAW: 'WAW', WAW: 'WAW', PRAGUE: 'PRG', PRG: 'PRG',
  BUDAPEST: 'BUD', BUD: 'BUD', BUCHAREST: 'OTP', OTP: 'OTP',
  SOFIA: 'SOF', SOF: 'SOF', ATHENS: 'ATH', ATH: 'ATH',
  BEIRUT: 'BEY', BEY: 'BEY', AMMAN: 'AMM', AMM: 'AMM',
  'TEL AVIV': 'TLV', TLV: 'TLV',
  DUSSELDORF: 'DUS', DUS: 'DUS', STUTTGART: 'STR', STR: 'STR',
  COLOGNE: 'CGN', CGN: 'CGN', GENEVA: 'GVA', GVA: 'GVA',
  PORTO: 'OPO', OPO: 'OPO', DUBLIN: 'DUB', DUB: 'DUB',
  EDINBURGH: 'EDI', EDI: 'EDI', GLASGOW: 'GLA', GLA: 'GLA',
  // Americas
  'NEW YORK': 'JFK', JFK: 'JFK', 'JOHN F KENNEDY': 'JFK',
  LAGUARDIA: 'LGA', LGA: 'LGA', NEWARK: 'EWR', EWR: 'EWR',
  'LOS ANGELES': 'LAX', LAX: 'LAX', CHICAGO: 'ORD', 'O HARE': 'ORD', ORD: 'ORD',
  MIAMI: 'MIA', MIA: 'MIA', ATLANTA: 'ATL', ATL: 'ATL',
  MONTREAL: 'YUL', YUL: 'YUL', TORONTO: 'YYZ', YYZ: 'YYZ',
  'SAO PAULO': 'GRU', GRU: 'GRU', 'BUENOS AIRES': 'EZE', EZE: 'EZE',
  BOGOTA: 'BOG', BOG: 'BOG', LIMA: 'LIM', LIM: 'LIM', SANTIAGO: 'SCL', SCL: 'SCL',
  // Asia
  BEIJING: 'PEK', 'CAPITAL INTL': 'PEK', PEK: 'PEK', BJS: 'PEK',
  SHANGHAI: 'PVG', PUDONG: 'PVG', PVG: 'PVG',
  GUANGZHOU: 'CAN', BAIYUN: 'CAN', CAN: 'CAN',
  'HONG KONG': 'HKG', HKG: 'HKG',
  TOKYO: 'NRT', NARITA: 'NRT', NRT: 'NRT', HANEDA: 'HND', HND: 'HND',
  OSAKA: 'KIX', KIX: 'KIX',
  SINGAPORE: 'SIN', CHANGI: 'SIN', SIN: 'SIN',
  'KUALA LUMPUR': 'KUL', KLIA: 'KUL', KUL: 'KUL',
  BANGKOK: 'BKK', BKK: 'BKK',
  SEOUL: 'ICN', ICN: 'ICN',
  MUMBAI: 'BOM', DELHI: 'DEL', BOM: 'BOM', DEL: 'DEL',
  KARACHI: 'KHI', KHI: 'KHI', LAHORE: 'LHE', LHE: 'LHE',
  TASHKENT: 'TAS', TAS: 'TAS', ALMATY: 'ALA', ALA: 'ALA',
};

/** Known valid IATA airport codes (whitelist for itinerary extraction) */
const VALID_IATA = new Set([
  'ALG','ORN','CZL','AAE','TLM','QSF','BJA','CFK','TMR','GHA','BSK','BLJ','TEE','IAM','INZ','TIN','DJG',
  'CDG','ORY','NTE','LYS','NCE','MRS','TLS','BOD','MPL','SXB','LIL','RNS','CFE','GNB',
  'LHR','LGW','MAN','BHX','LCY','EDI','GLA','DUB',
  'DXB','AUH','DOH','RUH','JED','MED','DMM','KWI','MCT','BAH','SHJ',
  'IST','SAW','ESB','AYT','ADB',
  'CMN','RAK','TUN','MIR','CAI','NBO','ADD','JNB','LAD','MPM','CPT','ACC','LOS','DAR','HRE','DSS','BKO',
  'FRA','MUC','BER','HAM','MAD','BCN','AGP','FCO','MXP','AMS','BRU','ZRH','VIE','LIS','OPO',
  'GYD','CPH','OSL','ARN','HEL','WAW','PRG','BUD','OTP','SOF','ATH','BEY','AMM','TLV',
  'DUS','STR','CGN','GVA','DUB',
  'JFK','LGA','EWR','LAX','ORD','MIA','ATL','YUL','YYZ','GRU','EZE','BOG','LIM','SCL',
  'PEK','PVG','CAN','HKG','NRT','HND','KIX','SIN','KUL','BKK','ICN',
  'BOM','DEL','KHI','LHE','TAS','ALA',
  'SVO','DME','VKO',
]);

function cityToIata(name: string): string | null {
  const u = name.toUpperCase().trim();
  if (VALID_IATA.has(u)) return u;
  if (CITY_IATA_MAP[u]) return CITY_IATA_MAP[u];
  for (const [key, code] of Object.entries(CITY_IATA_MAP)) {
    if (u.includes(key)) return code;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06',
  JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12',
};
const FR_MONTH_MAP: Record<string, string> = {
  JANVIER:'01', FÉVRIER:'02', FEVRIER:'02', MARS:'03', AVRIL:'04',
  MAI:'05', JUIN:'06', JUILLET:'07', AOÛT:'08', AOUT:'08',
  SEPTEMBRE:'09', OCTOBRE:'10', NOVEMBRE:'11', DÉCEMBRE:'12', DECEMBRE:'12',
  // short
  FÉV:'02', FEV:'02', AVR:'04', JUI:'06', JUL:'07', AOÛ:'08', AOU:'08',
  SEP:'09', OCT:'10', NOV:'11', DÉC:'12', DEC:'12',
  JAN:'01', MAR:'03', MAI2:'05',
};

/** Parse "DDMONYYYY" → "YYYY-MM-DD" */
function parseDDMONYYYY(s: string): string | null {
  const m = s.match(/^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{4})$/i);
  if (!m) return null;
  const mo = MONTH_MAP[m[2].toUpperCase()];
  if (!mo) return null;
  return `${m[3]}-${mo}-${m[1]}`;
}

/** Parse "DDMON" (no year) → "YYYY-MM-DD" using provided fallback year */
function parseDDMON(s: string, fallbackYear: string): string | null {
  const m = s.match(/^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i);
  if (!m) return null;
  const mo = MONTH_MAP[m[2].toUpperCase()];
  if (!mo) return null;
  return `${fallbackYear}-${mo}-${m[1]}`;
}

/** Parse "DD MON YYYY" or "D Month YYYY" */
function parseDMONY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\s+([A-ZÀ-ÿa-z]+)\s+(\d{2,4})$/i);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const monKey = m[2].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mo = MONTH_MAP[monKey.substring(0,3)] ?? FR_MONTH_MAP[monKey] ?? null;
  if (!mo) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${mo}-${day}`;
}

/** Parse "DD Month YYYY" (full month name) */
function parseFullDate(s: string): string | null {
  const FULL: Record<string,string> = {
    JANUARY:'01', FEBRUARY:'02', MARCH:'03', APRIL:'04', MAY:'05', JUNE:'06',
    JULY:'07', AUGUST:'08', SEPTEMBER:'09', OCTOBER:'10', NOVEMBER:'11', DECEMBER:'12',
  };
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const mo = FULL[m[2].toUpperCase()] ?? MONTH_MAP[m[2].toUpperCase().substring(0,3)];
  if (!mo) return null;
  return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ITINERARY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Words that look like IATA codes but are not */
const NON_IATA_WORDS = new Set([
  'ETKT','DATE','ARR','DEP','NVB','BAG','AND','YOU','FOR','NON','PER','THE',
  'API','ARE','MAY','ITS','ANY','NOT','GDS','HOW','CAN','WAS','BUT','OFF',
  'ONE','TWO','ALL','GET','USE','SEE','TKT','FOP','END','ETI','ISS','AIR',
  'ETC','VIA','FOC','CL','MR','MRS','MS','REF','PNR','INF','CHD',
]);

function extractItineraryFromFlightTable(body: string): string[] {
  const codes: string[] = [];
  const lines = body.split('\n');
  let inTable = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.includes('FROM /TO') || line.includes('FROM/TO')) { inTable = true; continue; }
    if (inTable) {
      if (/AT CHECK-IN|ENDORSEMENTS|FARE CALCULATION/i.test(line)) break;
      const found = line.match(/\b([A-Z]{3})\b/g) ?? [];
      for (const code of found) {
        if (!NON_IATA_WORDS.has(code) && VALID_IATA.has(code) && !codes.includes(code)) {
          codes.push(code);
        }
      }
    }
  }
  return codes;
}

function extractItineraryFromFareCalc(body: string): string[] {
  const idx = body.indexOf('FARE CALCULATION');
  if (idx === -1) return [];
  const slice = body.substring(idx, idx + 200);
  const codes: string[] = [];
  const m = slice.match(/\b([A-Z]{3})\b/g) ?? [];
  for (const code of m) {
    if (VALID_IATA.has(code) && !NON_IATA_WORDS.has(code) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function extractItineraryFromAirportNames(body: string): string[] {
  const upper = body.toUpperCase();
  const codes: string[] = [];
  for (const [name, iata] of Object.entries(CITY_IATA_MAP)) {
    if (upper.includes(name) && !codes.includes(iata)) codes.push(iata);
  }
  return codes;
}

function buildItinerary(codes: string[]): string {
  return codes.join(' → ');
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export type EmailFormat =
  | 'CONFIRMATION'   // parse-gmail-info.php style: multi-passenger booking confirmation
  | 'ETICKET'        // parse-gmail2.php style: single-passenger e-ticket (EN + FR)
  | 'NOREPLY'        // parse-gmail-noreply.php style: ETKT template from doc.mail.amadeus.com
  | 'TELEX'          // parse-gmail-telex.php: "Your trip" + "Booking ref" but NO ticket number
  | 'SOLEIL'         // parse_solei.php: Soleil Voyages agency ETKT
  | 'UNKNOWN';

export function detectFormat(body: string): EmailFormat {
  // TELEX: has "Your trip" + "Booking ref" but NO 13-digit ticket
  const hasTripKeyword = /your trip|votre voyage/i.test(body);
  const hasBookingRef  = /booking\s+ref(?:erence)?\s*[:\s]|airline\s+booking\s+reference\s*[:\s]/i.test(body);
  const hasTicketNum   = /\b\d{3}[- ]\d{10}(?:[- ]\d{2,3})?\b/.test(body);

  if (hasTripKeyword && hasBookingRef && !hasTicketNum) return 'TELEX';

  // SOLEIL: contains "SOLEIL VOYAGES" or "Soleil Voyages - R.E.F"
  if (/soleil\s*voyages/i.test(body)) return 'SOLEIL';

  // CONFIRMATION: "Traveler Ticket number Issuing Airline" table header
  if (/traveler\s+ticket\s+number\s+issuing\s+airline/i.test(body)) return 'CONFIRMATION';

  // ETICKET (FR): French labels
  const frScore = [
    /passager/i, /numéro de billet/i, /date d['']émission/i,
    /référence du dossier/i, /compagnie émettrice/i, /billet electronique/i,
  ].filter(r => r.test(body)).length;
  if (frScore >= 2) return 'ETICKET';

  // ETICKET (EN): has ETKT + NAME: pattern
  if (/NAME:\s*[A-Z]+\/[A-Z]+/i.test(body) || /ETKT\s+\d{3}\s+\d{10}/i.test(body)) return 'ETICKET';

  // NOREPLY: similar to ETICKET but uses "TICKET NUMBER" label
  if (/TICKET\s*NUMBER\s*:?\s*(?:ETKT)?/i.test(body) && hasTicketNum) return 'NOREPLY';

  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTED RECORD (common shape for all formats)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedTicket {
  ticketNumber: string;
  passengerName: string;
  pnr: string;           // booking ref
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

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 1 — CONFIRMATION  (parse-gmail-info.php)
// ─────────────────────────────────────────────────────────────────────────────

function extractConfirmation(body: string): ExtractedTicket[] {
  const results: ExtractedTicket[] = [];

  // 1. Booking ref
  let pnr = '';
  const pnrM = body.match(/booking\s+ref\s+([A-Z0-9]{5,8})/i);
  if (pnrM) pnr = pnrM[1];

  // 2. Agency
  let agency = '';
  const agM = body.match(/Agency\s+(.+?)(?=\s*Telephone|\s*Fax|\s*IATA|\s*Agent|\s*Traveler)/si);
  if (agM) agency = agM[1].split('\n')[0].trim();

  // 3. Document issue date
  let issueDate: string | null = null;
  const issuM = body.match(/Document\s+Issue\s+Date\s+(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})/i);
  if (issuM) issueDate = parseDMONY(issuM[1].trim()) ?? parseFullDate(issuM[1].trim());

  // 4. Travel date
  let travelDate: string | null = null;
  const tvM1 = body.match(/Itinerary\s*[\r\n]+\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (tvM1) travelDate = parseFullDate(`${tvM1[1]} ${tvM1[2]} ${tvM1[3]}`);
  if (!travelDate) {
    const tvM2 = body.match(/Itinerary[\r\n]+.{0,30}?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/si);
    if (tvM2) travelDate = parseFullDate(tvM2[1].trim());
  }
  if (!travelDate) {
    const allDates = [...body.matchAll(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/g)];
    for (const dm of allDates) {
      const parsed = parseFullDate(dm[1].trim());
      if (parsed && parsed !== issueDate) { travelDate = parsed; break; }
    }
  }

  // 5. Itinerary
  const iataCodesFromNames: string[] = [];
  const airportPatterns: [RegExp, string][] = [
    [/ALGIERS|HOUARI BOUMEDIENE/i, 'ALG'],
    [/CONSTANTINE|MOHAMED BOUDIAF/i, 'CZL'],
    [/SETIF|8 MAI 45/i, 'QSF'],
    [/\bORAN\b|AHMED BEN BELLA/i, 'ORN'],
    [/TINDOUF/i, 'TIN'],
    [/PARIS CHARLES DE GAULLE|CHARLES DE GAULLE/i, 'CDG'],
    [/PARIS ORLY|\bORLY\b/i, 'ORY'],
    [/MARSEILLE|PROVENCE MARSEILLE/i, 'MRS'],
    [/\bNICE\b|COTE D AZUR/i, 'NCE'],
    [/\bLYON\b/i, 'LYS'],
    [/ISTANBUL AIRPORT|ISTANBUL INTL|\bISTANBUL\b/i, 'IST'],
    [/SABIHA GOKCEN/i, 'SAW'],
    [/\bANKARA\b/i, 'ESB'],
    [/\bANTALYA\b/i, 'AYT'],
    [/\bDOHA\b|HAMAD INTL/i, 'DOH'],
    [/\bJEDDAH\b|KING ABDULAZIZ/i, 'JED'],
    [/\bRIYADH\b|KING KHALID/i, 'RUH'],
    [/\bMEDINA\b|PRINCE MOHAMMAD/i, 'MED'],
    [/\bDAMMAM\b/i, 'DMM'],
    [/\bDUBAI\b/i, 'DXB'],
    [/ABU DHABI/i, 'AUH'],
    [/\bSHARJAH\b/i, 'SHJ'],
    [/FRANKFURT/i, 'FRA'],
    [/\bMUNICH\b/i, 'MUC'],
    [/\bBERLIN\b/i, 'BER'],
    [/LONDON HEATHROW|HEATHROW/i, 'LHR'],
    [/\bGATWICK\b/i, 'LGW'],
    [/LONDON CITY/i, 'LCY'],
    [/MANCHESTER/i, 'MAN'],
    [/NEW YORK|JOHN F KENNEDY/i, 'JFK'],
    [/\bLAGUARDIA\b/i, 'LGA'],
    [/\bNEWARK\b/i, 'EWR'],
    [/LOS ANGELES/i, 'LAX'],
    [/\bCHICAGO\b|O HARE/i, 'ORD'],
    [/\bMIAMI\b/i, 'MIA'],
    [/\bATLANTA\b/i, 'ATL'],
    [/\bBEIJING\b|CAPITAL INTL/i, 'PEK'],
    [/\bSHANGHAI\b|PUDONG/i, 'PVG'],
    [/GUANGZHOU|BAIYUN/i, 'CAN'],
    [/HONG KONG/i, 'HKG'],
    [/TOKYO HANEDA|\bHANEDA\b/i, 'HND'],
    [/\bNARITA\b/i, 'NRT'],
    [/\bOSAKA\b/i, 'KIX'],
    [/\bSINGAPORE\b|CHANGI/i, 'SIN'],
    [/KUALA LUMPUR|\bKLIA\b/i, 'KUL'],
    [/\bCAIRO\b/i, 'CAI'],
    [/CASABLANCA|MOHAMMED V/i, 'CMN'],
    [/MARRAKECH|MENARA/i, 'RAK'],
    [/\bNAIROBI\b/i, 'NBO'],
    [/JOHANNESBURG/i, 'JNB'],
  ];

  for (const [pat, code] of airportPatterns) {
    if (pat.test(body) && !iataCodesFromNames.includes(code)) iataCodesFromNames.push(code);
  }
  const itinerary = iataCodesFromNames.length >= 1 ? buildItinerary(iataCodesFromNames) : 'ALG';

  // 6. Travelers + tickets
  // Primary: parse the "Traveler / Ticket number / Issuing Airline" section
  const travelerSectionM = body.match(
    /Traveler\s+Ticket\s+number\s+Issuing\s+Airline\s*\n([\s\S]*?)(?=Itinerary|Receipt|Airline\s+Booking\s+Reference|$)/i
  );

  interface Traveler { name: string; ticketNumber: string }
  const travelers: Traveler[] = [];

  if (travelerSectionM) {
    const section = travelerSectionM[1];
    for (const line of section.split('\n')) {
      const l = line.trim();
      if (!l) continue;

      // "Mr Firstname Lastname 157-1234567890 Qatar Airways"  OR  "030-2403650280-34 Firstname Lastname"
      const m1 = l.match(/(?:Mr|Mrs|Ms|Miss)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(\d{3}-\d{10}(?:-\d{2,3})?)\s+(.+)/i);
      if (m1) {
        const parts = m1[1].trim().split(' ');
        const last = parts.pop()!;
        travelers.push({ name: `${last} ${parts.join(' ')}`.trim(), ticketNumber: m1[2] });
        continue;
      }
      // Any line with ticket pattern (all 3 formats)
      const m2 = l.match(/(\d{3}-\d{10}(?:-\d{2,3})?)/);
      if (m2) {
        const namePart = l.replace(/\d{3}-\d{10}(?:-\d{2,3})?.*/, '').trim();
        travelers.push({ name: namePart || 'Unknown Traveler', ticketNumber: m2[1] });
      }
    }
  }

  // Fallback: scan full body for ticket numbers
  if (travelers.length === 0) {
    const allTickets = [...body.matchAll(/\b(\d{3}-\d{10}(?:-\d{2,3})?)\b/g)];
    for (const tm of allTickets) {
      const t = tm[1];
      // look backwards for name
      const pos = body.indexOf(t);
      const before = body.substring(Math.max(0, pos - 150), pos);
      const nameM = before.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*$/);
      travelers.push({ name: nameM ? nameM[1] : 'Unknown Traveler', ticketNumber: t });
    }
  }

  // 7. Financial data per ticket
  const airFareMap: Record<string, number | null> = {};
  const totalMap: Record<string, number | null> = {};

  for (const { ticketNumber } of travelers) {
    const escaped = ticketNumber.replace(/-/g, '[- ]');
    const fareM = body.match(
      new RegExp(`Ticket\\s+number\\s*:\\s*${escaped}[\\s\\S]*?Air\\s+Fare\\s*:\\s*DZD\\s*([0-9,]+)`, 'i')
    );
    airFareMap[ticketNumber] = fareM ? Number(fareM[1].replace(/,/g, '')) : null;

    const totalM = body.match(
      new RegExp(`Ticket\\s+number\\s*:\\s*${escaped}[\\s\\S]*?Total\\s+Amount\\s*:\\s*DZD\\s*([0-9,]+)`, 'i')
    );
    totalMap[ticketNumber] = totalM ? Number(totalM[1].replace(/,/g, '')) : null;
  }

  // 8. Agency code detection (loaded at call site via prisma — passed as param)
  // Build records
  for (const { name, ticketNumber } of travelers) {
    results.push({
      ticketNumber,
      passengerName: name || 'Unknown Traveler',
      pnr,
      airline: airlineFromTicket(ticketNumber),
      itinerary,
      departureDate: travelDate ? new Date(travelDate) : null,
      arriveDate: null,
      airFare: airFareMap[ticketNumber] ?? null,
      ttc: totalMap[ticketNumber] ?? null,
      agency,
      detectedAgencyName: '',
      format: 'CONFIRMATION',
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 2 — ETICKET  (parse-gmail2.php — EN + FR)
// ─────────────────────────────────────────────────────────────────────────────

function detectFrench(body: string): boolean {
  const signals = [
    /passager/i, /numéro de billet/i, /date d['']émission/i,
    /départ/i, /arrivée/i, /référence du dossier/i,
    /compagnie émettrice/i, /billet electronique/i, /reçu de billet/i,
  ];
  return signals.filter(r => r.test(body)).length >= 2;
}

function extractEticket(body: string, format: EmailFormat = 'ETICKET'): ExtractedTicket[] {
  if (detectFrench(body)) return extractEticketFR(body, format);
  return extractEticketEN(body, format);
}

function extractEticketEN(body: string, format: EmailFormat): ExtractedTicket[] {
  const collapsed = body.replace(/\s+/g, ' ');
  const originalBody = body;

  // 1. Passenger name
  let passengerName = '';
  const nameM = collapsed.match(/NAME:\s*([A-Z]+)\/([A-Z]+(?:\s+[A-Z]+)*)(?:\s+(?:MR|MS|MRS|MISS))?/i);
  if (nameM) {
    passengerName = `${nameM[2].trim()} ${nameM[1].trim()}`;
  }

  // 2. Ticket number — ordered from most to least specific
  let ticketNumber = '';
  const KNOWN_PREFIXES = ['057','065','075','081','082','083','098','115','124','125','131',
    '147','157','160','172','176','199','204','205','217','220','232','235','236',
    '257','512','515','607','618','624','706','724','784','999','001','006','014','016','020','032','074','077'];

  const ticketPatterns: RegExp[] = [
    /TICKET\s*(?:NUMBER)?\s*:?\s*(?:ETKT\s+)?(\d{3})[ \t\-](\d{10})(?:[ \t\-]\d{2,3})?/i,
    /ETKT[ \t]+(\d{3})[ \t]+(\d{10})(?:[ \t]\d{2,3})?/i,
    /\b(\d{3})[ \t\-](\d{10})(?:[ \t\-]\d{2,3})?\b/,
    /\b(\d{3})(\d{10})\b/,
  ];
  for (const pat of ticketPatterns) {
    const m = collapsed.match(pat);
    if (m) { ticketNumber = `${m[1]}-${m[2]}`; break; }
  }
  if (!ticketNumber) {
    const fb = originalBody.match(/(\d{3})[\s-](\d{10})(?:[\s-](\d{2,3}))?/);
    if (fb && KNOWN_PREFIXES.includes(fb[1])) {
      ticketNumber = fb[3] ? `${fb[1]}-${fb[2]}-${fb[3]}` : `${fb[1]}-${fb[2]}`;
    }
  }

  // 3. Booking ref
  let pnr = '';
  const pnrM = collapsed.match(/BOOKING\s+REF.*?AMADEUS:\s*([A-Z0-9]{6})/i)
    ?? collapsed.match(/(?:BOOKING\s*REF(?:ERENCE)?|PNR|RECORD\s*LOCATOR)[:\s]+([A-Z0-9]{5,8})/i);
  if (pnrM) pnr = pnrM[1];

  // 4. Agency
  let agency = '';
  const agM = collapsed.match(/ELECTRONIC TICKET\s+([A-Z][A-Z\s]+VOYAGES)/i)
    ?? collapsed.match(/(?:AGENCY|AGENCE|ISSUING\s*AGENT|ISSUED\s*BY)[:\s]+([A-Z0-9\s&\-\.]+?)(?:\s+\d|\s+TEL|\s+IATA|\n|$)/i);
  if (agM) agency = agM[1].trim();

  // 5. Issue date "DATE: 11 MAY 2026"
  let issueDate: string | null = null;
  const issuM = collapsed.match(/DATE:\s*(\d{2})\s+([A-Z]{3})\s+(\d{4})/i);
  if (issuM) issueDate = parseDMONY(`${issuM[1]} ${issuM[2]} ${issuM[3]}`);

  const defaultYear = issueDate ? issueDate.substring(0, 4) : new Date().getFullYear().toString();

  // 6. Travel date
  let travelDate: string | null = null;
  const tvM = collapsed.match(/FROM\s*\/\s*TO.{0,200}?(\d{2}[A-Z]{3})/i);
  if (tvM) travelDate = parseDDMON(tvM[1], defaultYear);
  if (!travelDate) {
    const tvM2 = collapsed.match(/\b(\d{2}[A-Z]{3}\d{4})\b/i);
    if (tvM2) travelDate = parseDDMONYYYY(tvM2[1]);
  }

  // 7. Airline
  let airline = '';
  const alnM = collapsed.match(/AIRLINE\s*:\s*([A-Z][A-Z\s]+?)(?=\s+[A-Z]{2}\/|\s+TICKET|\s+BOOKING|$)/i)
    ?? collapsed.match(/ISSUING\s+AIRLINE\s*:\s*([A-Z][A-Z\s]+?)(?=\s+[A-Z]{2}\/|\s+TICKET|$)/i);
  if (alnM) airline = alnM[1].trim();
  if (!airline && ticketNumber) airline = airlineFromTicket(ticketNumber);

  // 8. Itinerary
  let codes = extractItineraryFromFlightTable(originalBody);
  if (codes.length < 2) codes = extractItineraryFromFareCalc(collapsed);
  codes = codes.filter(c => VALID_IATA.has(c));
  let itinerary = codes.length >= 2 ? buildItinerary(codes) : '';
  if (!itinerary && ticketNumber) {
    const defaults: Record<string, string> = {
      '157':'ALG → DOH','176':'ALG → DXB','147':'ALG → CMN',
      '057':'ALG → CDG','124':'ALG → DXB','235':'ALG → IST',
    };
    itinerary = defaults[ticketNumber.substring(0,3)] ?? 'ALG';
  }

  // 9. Financial
  let airFare: number | null = null;
  const fareM = collapsed.match(/AIR\s*FARE\s*:\s*DZD\s+([0-9,.]+)/i);
  if (fareM) airFare = Number(fareM[1].replace(/[^0-9]/g, ''));

  let ttc: number | null = null;
  const totalM = collapsed.match(/TOTAL\s*:\s*DZD\s+([0-9,.]+)/i);
  if (totalM) ttc = Number(totalM[1].replace(/[^0-9]/g, ''));

  if (!ticketNumber) return [];

  return [{
    ticketNumber,
    passengerName: passengerName || 'Unknown Traveler',
    pnr,
    airline,
    itinerary,
    departureDate: travelDate ? new Date(travelDate) : null,
    arriveDate: null,
    airFare,
    ttc,
    agency,
    detectedAgencyName: '',
    format,
  }];
}

function extractEticketFR(body: string, format: EmailFormat): ExtractedTicket[] {
  const collapsed = body.replace(/[ \t]+/g, ' ');

  // 1. Booking ref
  let pnr = '';
  const pnrM = collapsed.match(/Référence\s+du\s+dossier\s+([A-Z0-9]{5,8})/i)
    ?? collapsed.match(/Reference\s+du\s+dossier\s+([A-Z0-9]{5,8})/i);
  if (pnrM) pnr = pnrM[1];

  // 2. Issue date
  let issueDate: string | null = null;
  const issuM = collapsed.match(/Date\s+d['''](?:é|e)mission\s+([\d]{1,2}\s+[a-záàâéèêœùûîôç]+\s+\d{2,4})/iu);
  if (issuM) issueDate = parseDMONY(issuM[1]);
  const defaultYear = issueDate ? issueDate.substring(0, 4) : new Date().getFullYear().toString();

  // 3. Passengers & tickets — three strategies
  interface FRPassenger { name: string; ticket: string; airline: string }
  const passengers: FRPassenger[] = [];

  // Strategy A: "Name 157-1234567890 Qatar Airways" on one line
  const patA = /([A-Z][a-záàâéèêùûîôœç\-]+(?:\s+[A-Z][a-záàâéèêùûîôœç\-]+){1,4})\s+(\d{3}-\d{10,13})\s+(Qatar Airways|Emirates|Air Algerie|Turkish Airlines|Royal Air Maroc|Air France|Lufthansa|British Airways|Etihad Airways)/giu;
  let m: RegExpExecArray | null;
  while ((m = patA.exec(collapsed)) !== null) {
    passengers.push({ name: m[1].trim(), ticket: m[2], airline: m[3].toUpperCase() });
  }

  // Strategy B: find all ticket numbers, look back for names
  if (passengers.length === 0) {
    const HEADER_WORDS = ['Passager','Numéro','Billet','Compagnie','Agence','Agent','Téléphone',
      'Iata','Reference','Date','Départ','Arrivée','Durée','Classe','Statut','Equipement'];
    const ticketRe = /\b(\d{3}-\d{10,13})\b/g;
    while ((m = ticketRe.exec(collapsed)) !== null) {
      const tk = m[1];
      const before = collapsed.substring(Math.max(0, m.index - 400), m.index);
      // Match candidate names (2–5 capitalized words)
      const candidateRe = /([A-Z][a-záàâéèêùûîôœç\-]+(?:\s+[A-Z][a-záàâéèêùûîôœç\-]+){1,4})/gu;
      const candidates: string[] = [];
      let cm: RegExpExecArray | null;
      while ((cm = candidateRe.exec(before)) !== null) candidates.push(cm[1]);
      // Walk backwards; pick the last non-header name
      let paxName = '';
      for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        const isHeader = HEADER_WORDS.some(h => c.toLowerCase().includes(h.toLowerCase()));
        if (!isHeader && c.length > 4) { paxName = c; break; }
      }
      passengers.push({ name: paxName, ticket: tk, airline: airlineFromTicket(tk) });
    }
  }

  // Strategy C: "Passager" label fallback
  if (passengers.length === 0) {
    const fnM = collapsed.match(/Passager\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/iu);
    const tkM = collapsed.match(/\b(\d{3}-\d{10,13})\b/);
    if (tkM) passengers.push({
      name: fnM ? fnM[1].trim() : 'Unknown Traveler',
      ticket: tkM[1],
      airline: airlineFromTicket(tkM[1]),
    });
  }

  if (passengers.length === 0) return [];

  // 4. Agency
  let agency = '';
  const agM = collapsed.match(/Agence\s+([A-ZÉÀÈÙÂÊÎÔÛŒÇ\s\-]+?)(?=\s{2,}|Agent|Téléphone|\n)/u);
  if (agM) agency = agM[1].replace(/\s+/g, ' ').trim();

  // 5. Travel date
  let travelDate: string | null = null;
  // "Départ ... 13 May 2026" or "Départ ... 13 mai 2026"
  const tvM = collapsed.match(/D(?:é|e)part\s+\d+\s+\w+\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|jan|fév|mar|avr|mai|juin|jul|aoû|sep|oct|nov|déc)[a-z]*\s+\d{2,4})/i);
  if (tvM) travelDate = parseDMONY(tvM[1].trim());
  if (!travelDate) {
    const tvM2 = collapsed.match(/D(?:é|e)part\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*)/i);
    if (tvM2) travelDate = parseDMONY(`${tvM2[1]} ${defaultYear}`);
  }

  // 6. Itinerary from airport names / IATA
  let itinCodes: string[] = [];
  const depM = collapsed.match(/D(?:é|e)part.*?(?:\d{2}:\d{2})\s+([A-ZÉÀÈŒ\s]+?)(?=\s{2,}|Terminal|\n|Arriv)/iu);
  if (depM) { const c = cityToIata(depM[1].trim()); if (c) itinCodes.push(c); }
  const arrM = collapsed.match(/Arriv(?:é|e)e.*?(?:\d{2}:\d{2})\s+([A-ZÉÀÈŒ\s]+?)(?=\s{2,}|Terminal|\n|D(?:é|e)part|Dur)/iu);
  if (arrM) { const c = cityToIata(arrM[1].trim()); if (c && !itinCodes.includes(c)) itinCodes.push(c); }
  if (itinCodes.length < 2) {
    const bodyUpper = collapsed.toUpperCase();
    for (const [name, iata] of Object.entries(CITY_IATA_MAP)) {
      if (bodyUpper.includes(name) && !itinCodes.includes(iata)) itinCodes.push(iata);
    }
  }
  itinCodes = itinCodes.filter(c => VALID_IATA.has(c));
  let itinerary = itinCodes.length >= 2 ? buildItinerary(itinCodes) : (itinCodes[0] ?? '');

  // 7. Amounts
  let airFare: number | null = null;
  const fareM = collapsed.match(/Tarif(?:\s+air\w*)?\s*:?\s*(?:DZD\s*)?([\d\s,.]+)/i);
  if (fareM) airFare = Number(fareM[1].replace(/[^0-9]/g, '')) || null;

  let ttc: number | null = null;
  const totalM = collapsed.match(/Total\s*:?\s*(?:DZD\s*)?([\d\s,.]+)/i);
  if (totalM) ttc = Number(totalM[1].replace(/[^0-9]/g, '')) || null;

  return passengers.map(p => ({
    ticketNumber: p.ticket,
    passengerName: p.name || 'Unknown Traveler',
    pnr,
    airline: p.airline || airlineFromTicket(p.ticket),
    itinerary: itinerary || (() => {
      const pfx = p.ticket.substring(0, 3);
      const d: Record<string,string> = { '157':'ALG → DOH','176':'ALG → DXB','147':'ALG → CMN','057':'ALG → CDG','124':'ALG → DXB','235':'ALG → IST' };
      return d[pfx] ?? 'ALG';
    })(),
    departureDate: travelDate ? new Date(travelDate) : null,
    arriveDate: null,
    airFare,
    ttc,
    agency,
    detectedAgencyName: '',
    format,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 3 — NOREPLY  (parse-gmail-noreply.php)
// Shares the same ETKT template as FORMAT_ETICKET; main difference is it may
// carry a "LASTNAME/FIRSTNAME DDMONYYYY ALG DOH" subject line pattern.
// ─────────────────────────────────────────────────────────────────────────────

function extractNoreply(body: string): ExtractedTicket[] {
  const collapsed = body.replace(/\s+/g, ' ');

  // Attempt subject/body pattern: "LASTNAME/FIRSTNAME DDMONYYYY AAA BBB"
  const subjectM = collapsed.match(/([A-Z]{2,})\/([A-Z]{2,}(?:\s+[A-Z]+)*)\s+(\d{2}[A-Z]{3}\d{4})\s+((?:[A-Z]{3}\s*)+)/i);
  let subjectCodes: string[] = [];
  let subjectDate: string | null = null;
  let subjectName = '';

  if (subjectM) {
    subjectName = `${subjectM[2].trim()} ${subjectM[1].trim()}`;
    subjectDate = parseDDMONYYYY(subjectM[3]);
    const rawCodes = subjectM[4].trim().split(/\s+/);
    subjectCodes = rawCodes.filter(c => c.length === 3 && VALID_IATA.has(c));
  }

  // Delegate to EN extractor (same patterns)
  const results = extractEticketEN(body, 'NOREPLY');

  // Enrich with subject-extracted data where the EN extractor came up empty
  for (const r of results) {
    if (!r.passengerName || r.passengerName === 'Unknown Traveler') {
      if (subjectName) r.passengerName = subjectName;
    }
    if (!r.departureDate && subjectDate) r.departureDate = new Date(subjectDate);
    if ((!r.itinerary || r.itinerary === 'ALG') && subjectCodes.length >= 2) {
      r.itinerary = buildItinerary(subjectCodes);
    }
    r.format = 'NOREPLY';
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 4 — TELEX  (parse-gmail-telex.php)
// No 13-digit ticket. Output goes to the same ticket table with ticketNumber = "TELEX-<pnr>".
// ─────────────────────────────────────────────────────────────────────────────

function extractTelex(body: string): ExtractedTicket[] {
  const collapsed = body.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

  // 1. Booking ref
  let pnr = '';
  const pnrM = collapsed.match(/(?:Booking\s+ref(?:erence)?|Airline\s+Booking\s+Reference)\s*[:\s]\s*([A-Z0-9]{4,8})/i);
  if (pnrM) pnr = pnrM[1].toUpperCase();
  if (!pnr) return [];

  // 2. Traveler name — after "Traveler Agency Information"
  let passengerName = 'Unknown Traveler';
  const travM = collapsed.match(/Traveler\s+Agency\s+Information\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/u);
  if (travM) passengerName = travM[1].trim();

  // 3. Agency — right after the traveler name before address keywords
  let agency = '';
  if (passengerName !== 'Unknown Traveler') {
    const pos = collapsed.indexOf(passengerName);
    if (pos !== -1) {
      const after = collapsed.substring(pos + passengerName.length);
      const agM = after.match(/^\s*([A-Z][A-Z0-9\s&\-\.\']{3,70}?)\s+(?:CITE|RUE|BP\s|TEL:|FAX:|Tel:|Fax:|Your\s|Check)/i);
      if (agM) agency = agM[1].trim();
    }
  }

  // 4. Issue date "20APR2026"
  let issueDate: string | null = null;
  const issuM = collapsed.match(/Document\s+Issue\s+Date\s*[:\s]\s*(\d{2}[A-Z]{3}\d{4})/i);
  if (issuM) issueDate = parseDDMONYYYY(issuM[1]);
  if (!issueDate) {
    const issuM2 = collapsed.match(/\b(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\b/i);
    if (issuM2) issueDate = parseDDMONYYYY(issuM2[1]);
  }
  const defaultYear = issueDate ? issueDate.substring(0, 4) : new Date().getFullYear().toString();

  // 5. Travel date
  let travelDate: string | null = null;
  const tvM = collapsed.match(/(?:[A-Za-z]+day,?\s+)?(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i);
  if (tvM) travelDate = parseDMONY(`${tvM[1]} ${tvM[2]} ${tvM[3]}`);
  if (!travelDate) {
    const tvM2 = collapsed.match(/(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC),?\s*\d{2}:\d{2}/i);
    if (tvM2) travelDate = parseDDMON(`${tvM2[1]}${tvM2[2]}`, defaultYear);
  }

  // 6. Flight segments → itinerary
  // "AH 1563 05AUG, 12:30 Nantes, (Atlantique) Algiers, (Houari Boumediene) Terminal 4"
  const MONTHS_PAT = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';
  const segRe = new RegExp(
    `([A-Z]{2})\\s*(\\d{1,4})\\s+\\d{2}(?:${MONTHS_PAT}),?\\s*\\d{2}:\\d{2}\\s+`+
    `([A-Za-z\\xC0-\\xFF][A-Za-z\\s,\\(\\)\\-\\xC0-\\xFF]{2,50}?)\\s+`+
    `([A-Za-z\\xC0-\\xFF][A-Za-z\\s,\\(\\)\\-\\xC0-\\xFF]{2,50}?)\\s*(?:Terminal|$)`,
    'giu'
  );

  const segments: Array<{ ac: string; fn: string; oc: string; dc: string }> = [];
  let sm: RegExpExecArray | null;
  while ((sm = segRe.exec(collapsed)) !== null) {
    const ac = sm[1].toUpperCase();
    const fn = `${ac} ${sm[2]}`;
    const orig = sm[3].trim().replace(/,?\s*\([^)]+\)/g, '');
    const dest = sm[4].trim().replace(/,?\s*\([^)]+\)/g, '');
    const oc = cityToIata(orig) ?? cityToIata(sm[3]) ?? orig.substring(0, 3).toUpperCase();
    const dc = cityToIata(dest) ?? cityToIata(sm[4]) ?? dest.substring(0, 3).toUpperCase();
    segments.push({ ac, fn, oc, dc });
  }

  let itinerary = '';
  let airline = '';
  if (segments.length > 0) {
    itinerary = buildItinerary(segments.map(s => s.oc).concat([segments[segments.length - 1].dc]));
    airline = segments[0].ac;
    // Try to get full airline name from two-letter IATA code
    const twoLetterMap: Record<string,string> = {
      AH:'AIR ALGERIE', AF:'AIR FRANCE', QR:'QATAR AIRWAYS', EK:'EMIRATES',
      AT:'ROYAL AIR MAROC', TK:'TURKISH AIRLINES', SV:'SAUDI ARABIAN AIRLINES',
      LH:'LUFTHANSA', BA:'BRITISH AIRWAYS', EY:'ETIHAD AIRWAYS', ET:'ETHIOPIAN AIRLINES',
      CA:'AIR CHINA', AA:'AMERICAN AIRLINES', MS:'EGYPTAIR', RJ:'ROYAL JORDANIAN',
    };
    airline = twoLetterMap[airline] ?? airline;
  }

  // Fallback: scan body for airline keywords
  if (!airline) {
    const keywords = ['Air Algerie','Air France','Qatar Airways','Emirates','Royal Air Maroc',
      'Turkish Airlines','Lufthansa','British Airways','Etihad Airways','Ethiopian Airlines',
      'EgyptAir','Kenya Airways','RwandAir','Swiss','TAP Air Portugal','Air Europa'];
    for (const kw of keywords) {
      if (new RegExp(kw, 'i').test(body)) { airline = kw.toUpperCase(); break; }
    }
  }

  return [{
    ticketNumber: `TELEX-${pnr}`,
    passengerName,
    pnr,
    airline,
    itinerary,
    departureDate: travelDate ? new Date(travelDate) : null,
    arriveDate: null,
    airFare: null,
    ttc: null,
    agency,
    detectedAgencyName: '',
    format: 'TELEX',
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 5 — SOLEIL  (parse_solei.php)
// Same ETKT template. Agency is always "SOLEIL VOYAGES".
// ─────────────────────────────────────────────────────────────────────────────

function extractSoleil(body: string): ExtractedTicket[] {
  // Reuse the EN eticket extractor
  const results = extractEticketEN(body, 'SOLEIL');
  for (const r of results) {
    r.agency = 'SOLEIL VOYAGES';
    r.detectedAgencyName = 'SOLEIL VOYAGES';
    r.format = 'SOLEIL';
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENCY CODE DETECTION (DB-driven, same as all PHP parsers)
// ─────────────────────────────────────────────────────────────────────────────

async function detectAgency(
  body: string,
  db: PrismaClient = prisma
): Promise<{ agencyCode: string; agencyName: string } | null> {
  try {
    // Match agency by name appearing in the email body
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
// PUBLIC API — DETECT + EXTRACT + UPSERT
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportResult {
  format: EmailFormat;
  total: number;
  inserted: number;
  skipped: number;
  errors: string[];
  extractionLog: string[];   // step-by-step trace of what was extracted and why
}

/**
 * Parse a raw email body, detect its format, extract ticket records, and
 * upsert them into the Prisma `ticket` table linked to the given agency.
 *
 * @param rawBody     Decoded plain-text email body (HTML stripped before passing in)
 * @param agencyId    The Prisma agency ID for the receiving mailbox
 * @param emailDate   Date the email was received (ISO string or Date)
 */
export async function importFromEmailBody(
  rawBody: string,
  agencyId: number,
  emailDate?: string | Date,
  db: PrismaClient = prisma
): Promise<ImportResult> {
  const result: ImportResult = {
    format: 'UNKNOWN',
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

  // 1. Format detection
  const format = detectFormat(rawBody);
  result.format = format;
  log(`Detected format: ${format}`);

  // 2. Extraction
  let records: ExtractedTicket[] = [];
  try {
    switch (format) {
      case 'CONFIRMATION': records = extractConfirmation(rawBody); break;
      case 'ETICKET':      records = extractEticket(rawBody);      break;
      case 'NOREPLY':      records = extractNoreply(rawBody);      break;
      case 'TELEX':        records = extractTelex(rawBody);        break;
      case 'SOLEIL':       records = extractSoleil(rawBody);       break;
      default: {
  log('UNKNOWN format — trying Groq AI extractor...');
  const { extractWithGroq } = await import('./ai-extractor');
  records = await extractWithGroq(rawBody, log);
  if (records.length > 0) {
    result.format = 'UNKNOWN';
    log(`AI extracted ${records.length} record(s) successfully`);
  } else {
    result.errors.push('Unrecognized format — AI extraction found no tickets');
    log('WARN: AI extractor returned 0 records');
  }
  break;
}
    }
  } catch (err: any) {
    const msg = `Extraction error: ${err?.message ?? String(err)}`;
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
    log('WARN: No records extracted — check format detection and body content');
    return result;
  }

  // 3. Agency code detection (DB-driven)
  const detectedAgency = await detectAgency(rawBody, db);
  if (detectedAgency) log(`Detected agency in body: "${detectedAgency.agencyName}"`);

  // 4. Upsert into DB
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
 * Convenience: extract records WITHOUT writing to DB.
 * Useful for preview / dry-run mode on the frontend.
 */
export async function previewEmailImport(
  rawBody: string
): Promise<{ format: EmailFormat; records: ExtractedTicket[] }> {
  const format = detectFormat(rawBody);
  let records: ExtractedTicket[] = [];

  switch (format) {
    case 'CONFIRMATION': records = extractConfirmation(rawBody); break;
    case 'ETICKET':      records = extractEticket(rawBody);      break;
    case 'NOREPLY':      records = extractNoreply(rawBody);      break;
    case 'TELEX':        records = extractTelex(rawBody);        break;
    case 'SOLEIL':       records = extractSoleil(rawBody);       break;
  }

  return { format, records };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — listTickets, getTicket, createTicket, updateTicket, deleteTicket, exportTicketsCsv
// These are consumed by tickets.controller.ts via `import * as svc`
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CreateTicketInput,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from './tickets.schema';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';

function isSuperAdmin(roleSlug?: string) {
  return roleSlug === 'super_admin' || roleSlug === 'superadmin';
}

function agencyFilter(agencyId?: number | null, roleSlug?: string) {
  if (isSuperAdmin(roleSlug)) return {};
  return agencyId ? { agencyId } : { agencyId: -1 }; // no results if no agency
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
  if (query.search)  where.OR = [
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
