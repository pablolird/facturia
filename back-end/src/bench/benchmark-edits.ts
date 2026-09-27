// Benchmarks AI edit mode: legacy full-template regeneration vs. the current
// find/replace patch approach. Makes real DeepSeek API calls (costs a few cents).
//
//   pnpm bench:edits            # needs DEEPSEEK_API_KEY in back-end/.env
//
// Writes bench-results/edits-<timestamp>.{json,md}.
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { crc32, deflateSync } from 'node:zlib';

import OpenAI from 'openai';

import { chat } from '../ai/ai.service.js';
import type { Preset } from '../presets/presets.types.js';
import { buildLegacySystemPrompt } from './legacy-prompt.js';

const MODEL = 'deepseek-chat';
const MAX_TOKENS = 8192; // DeepSeek V3's output ceiling; the legacy code used the 4K default
const CONCURRENCY = 4;
// Deterministic pattern logos: ~5 KB and ~9 KB of base64 — the size of a small,
// simple logo and far below the 1 MB upload limit presets allow
const LOGO_SIDE_PX = { 'with-logo': 90, 'large-logo': 160 } as const;

const EDIT_REQUESTS = [
  'Change the header background color to dark navy blue.',
  'Change the default Condición de Venta from Contado to Crédito.',
  'Make the company name in the header larger and bold.',
  'Rename the "Descripción" column header to "Detalle".',
  'Add a "Vendedor: ________" field below the customer information.',
  'Change the footer text to "Gracias por su preferencia".',
  'Make the line-item table borders thin and light grey.',
  'Change the accent color used for headings to dark green.',
  'Add a "Notas" box with an empty area at the bottom of the invoice.',
  'Change the font of the whole document to Georgia, serif.',
];

// ── Token accounting ────────────────────────────────────────────────────────────
// chat() builds its own OpenAI client, so capture usage by wrapping fetch and
// attributing each API response to the benchmark run that triggered it.

interface CallStats {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  finishReasons: string[];
}

const runContext = new AsyncLocalStorage<CallStats>();
const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const res = await realFetch(input, init);
  const stats = runContext.getStore();
  if (stats && res.ok) {
    const body = (await res.clone().json()) as {
      choices?: { finish_reason?: string }[];
      usage?: { completion_tokens?: number; prompt_tokens?: number };
    };
    stats.calls += 1;
    stats.promptTokens += body.usage?.prompt_tokens ?? 0;
    stats.completionTokens += body.usage?.completion_tokens ?? 0;
    stats.finishReasons.push(body.choices?.[0]?.finish_reason ?? 'unknown');
  }
  return res;
};

// ── Fixtures ────────────────────────────────────────────────────────────────────

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

// Seeded pattern PNG so every run embeds byte-identical logos (the LCG's low byte
// repeats, so the image compresses well; actual sizes are recorded in the results)
function makeLogoDataUri(side: number): string {
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed & 0xff;
  };
  const rows: Buffer[] = [];
  for (let y = 0; y < side; y++) {
    const row = Buffer.alloc(1 + side * 3);
    for (let i = 1; i < row.length; i++) row[i] = rand();
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

// 1×1 transparent PNG — stands in for "no real logo" while keeping the same markup
const TINY_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function makePreset(logoData: string | null): Preset {
  return {
    id: 'bench',
    user_id: 'bench',
    name: 'Empresa Demo',
    business_name: 'Empresa Demo S.A.',
    ruc: '80000000-0',
    timbrado: '12345678',
    address: 'Av. España 123',
    city: 'Asunción',
    phone: '+595 21 000000',
    email: 'demo@empresa.com.py',
    logo_data: logoData,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────────

// Lines added + removed between two documents (LCS-based line diff)
function changedLines(before: string, after: string): number {
  const a = before.split('\n');
  const b = after.split('\n');
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(up, prev[j - 1]!);
      diag = up;
    }
  }
  const lcs = prev[b.length]!;
  return a.length - lcs + (b.length - lcs);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function sum(xs: number[]): number {
  return xs.reduce((acc, x) => acc + x, 0);
}

// ── Runs ────────────────────────────────────────────────────────────────────────

type Approach = 'legacy-full-regeneration' | 'patch-find-replace';
type Scenario = 'no-logo' | 'with-logo' | 'large-logo';

interface RunResult {
  approach: Approach;
  scenario: Scenario;
  request: string;
  success: boolean;
  failure?: string;
  logoPreserved: boolean;
  latencyMs: number;
  apiCalls: number;
  promptTokens: number;
  completionTokens: number;
  finishReasons: string[];
  changedLines?: number;
}

async function legacyEdit(preset: Preset, template: string, request: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env['DEEPSEEK_API_KEY'], baseURL: 'https://api.deepseek.com' });
  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: buildLegacySystemPrompt(preset, template) },
      { role: 'user', content: request },
    ],
    response_format: { type: 'json_object' },
  });
  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') throw new Error('truncated at output limit');
  const parsed = JSON.parse(choice?.message.content ?? '{}') as { templateHtml?: unknown };
  if (typeof parsed.templateHtml !== 'string') throw new Error('no templateHtml in response');
  return parsed.templateHtml;
}

async function patchEdit(preset: Preset, template: string, request: string): Promise<string> {
  const res = await chat([{ role: 'user', content: request }], MODEL, preset, template);
  if (!res.templateHtml) throw new Error('no templateHtml in response');
  return res.templateHtml;
}

