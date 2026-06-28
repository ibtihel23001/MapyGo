import type { ExtractedTicket, EmailFormat } from './tickets.service';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const OLLAMA_URL   = process.env.OLLAMA_URL ?? '';

// Current active Groq models (updated June 2026)
// llama-3.3-70b, llama-3.1-8b, mistral-saba-24b, qwen-qwq-32b are all DEPRECATED
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',     // still active, just rate-limited
  'llama-3.1-8b-instant',        // still active, just rate-limited
  'openai/gpt-oss-20b',          // new replacement, separate quota
  'openai/gpt-oss-120b',         // new replacement, separate quota
  'qwen/qwen3.6-27b',            // new replacement, separate quota
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

async function tryOllama(body: string, log: (msg: string) => void): Promise<string | null> {
  if (!OLLAMA_URL) return null;
  log('AI EXTRACTOR: Trying local Ollama (llama3.1:8b)...');
  try {
    const ollamaEndpoint = `${OLLAMA_URL}/v1/chat/completions`;
    const response = await fetch(ollamaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
        'User-Agent': 'MapyGoExtractor/1.0',
      },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: body.slice(0, 12000) },
        ],
      }),
    });
    if (!response.ok) { log(`AI EXTRACTOR: Ollama error ${response.status}`); return null; }
    const json = await response.json() as any;
    const text = json?.choices?.[0]?.message?.content ?? null;
    if (text) log('AI EXTRACTOR: Got response from Ollama');
    return text;
  } catch (err: any) {
    log(`AI EXTRACTOR: Ollama unreachable — ${err.message}`);
    return null;
  }
}

async function tryGroqModel(model: string, body: string, log: (msg: string) => void): Promise<string | null> {
  log(`AI EXTRACTOR: Trying model ${model}...`);
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: body.slice(0, 12000) },
        ],
      }),
    });
    if (response.status === 429) {
      const errText = await response.text();
      const retryMatch = errText.match(/try again in ([^\s.]+)/i);
      const retryIn = retryMatch ? ` (retry in ${retryMatch[1]})` : '';
      log(`AI EXTRACTOR: ${model} rate-limited${retryIn} — trying next model...`);
      return null;
    }
    if (response.status === 400) {
      const errText = await response.text();
      if (errText.includes('decommissioned')) {
        log(`AI EXTRACTOR: ${model} is decommissioned — trying next model...`);
        return null;
      }
    }
    if (!response.ok) {
      log(`AI EXTRACTOR: ${model} error ${response.status} — ${await response.text()}`);
      return null;
    }
    const json = await response.json() as any;
    const text = json?.choices?.[0]?.message?.content ?? null;
    if (text) log(`AI EXTRACTOR: Got response from ${model}`);
    return text;
  } catch (err: any) {
    log(`AI EXTRACTOR: Network error on ${model} — ${err.message}`);
    return null;
  }
}

export async function extractWithGroq(body: string, log: (msg: string) => void): Promise<ExtractedTicket[]> {
  let raw: string | null = null;

  // 1. Try Ollama first (free, unlimited, your PC)
  raw = await tryOllama(body, log);

  // 2. Fall back to Groq models
  if (!raw) {
    if (!GROQ_API_KEY) {
      log('AI EXTRACTOR: GROQ_API_KEY not set and Ollama unavailable — cannot extract');
      return [];
    }
    for (const model of GROQ_MODELS) {
      raw = await tryGroqModel(model, body, log);
      if (raw) break;
    }
  }

  if (!raw) {
    log('AI EXTRACTOR: All providers exhausted — try again later.');
    return [];
  }

  log(`AI EXTRACTOR: Raw response → ${raw.slice(0, 200)}`);

  let parsed: any[];
  try {
    // Strip <think>...</think> blocks from reasoning models (e.g. qwen3.6)
    // Also handle unclosed <think> blocks by taking only text after last </think>
    let stripped = raw;
    if (stripped.includes('</think>')) {
      stripped = stripped.substring(stripped.lastIndexOf('</think>') + '</think>'.length);
    } else if (stripped.includes('<think>')) {
      // No closing tag - find the [ or { that starts the JSON
      const jsonStart = stripped.search(/[\[{]/);
      if (jsonStart !== -1) stripped = stripped.substring(jsonStart);
    }
    const clean = stripped.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    log('AI EXTRACTOR: Failed to parse JSON response');
    return [];
  }

  log(`AI EXTRACTOR: Extracted ${parsed.length} record(s)`);

  return parsed.map((r: any): ExtractedTicket => ({
    ticketNumber:       String(r.ticketNumber  ?? ''),
    passengerName:      String(r.passengerName ?? ''),
    pnr:                String(r.pnr           ?? ''),
    airline:            String(r.airline       ?? ''),
    itinerary:          String(r.itinerary     ?? ''),
    departureDate:      r.departureDate ? new Date(r.departureDate) : null,
    arriveDate:         r.arriveDate    ? new Date(r.arriveDate)    : null,
    airFare:            typeof r.airFare === 'number' ? r.airFare : null,
    ttc:                typeof r.ttc    === 'number'  ? r.ttc     : null,
    agency:             '',
    detectedAgencyName: '',
    format:             'UNKNOWN' as EmailFormat,
  }));
}
