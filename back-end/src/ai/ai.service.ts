import OpenAI from 'openai';

import type { Preset } from '../presets/presets.types.js';
import type { ChatMessage, ChatResponse } from './ai.types.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: requireEnv('DEEPSEEK_API_KEY'),
    baseURL: 'https://api.deepseek.com',
  });
}

function buildPresetBlock(preset: Preset | null): string {
  return preset
    ? `
The user has selected the following company preset — inject these values into the invoice template:
- Company name: ${preset.business_name ?? 'Not specified'}
- RUC: ${preset.ruc ?? 'Not specified'}
- Timbrado: ${preset.timbrado ?? 'Not specified'}
- Address: ${preset.address ?? 'Not specified'}
- City: ${preset.city ?? 'Not specified'}
- Phone: ${preset.phone ?? 'Not specified'}
- Email: ${preset.email ?? 'Not specified'}
- Logo: ${preset.logo_data ? 'A company logo is provided. In the invoice header include exactly: <img src="LOGO_PLACEHOLDER" alt="Company logo" style="max-height:60px;max-width:200px;object-fit:contain;">' : 'No logo provided; do not include an <img> for the logo.'}
`
    : 'No company preset selected; use placeholder values for company fields.';
}

const PARAGUAY_RULES = `
MANDATORY Paraguayan invoice requirements — always preserved regardless of what the user asks:

1. CONDICIÓN DE VENTA: The invoice must display "Contado" or "Crédito" as a labeled field in the header area. Default to "Contado" as a placeholder.

2. IVA BREAKDOWN: Paraguay has three tax rates. The line items table MUST have separate columns for each:
   - Exentas (tax-exempt amount)
   - Gravado 5% (amount subject to 5% IVA)
   - Gravado 10% (amount subject to 10% IVA)

   Below the line items, include a tax summary block with exactly these rows:
   - Total Exentas
   - Total Gravado 5%  →  IVA 5% (= Gravado 5% × 5%)
   - Total Gravado 10% →  IVA 10% (= Gravado 10% × 10%)
   - Total IVA
   - TOTAL GENERAL (= Exentas + Gravado 5% + Gravado 10% + Total IVA)

   Use realistic placeholder numbers. Each line item row should place its amount in only one of the three tax columns (the other two left blank or zero).`;

function buildGenerationPrompt(preset: Preset | null): string {
  return `You are an expert invoice template designer specializing in Paraguayan invoices (facturas).
When the user asks you to create an invoice template, respond with a JSON object:
{
  "message": "Brief acknowledgment of what you are doing (1 sentence max). Omit if just generating silently.",
  "templateHtml": "A complete, self-contained HTML invoice template with all CSS inlined or in a <style> tag. Must look professional and print-ready."
}

If the user asks a question or makes a purely conversational request (not asking to generate the template), respond with:
{
  "message": "Your answer here."
}

Rules:
- Always return valid JSON. Never wrap it in markdown code fences.
- The HTML must be fully self-contained: no external stylesheets or scripts.
- Design for A4 paper (210mm × 297mm) by default unless the user specifies otherwise.
- The template should look like an actual Paraguayan invoice with the proper structure.
${PARAGUAY_RULES}
${buildPresetBlock(preset)}`;
}

function buildEditPrompt(preset: Preset | null, currentTemplate: string): string {
  return `You are an expert invoice template designer specializing in Paraguayan invoices (facturas).

The user wants to modify an EXISTING invoice template. Do NOT reproduce the whole document — the template may embed a large base64 company logo, and re-emitting it would blow past your output limit. Instead, return a small set of surgical text edits that the backend will apply with exact string replacement.

Respond with a JSON object:
{
  "message": "Brief acknowledgment of what you are doing (1 sentence max). Omit if just applying silently.",
  "edits": [
    { "find": "<exact original text copied verbatim from the template below>", "replace": "<the replacement text>" }
  ]
}

If the user asks a question or makes a purely conversational request (not asking to change the template), respond with:
{
  "message": "Your answer here."
}
(omit "edits" entirely in that case)

CRITICAL RULES — violating any of these is an error:
- Each "find" string must appear character-for-character (including whitespace/indentation) in the template below, and must be unique enough to identify a single location.
- Keep each edit as small as possible — only the minimal surrounding text needed to make "find" unique. Never include the logo's base64 data in "find" or "replace".
- Do NOT reformat code, reorder properties, rename classes, restructure elements, or clean up whitespace outside of what was asked.
- Do NOT add or "improve" anything that was not explicitly requested.
- Always return valid JSON. Never wrap it in markdown code fences.
- Never remove or break the mandatory Paraguayan invoice fields (IVA breakdown, Condición de Venta, timbrado) — only touch what the user's request requires.
${buildPresetBlock(preset)}
CURRENT TEMPLATE (reference only — copy "find" text from here verbatim):
${currentTemplate}`;
}