async function runOne(
  approach: Approach,
  scenario: Scenario,
  preset: Preset,
  template: string,
  logo: string,
  request: string,
): Promise<RunResult> {
  const stats: CallStats = { calls: 0, promptTokens: 0, completionTokens: 0, finishReasons: [] };
  const start = performance.now();
  let html: string | undefined;
  let failure: string | undefined;
  try {
    html = await runContext.run(stats, () =>
      approach === 'legacy-full-regeneration'
        ? legacyEdit(preset, template, request)
        : patchEdit(preset, template, request),
    );
  } catch (err) {
    failure = err instanceof Error ? err.message.slice(0, 120) : String(err);
  }
  const latencyMs = Math.round(performance.now() - start);

  const logoPreserved = html?.includes(logo) ?? false;
  if (html !== undefined && !logoPreserved) failure = 'logo data lost or corrupted';
  if (html !== undefined && html === template) failure = 'template unchanged';

  const result: RunResult = {
    approach,
    scenario,
    request,
    success: failure === undefined,
    logoPreserved,
    latencyMs,
    apiCalls: stats.calls,
    promptTokens: stats.promptTokens,
    completionTokens: stats.completionTokens,
    finishReasons: stats.finishReasons,
  };
  if (failure !== undefined) result.failure = failure;
  if (html !== undefined) result.changedLines = changedLines(template, html);
  const tag = result.success ? 'ok  ' : 'FAIL';
  console.log(
    `${tag} ${approach.padEnd(24)} ${scenario.padEnd(10)} ${String(result.completionTokens).padStart(5)} out-tok ${String(latencyMs).padStart(6)} ms  ${request}${failure ? `  (${failure})` : ''}`,
  );
  return result;
}

async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]!();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function summarize(results: RunResult[]): string {
  const lines = [
    '| Approach | Scenario | Success | Median output tokens | Total output tokens | Median latency (s) | Median changed lines |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const scenario of ['no-logo', 'with-logo', 'large-logo'] as const) {
    for (const approach of ['legacy-full-regeneration', 'patch-find-replace'] as const) {
      const rs = results.filter((r) => r.approach === approach && r.scenario === scenario);
      const ok = rs.filter((r) => r.success);
      const lat = median(rs.map((r) => r.latencyMs));
      lines.push(
        `| ${approach} | ${scenario} | ${ok.length}/${rs.length} | ${median(rs.map((r) => r.completionTokens))} | ${sum(rs.map((r) => r.completionTokens))} | ${lat === null ? '–' : (lat / 1000).toFixed(1)} | ${median(ok.map((r) => r.changedLines ?? 0)) ?? '–'} |`,
      );
    }
  }
  const retried = results.filter((r) => r.approach === 'patch-find-replace' && r.apiCalls > 1).length;
  lines.push('', `Patch runs that needed the automatic retry: ${retried}`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  if (!process.env['DEEPSEEK_API_KEY']) throw new Error('DEEPSEEK_API_KEY is not set');

  console.log('Generating base template…');
  // logo_data = 'LOGO_PLACEHOLDER' keeps the placeholder in the output so each scenario can substitute its own logo
  const base = await chat(
    [{ role: 'user', content: 'Create a professional invoice template for a consulting company, with the logo in the header.' }],
    MODEL,
    makePreset('LOGO_PLACEHOLDER'),
  );
  if (!base.templateHtml?.includes('LOGO_PLACEHOLDER')) throw new Error('base template has no logo placeholder');

  const scenarios: { name: Scenario; logo: string }[] = [
    { name: 'no-logo', logo: TINY_LOGO },
    { name: 'with-logo', logo: makeLogoDataUri(LOGO_SIDE_PX['with-logo']) },
    { name: 'large-logo', logo: makeLogoDataUri(LOGO_SIDE_PX['large-logo']) },
  ];

  const tasks: (() => Promise<RunResult>)[] = [];
  for (const { name, logo } of scenarios) {
    const preset = makePreset(logo);
    const template = base.templateHtml.replace('LOGO_PLACEHOLDER', logo);
    for (const request of EDIT_REQUESTS) {
      for (const approach of ['legacy-full-regeneration', 'patch-find-replace'] as const) {
        tasks.push(() => runOne(approach, name, preset, template, logo, request));
      }
    }
  }
  const results = await pool(tasks, CONCURRENCY);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  mkdirSync('bench-results', { recursive: true });
  const meta = {
    date: new Date().toISOString(),
    model: MODEL,
    maxTokens: MAX_TOKENS,
    baseTemplateChars: base.templateHtml.length,
    logoBase64Chars: Object.fromEntries(scenarios.map((sc) => [sc.name, sc.logo.length])),
    editRequests: EDIT_REQUESTS.length,
  };
  writeFileSync(`bench-results/edits-${stamp}.json`, JSON.stringify({ meta, results }, null, 2));
  const table = summarize(results);
  writeFileSync(
    `bench-results/edits-${stamp}.md`,
    `# Edit-mode benchmark (${meta.date.slice(0, 10)})\n\nModel \`${MODEL}\`, max_tokens ${MAX_TOKENS}, ${EDIT_REQUESTS.length} edit requests per cell. ` +
      `Base template ${meta.baseTemplateChars} chars; embedded logo sizes (base64 chars): ${JSON.stringify(meta.logoBase64Chars)}.\n\n${table}\n`,
  );
  console.log(`\n${table}\n\nSaved bench-results/edits-${stamp}.{json,md}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
