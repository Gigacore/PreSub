export interface NamedEntity {
  label: string;
  value: string;
  score: number;
}

export interface NamedEntityExtractionResult {
  available: boolean;
  model?: string;
  items: NamedEntity[];
  error?: string;
  truncated?: boolean;
}

export interface NamedEntitySpan {
  label: string;
  text: string;
  start: number;
  end: number;
  score: number;
}

export interface TokenClassificationResult {
  available: boolean;
  spans: NamedEntitySpan[];
  error?: string;
}

export type NlpSetupEvent =
  | { status: 'start'; model: string }
  | { status: 'progress'; model: string; progress?: number }
  | { status: 'ready'; model: string }
  | { status: 'error'; model: string; error: string };

export const NLP_SETUP_EVENT = 'presub:nlp-setup';

function emitNlpSetupEvent(detail: NlpSetupEvent) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail }));
  } catch {
    // Ignore environments without CustomEvent support.
  }
}

const SENSITIVE_ENTITY_LABELS = new Set(['PER', 'ORG']);

export async function shouldFlagPersonValue(raw: unknown): Promise<boolean> {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  try {
    const result = await classifyNamedEntitySpans(trimmed);
    if (!result.available) return true; // Fallback: preserve legacy behaviour
    return result.spans.some((span) => SENSITIVE_ENTITY_LABELS.has(span.label));
  } catch {
    return true; // Fallback on unexpected errors
  }
}

const METADATA_ENTITY_KEYS = new Set([
  'title',
  'subject',
  'author',
  'creator',
  'producer',
  'company',
  'manager',
  'organization',
  'lastmodifiedby',
  'keywords',
  'description',
  'owner',
]);

function shouldIncludeMetadataKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized || normalized.startsWith('nlp')) return false;
  if (normalized.endsWith('found') || normalized.endsWith('detected')) return false;
  if (normalized.includes('acknowledgement') || normalized.includes('acknowledgment')) return false;
  if (normalized.includes('affiliation')) return false;
  if (normalized.includes('funding')) return false;
  return METADATA_ENTITY_KEYS.has(normalized) || normalized.endsWith('author') || normalized.endsWith('creator');
}

function collectMetadataStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    const flattened: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) flattened.push(trimmed);
      }
    }
    return flattened;
  }
  return [];
}

function buildMetadataText(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (!shouldIncludeMetadataKey(key)) continue;
    parts.push(...collectMetadataStrings(value));
  }
  return parts.join('\n').trim();
}

export const NAMED_ENTITY_MODEL_ID = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';
const MODEL_ID = NAMED_ENTITY_MODEL_ID;
const MAX_CHARS_PER_CHUNK = 800; // keep chunks manageable for the transformer context window
const MAX_CHUNKS = 32; // cap to avoid extremely large jobs from blocking the UI

let pipelinePromise: Promise<any> | null = null;
let pipelineError: Error | null = null;

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
}

async function getPipeline() {
  if (pipelineError) {
    throw pipelineError;
  }
  if (!pipelinePromise) {
    emitNlpSetupEvent({ status: 'start', model: MODEL_ID });
    pipelinePromise = import('@huggingface/transformers')
      .then(async (mod) => {
        const { pipeline, env } = mod as any;
        try {
          // Prefer remote hosted weights and enable caching in supported environments.
          if (env?.allowLocalModels !== undefined) env.allowLocalModels = false;
          if (env?.useBrowserCache !== undefined) env.useBrowserCache = true;
          // Disable multi-threaded WASM backend to avoid util.js warnings when SharedArrayBuffer isn't available.
          if (env?.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.proxy = false;
          }
        } catch {
          // Ignore optional env tweaks; not fatal if unavailable.
        }
        let readyEventSeen = false;
        const progressCallback = (info: any) => {
          if (!info || typeof info !== 'object') return;
          const status = String((info as any).status ?? '');
          if (status === 'progress') {
            const rawProgress = (info as any).progress;
            const progress = typeof rawProgress === 'number' ? rawProgress : undefined;
            emitNlpSetupEvent({ status: 'progress', model: MODEL_ID, progress });
          } else if (status === 'ready') {
            readyEventSeen = true;
            emitNlpSetupEvent({ status: 'ready', model: MODEL_ID });
          }
        };
        const instance = await pipeline('token-classification', MODEL_ID, {
          aggregationStrategy: 'simple',
          // Explicit dtype avoids runtime warning on WASM backends defaulting to q8.
          dtype: 'q8',
          progress_callback: progressCallback,
        });
        if (!readyEventSeen) {
          emitNlpSetupEvent({ status: 'ready', model: MODEL_ID });
        }
        return instance;
      })
      .catch((error) => {
        const message = toErrorMessage(error);
        emitNlpSetupEvent({ status: 'error', model: MODEL_ID, error: message });
        pipelineError = error instanceof Error ? error : new Error(message);
        pipelinePromise = null;
        throw pipelineError;
      });
  }
  return pipelinePromise;
}

function normalizeEntityLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^B-/, '').replace(/^I-/, '').toUpperCase();
}

function normalizeEntityValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/##/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(input: string): string[] {
  const sanitized = input.replace(/\s+/g, ' ').trim();
  if (!sanitized) return [];
  if (sanitized.length <= MAX_CHARS_PER_CHUNK) return [sanitized];

  const sentences = sanitized.split(/(?<=[.!?。！？])\s+/u);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const parts = sentence.length > MAX_CHARS_PER_CHUNK ? sentence.match(new RegExp(`.{1,${MAX_CHARS_PER_CHUNK}}`, 'g')) ?? [sentence] : [sentence];
    for (const part of parts) {
      const candidate = current ? `${current} ${part}`.trim() : part.trim();
      if (candidate.length > MAX_CHARS_PER_CHUNK && current) {
        chunks.push(current.trim());
        current = part.trim();
      } else if (candidate.length > MAX_CHARS_PER_CHUNK) {
        chunks.push(part.trim());
        current = '';
      } else {
        current = candidate;
      }
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

export async function extractNamedEntities(text: string): Promise<NamedEntityExtractionResult> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return {
      available: true,
      model: MODEL_ID,
      items: [],
    };
  }

  let pipelineInstance: any;
  try {
    pipelineInstance = await getPipeline();
  } catch (error) {
    return {
      available: false,
      items: [],
      error: toErrorMessage(error),
    };
  }

  try {
    const chunks = chunkText(trimmed);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    const truncated = chunks.length > limitedChunks.length;

    const items: NamedEntity[] = [];
    for (const chunk of limitedChunks) {
      const raw = await pipelineInstance(chunk);
      if (!Array.isArray(raw)) continue;
      for (const entry of raw) {
        const label = normalizeEntityLabel((entry as any).entity_group ?? (entry as any).entity);
        if (!label || label === 'O') continue;
        const value = normalizeEntityValue((entry as any).word ?? (entry as any).text ?? '');
        if (!value) continue;
        const scoreRaw = (entry as any).score ?? (entry as any).confidence ?? 0;
        const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw) || 0;
        items.push({ label, value, score });
      }
    }

    return {
      available: true,
      model: MODEL_ID,
      items,
      truncated,
    };
  } catch (error) {
    return {
      available: false,
      items: [],
      error: toErrorMessage(error),
    };
  }
}

export async function classifyNamedEntitySpans(text: string): Promise<TokenClassificationResult> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return {
      available: true,
      spans: [],
    };
  }

  let pipelineInstance: any;
  try {
    pipelineInstance = await getPipeline();
  } catch (error) {
    return {
      available: false,
      spans: [],
      error: toErrorMessage(error),
    };
  }

  try {
    const raw = await pipelineInstance(trimmed, {
      ignore_labels: [],
    });

    const spans: NamedEntitySpan[] = [];
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        const label = normalizeEntityLabel((entry as any).entity_group ?? (entry as any).entity);
        if (!label || label === 'O') continue;
        const startRaw = (entry as any).start;
        const endRaw = (entry as any).end;
        const start = typeof startRaw === 'number' ? startRaw : undefined;
        const end = typeof endRaw === 'number' ? endRaw : undefined;
        const fallbackText = normalizeEntityValue((entry as any).word ?? (entry as any).text ?? '');
        const textValue = start !== undefined && end !== undefined ? trimmed.slice(start, end) : fallbackText;
        if (!textValue) continue;
        const scoreRaw = (entry as any).score ?? (entry as any).confidence ?? 0;
        const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw) || 0;

        spans.push({
          label,
          text: textValue,
          start: start !== undefined ? start : Math.max(0, trimmed.indexOf(textValue)),
          end: end !== undefined ? end : Math.max(0, trimmed.indexOf(textValue) + textValue.length),
          score,
        });
      }
    }

    spans.sort((a, b) => a.start - b.start);

    const merged: NamedEntitySpan[] = [];
    const isJoinableGap = (gap: string) => {
      if (!gap) return true;
      return /^[\s.'’\-·]+$/u.test(gap);
    };

    for (const span of spans) {
      const prev = merged[merged.length - 1];
      if (prev && prev.label === span.label) {
        const gap = trimmed.slice(prev.end, span.start);
        const overlaps = span.start <= prev.end;
        if (overlaps || isJoinableGap(gap)) {
          const newEnd = Math.max(prev.end, span.end);
          merged[merged.length - 1] = {
            ...prev,
            end: newEnd,
            text: trimmed.slice(prev.start, newEnd),
            score: Math.max(prev.score, span.score),
          };
          continue;
        }
      }
      merged.push(span);
    }

    return {
      available: true,
      spans: merged,
    };
  } catch (error) {
    return {
      available: false,
      spans: [],
      error: toErrorMessage(error),
    };
  }
}