// deepseek-reasoner (R1) does not support response_format — only use it for chat models
const SUPPORTS_JSON_FORMAT = new Set(['deepseek-chat']);

// R1 sometimes wraps its JSON in markdown code fences despite instructions
function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1]!.trim() : raw.trim();
}

interface TemplateEdit {
  find: string;
  replace: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Tolerates whitespace/indentation drift between what the model recalls and the
// stored template, without allowing it to match arbitrary unrelated content.
function locateFind(html: string, find: string): string | null {
  if (html.includes(find)) return find;

  const pattern = find
    .split(/(\s+)/)
    .map((part, i) => (i % 2 === 1 ? '\\s+' : escapeRegExp(part)))
    .join('');
  const matches = html.match(new RegExp(pattern, 'g'));
  return matches && matches.length === 1 ? matches[0]! : null;
}

function applyEdits(html: string, edits: unknown): string {
  if (!Array.isArray(edits)) return html;

  let result = html;
  for (const raw of edits) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { find, replace } = raw as Partial<TemplateEdit>;
    if (typeof find !== 'string' || typeof replace !== 'string') continue;

    const located = locateFind(result, find);
    if (located === null) {
      throw new Error(`AI edit did not match the template: "${find.slice(0, 80)}"`);
    }
    result = result.replace(located, replace);
  }
  return result;
}

async function callModel(
  client: OpenAI,
  model: string,
  conversationMessages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<Record<string, unknown>> {
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    messages: conversationMessages,
    ...(SUPPORTS_JSON_FORMAT.has(model) ? { response_format: { type: 'json_object' } } : {}),
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new Error("AI response was truncated: exceeded the model's output limit");
  }

  const raw = extractJson(choice?.message.content ?? '{}');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned malformed JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { message: raw };
  }

  return parsed as Record<string, unknown>;
}

const MAX_EDIT_ATTEMPTS = 2;

export async function chat(
  messages: ChatMessage[],
  model: string,
  preset: Preset | null,
  currentTemplate?: string,
): Promise<ChatResponse> {
  const client = getClient();
  const editMode = Boolean(currentTemplate);
  const systemPrompt = editMode
    ? buildEditPrompt(preset, currentTemplate!)
    : buildGenerationPrompt(preset);

  const conversationMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const attempts = editMode ? MAX_EDIT_ATTEMPTS : 1;
  let obj: Record<string, unknown> | null = null;
  let appliedHtml: string | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const candidate = await callModel(client, model, conversationMessages);

    if (!editMode || !('edits' in candidate) || !Array.isArray(candidate['edits']) || candidate['edits'].length === 0) {
      obj = candidate;
      break;
    }

    try {
      appliedHtml = applyEdits(currentTemplate!, candidate['edits']);
      obj = candidate;
      break;
    } catch (err) {
      if (attempt === attempts) throw err;
      conversationMessages.push(
        { role: 'assistant', content: JSON.stringify(candidate) },
        {
          role: 'user',
          content: `${(err as Error).message}. Look at the CURRENT TEMPLATE in the system prompt again and resend corrected JSON with the same schema — the "find" text must match it verbatim.`,
        },
      );
    }
  }

  const result: ChatResponse = {
    message: obj && typeof obj['message'] === 'string' ? obj['message'] : undefined,
    templateHtml: editMode ? appliedHtml : undefined,
  };

  if (!editMode && obj) {
    result.templateHtml = typeof obj['templateHtml'] === 'string' ? obj['templateHtml'] : undefined;
  }

  if (preset?.logo_data && result.templateHtml) {
    result.templateHtml = result.templateHtml.replace('LOGO_PLACEHOLDER', preset.logo_data);
  }

  return result;
}
