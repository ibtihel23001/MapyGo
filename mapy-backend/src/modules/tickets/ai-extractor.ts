import type { ExtractedTicket, EmailFormat } from './tickets.service';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

// Try models in order — each has its own separate TPD quota
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',        // best quality, try first
  'llama-3.1-8b-instant',           // separate quota, fast fallback
  'meta-llama/llama-4-scout-17b-16e-instruct', // large separate quota
  'mistral-saba-24b',               // another separate quota
  'qwen-qwq-32b',                   // another separate quota
];

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

async function tryModel(
  model: string,
  body: string,
  log: (msg: string) => void
): Promise<string | null> {
  log(`AI EXTRACTOR: Trying model ${model}...`);

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens:  2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          // Send up to 12000 chars — enough for large multi-passenger emails
          { role: 'user',   content: body.slice(0, 12000) },
        ],
      }),
    });
  } catch (err: any) {
    log(`AI EXTRACTOR: Network error on ${model} — ${err.message}`);
    return null;
  }

  if (response.status === 429) {
    const errText = await response.text();
    // Extract retry-after if present
    const retryMatch = errText.match(/try again in ([^\s.]+)/i);
    const retryIn = retryMatch ? ` (retry in ${retryMatch[1]})` : '';
    log(`AI EXTRACTOR: ${model} rate-limited${retryIn} — trying next model...`);
    return null; // signal to try next model
  }

  if (!response.ok) {
    log(`AI EXTRACTOR: ${model} error ${response.status} — ${await response.text()}`);
    return null;
  }

  const json = await response.json() as any;
  return json?.choices?.[0]?.message?.content ?? null;
}

export async function extractWithGroq(
  body: string,
  log: (msg: string) => void
): Promise<ExtractedTicket[]> {
  if (!GROQ_API_KEY) {
    log('AI EXTRACTOR: GROQ_API_KEY is not set — skipping AI extraction');
    return [];
  }

  let raw: string | null = null;

  // Try each model until one works
  for (const model of GROQ_MODELS) {
    raw = await tryModel(model, body, log);
    if (raw !== null) {
      log(`AI EXTRACTOR: Got response from ${model}`);
      break;
    }
  }

  if (raw === null) {
    log('AI EXTRACTOR: All Groq models are rate-limited. Daily quota exhausted — try again tomorrow or upgrade Groq plan.');
    return [];
  }

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
    ticketNumber:        String(r.ticketNumber   ?? ''),
    passengerName:       String(r.passengerName  ?? ''),
    pnr:                 String(r.pnr            ?? ''),
    airline:             String(r.airline        ?? ''),
    itinerary:           String(r.itinerary      ?? ''),
    departureDate:       r.departureDate ? new Date(r.departureDate) : null,
    arriveDate:          r.arriveDate    ? new Date(r.arriveDate)    : null,
    airFare:             typeof r.airFare === 'number' ? r.airFare   : null,
    ttc:                 typeof r.ttc    === 'number'  ? r.ttc       : null,
    agency:              '',
    detectedAgencyName:  '',
    format:              'UNKNOWN' as EmailFormat,
  }));
}