export type EntityAccumulatorEntry = {
  label: string;
  value: string;
  occurrences: number;
  totalScore: number;
  positions?: Set<number>;
};

export function addEntitiesToAccumulator(
  acc: Map<string, EntityAccumulatorEntry>,
  entities: NamedEntity[],
  position?: number
) {
  for (const entity of entities) {
    const key = `${entity.label}::${entity.value.toLowerCase()}`;
    if (!acc.has(key)) {
      acc.set(key, {
        label: entity.label,
        value: entity.value,
        occurrences: 0,
        totalScore: 0,
        positions: position !== undefined ? new Set<number>() : undefined,
      });
    }
    const entry = acc.get(key)!;
    entry.occurrences += 1;
    entry.totalScore += Number.isFinite(entity.score) ? entity.score : 0;
    if (position !== undefined) {
      if (!entry.positions) entry.positions = new Set<number>();
      entry.positions.add(position);
    }
  }
}

export async function annotateMetadataWithNamedEntities(metadata: Record<string, unknown>) {
  const metadataText = buildMetadataText(metadata);
  if (!metadataText) return;

  try {
    const nerResult = await extractNamedEntities(metadataText);
    if (nerResult.available) {
      (metadata as any).nlpAnalysis = 'Metadata-only entity detection';
      (metadata as any).nlpModel = nerResult.model ?? NAMED_ENTITY_MODEL_ID;
      if (nerResult.truncated) {
        (metadata as any).nlpAnalysisNote = 'Named entity detection truncated to reduce processing time.';
      }

      const seen = new Set<string>();
      const summary: string[] = [];
      for (const item of nerResult.items) {
        const key = `${item.label}::${item.value.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (summary.length < 8) {
          summary.push(`${item.label}: ${item.value}`);
        }
      }

      if (seen.size) {
        (metadata as any).metadataNamedEntityCount = seen.size;
        (metadata as any).metadataNamedEntities = summary;
      }
    } else {
      (metadata as any).nlpAnalysis = 'Metadata-only fallback (NLP unavailable)';
      if (nerResult.error) {
        (metadata as any).nlpFallbackReason = nerResult.error;
      }
    }
  } catch (error) {
    (metadata as any).nlpAnalysis = 'Metadata-only fallback (NLP unavailable)';
    (metadata as any).nlpFallbackReason = toErrorMessage(error);
  }
}

export function finalizeAccumulator(
  acc: Map<string, EntityAccumulatorEntry>
): Array<{ label: string; value: string; occurrences: number; averageScore: number; positions?: number[] }> {
  const result: Array<{ label: string; value: string; occurrences: number; averageScore: number; positions?: number[] }> = [];
  for (const entry of acc.values()) {
    const averageScore = entry.occurrences > 0 ? entry.totalScore / entry.occurrences : 0;
    const positions = entry.positions ? Array.from(entry.positions.values()).sort((a, b) => a - b) : undefined;
    result.push({
      label: entry.label,
      value: entry.value,
      occurrences: entry.occurrences,
      averageScore,
      positions,
    });
  }
  return result
    .sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      if ((b.averageScore || 0) !== (a.averageScore || 0)) return (b.averageScore || 0) - (a.averageScore || 0);
      return a.value.localeCompare(b.value);
    })
    .slice(0, 50) as any;
}

export function attachPositionsFromLines(
  entities: Array<{ label: string; value: string; occurrences: number; averageScore: number; positions?: number[] }>,
  lines: string[],
  maxMatchesPerEntity = 12
) {
  if (!entities.length || !lines.length) return entities;
  const normalizedLines = lines.map((line) => line.toLowerCase());
  return entities.map((entity) => {
    if (entity.positions && entity.positions.length) return entity;
    const search = entity.value.toLowerCase();
    if (!search || search.length < 3) return entity;
    const positions: number[] = [];
    for (let index = 0; index < normalizedLines.length; index++) {
      if (normalizedLines[index].includes(search)) {
        positions.push(index + 1);
        if (positions.length >= maxMatchesPerEntity) break;
      }
    }
    if (!positions.length) return entity;
    return {
      ...entity,
      positions,
    };
  });
}

export function summarizeNlpAvailability(result: NamedEntityExtractionResult) {
  return {
    available: result.available,
    model: result.model ?? MODEL_ID,
    error: result.error,
    truncated: Boolean(result.truncated),
  };
}
