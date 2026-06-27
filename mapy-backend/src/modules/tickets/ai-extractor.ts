import type { ExtractedTicket, EmailFormat } from './tickets.service';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are an airline e-ticket parser for a travel agency.
Extract ALL ticket records from the email body.
Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.
Each object must have exactly these fields:
{
  "ticketNumber": "13-digit IATA format e.g. 157-2200171021",
  "passengerName": "LASTNAME/FIRSTNAME format",
  "pnr": "6-char booking reference or empty string",
  "airline": "full airline name",
  "itinerary": "e.g. ALG-DOH or ALG-CDG-ALG",
  "departureDate": "YYYY-MM-DD or null",
  "arriveDate": "YYYY-MM-DD or null",
  "airFare": number or null,
  "ttc": number or null
}
If no tickets found return [].`;

export async function extractWithGroq(
  body: string,
  log: (msg: string) => void
): Promise<ExtractedTicket[]> {
  if (!GROQ_API_KEY) {
    log('AI EXTRACTOR: GROQ_API_KEY is not set — skipping AI fallback');
    return [];
  }

  log('AI EXTRACTOR: Sending email to Groq (llama-3.3-70b)...');

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        temperature: 0,
        max_tokens:  1000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: body.slice(0, 6000) },
        ],
      }),
    });
  } catch (err: any) {
    log(`AI EXTRACTOR: Network error — ${err.message}`);
    return [];
  }

  if (!response.ok) {
    log(`AI EXTRACTOR: Groq API error ${response.status} — ${await response.text()}`);
    return [];
  }

  const json = await response.json() as any;
  const raw: string = json?.choices?.[0]?.message?.content ?? '[]';

  log(`AI EXTRACTOR: Raw response → ${raw.slice(0, 200)}`);

  let parsed: any[];
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    log('AI EXTRACTOR: Failed to parse JSON response');
    return [];
  }

  log(`AI EXTRACTOR: Extracted ${parsed.length} record(s)`);

  return parsed.map((r: any): ExtractedTicket => ({
    ticketNumber:       String(r.ticketNumber    ?? ''),
    passengerName:      String(r.passengerName   ?? ''),
    pnr:               String(r.pnr              ?? ''),
    airline:           String(r.airline          ?? ''),
    itinerary:         String(r.itinerary        ?? ''),
    departureDate:     r.departureDate ? new Date(r.departureDate) : null,
    arriveDate:        r.arriveDate    ? new Date(r.arriveDate)    : null,
    airFare:           typeof r.airFare === 'number' ? r.airFare   : null,
    ttc:               typeof r.ttc     === 'number' ? r.ttc       : null,
    agency:            '',
    detectedAgencyName: '',
    format:            'UNKNOWN' as EmailFormat,
  }));
}
