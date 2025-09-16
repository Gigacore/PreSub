import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as nlp from './nlp';
import { pipeline } from '@huggingface/transformers';

vi.mock('@huggingface/transformers', () => ({
    pipeline: vi.fn((task, model, options) => {
        if (options && options.progress_callback) {
            options.progress_callback({ status: 'progress', progress: 50 });
            options.progress_callback({ status: 'ready' });
        }
        return Promise.resolve(vi.fn());
    }),
    env: {
        allowLocalModels: false,
        useBrowserCache: true,
        backends: {
            onnx: {
                wasm: {
                    numThreads: 1,
                    proxy: false,
                }
            }
        }
    }
}));

describe('nlp', () => {
    beforeEach(() => {
        nlp.resetNlpState_FOR_TESTING();
    });

    describe('buildMetadataText', () => {
        it('should extract and join strings from metadata', () => {
            const metadata = {
                title: 'Test Title',
                author: ['Author 1', 'Author 2'],
                unrelated: 'should be ignored',
            };
            const text = nlp.buildMetadataText(metadata);
            expect(text).toBe('Test Title\nAuthor 1\nAuthor 2');
        });

        it('should handle empty and non-string values', () => {
            const metadata = {
                title: '',
                author: [123, null, 'Author 1'],
            };
            const text = nlp.buildMetadataText(metadata);
            expect(text).toBe('Author 1');
        });
    });

    describe('normalizeEntityLabel', () => {
        it('should normalize entity labels', () => {
            expect(nlp.normalizeEntityLabel('B-PER')).toBe('PER');
            expect(nlp.normalizeEntityLabel('I-ORG')).toBe('ORG');
            expect(nlp.normalizeEntityLabel('  MISC  ')).toBe('MISC');
            expect(nlp.normalizeEntityLabel(123)).toBe('');
        });
    });

    describe('normalizeEntityValue', () => {
        it('should normalize entity values', () => {
            expect(nlp.normalizeEntityValue('  Test  Value  ')).toBe('Test Value');
            expect(nlp.normalizeEntityValue('Test##Value')).toBe('TestValue');
            expect(nlp.normalizeEntityValue(123)).toBe('');
        });
    });

    describe('chunkText', () => {
        it('should chunk text into smaller pieces', () => {
            const longText = 'This is a long text. '.repeat(100);
            const chunks = nlp.chunkText(longText);
            expect(chunks.length).toBeGreaterThan(1);
            for (const chunk of chunks) {
                expect(chunk.length).toBeLessThanOrEqual(800);
            }
        });
    });

    describe('addEntitiesToAccumulator', () => {
        it('should add entities to an accumulator map', () => {
            const acc = new Map();
            const entities = [
                { label: 'PER', value: 'John Doe', score: 0.9 },
                { label: 'PER', value: 'John Doe', score: 0.8 },
            ];
            nlp.addEntitiesToAccumulator(acc, entities, 1);
            const entry = acc.get('PER::john doe');
            expect(entry.occurrences).toBe(2);
            expect(entry.totalScore).toBeCloseTo(1.7);
            expect(Array.from(entry.positions)).toEqual([1]);
        });
    });

    describe('finalizeAccumulator', () => {
        it('should finalize and sort the accumulator', () => {
            const acc = new Map();
            nlp.addEntitiesToAccumulator(acc, [{ label: 'PER', value: 'John Doe', score: 0.9 }], 1);
            nlp.addEntitiesToAccumulator(acc, [{ label: 'ORG', value: 'Acme Inc', score: 0.8 }], 2);
            const result = nlp.finalizeAccumulator(acc);
            expect(result.length).toBe(2);
            expect(result[0].value).toBe('John Doe');
        });
    });

    describe('attachPositionsFromLines', () => {
        it('should attach line positions to entities', () => {
            const entities = [{ label: 'PER', value: 'John Doe', occurrences: 1, averageScore: 0.9 }];
            const lines = ['Line 1', 'Line 2 with John Doe'];
            const result = nlp.attachPositionsFromLines(entities, lines);
            expect(result[0].positions).toEqual([2]);
        });

        it('should not attach positions if already present', () => {
            const entities = [{ label: 'PER', value: 'John Doe', occurrences: 1, averageScore: 0.9, positions: [1] }];
            const lines = ['Line 1 with John Doe', 'Line 2 with John Doe'];
            const result = nlp.attachPositionsFromLines(entities, lines);
            expect(result[0].positions).toEqual([1]);
        });
    });

    describe('summarizeNlpAvailability', () => {
        it('should summarize NLP availability', () => {
            const result = { available: true, model: 'test-model', truncated: true };
            const summary = nlp.summarizeNlpAvailability(result as any);
            expect(summary.available).toBe(true);
            expect(summary.model).toBe('test-model');
            expect(summary.truncated).toBe(true);
        });
    });

    describe('pipeline-dependent functions', () => {
        let mockPipeline: any;

        beforeEach(() => {
            mockPipeline = vi.fn();
            (pipeline as vi.Mock).mockImplementation((task, model, options) => {
                if (options && options.progress_callback) {
                    options.progress_callback({ status: 'progress', progress: 50 });
                    options.progress_callback({ status: 'ready' });
                }
                return Promise.resolve(mockPipeline);
            });
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('shouldFlagPersonValue should flag persons', async () => {
            mockPipeline.mockResolvedValue([{ entity_group: 'PER', word: 'John Doe' }]);
            const result = await nlp.shouldFlagPersonValue('John Doe');
            expect(result).toBe(true);
        });

        it('shouldFlagPersonValue should handle pipeline errors', async () => {
            (pipeline as vi.Mock).mockRejectedValue(new Error('Pipeline error'));
            const result = await nlp.shouldFlagPersonValue('John Doe');
            expect(result).toBe(true);
        });

        it('extractNamedEntities should extract entities', async () => {
            mockPipeline.mockResolvedValue([{ entity_group: 'PER', word: 'John Doe', score: 0.9 }]);
            const result = await nlp.extractNamedEntities('John Doe');
            expect(result.items.length).toBe(1);
            expect(result.items[0].value).toBe('John Doe');
        });

        it('extractNamedEntities should handle empty text', async () => {
            const result = await nlp.extractNamedEntities('');
            expect(result.items.length).toBe(0);
        });

        it('extractNamedEntities should handle pipeline errors', async () => {
            (pipeline as vi.Mock).mockRejectedValue(new Error('Pipeline error'));
            const result = await nlp.extractNamedEntities('John Doe');
            expect(result.available).toBe(false);
            expect(result.error).toBe('Pipeline error');
        });

        it('classifyNamedEntitySpans should classify spans', async () => {
            mockPipeline.mockResolvedValue([{ entity_group: 'PER', word: 'John Doe', start: 0, end: 8, score: 0.9 }]);
            const result = await nlp.classifyNamedEntitySpans('John Doe');
            expect(result.spans.length).toBe(1);
            expect(result.spans[0].text).toBe('John Doe');
        });

        it('classifyNamedEntitySpans should merge adjacent spans', async () => {
            mockPipeline.mockResolvedValue([
                { entity_group: 'PER', word: 'John', start: 0, end: 4, score: 0.9 },
                { entity_group: 'PER', word: 'Doe', start: 5, end: 8, score: 0.9 },
            ]);
            const result = await nlp.classifyNamedEntitySpans('John Doe');
            expect(result.spans.length).toBe(1);
            expect(result.spans[0].text).toBe('John Doe');
        });

        it('classifyNamedEntitySpans should handle empty text', async () => {
            const result = await nlp.classifyNamedEntitySpans('');
            expect(result.spans.length).toBe(0);
        });

        it('classifyNamedEntitySpans should handle pipeline errors', async () => {
            (pipeline as vi.Mock).mockRejectedValue(new Error('Pipeline error'));
            const result = await nlp.classifyNamedEntitySpans('John Doe');
            expect(result.available).toBe(false);
            expect(result.error).toBe('Pipeline error');
        });

        it('annotateMetadataWithNamedEntities should annotate metadata', async () => {
            mockPipeline.mockResolvedValue([{ entity_group: 'PER', word: 'John Doe', score: 0.9 }]);
            const metadata = { author: 'John Doe' };
            await nlp.annotateMetadataWithNamedEntities(metadata);
            expect((metadata as any).metadataNamedEntityCount).toBe(1);
        });

        it('annotateMetadataWithNamedEntities should handle empty metadata', async () => {
            const metadata = {};
            await nlp.annotateMetadataWithNamedEntities(metadata);
            expect((metadata as any).metadataNamedEntityCount).toBeUndefined();
        });

        it('annotateMetadataWithNamedEntities should handle pipeline errors', async () => {
            (pipeline as vi.Mock).mockRejectedValue(new Error('Pipeline error'));
            const metadata = { author: 'John Doe' };
            await nlp.annotateMetadataWithNamedEntities(metadata);
            expect((metadata as any).nlpAnalysis).toBe('Metadata-only fallback (NLP unavailable)');
            expect((metadata as any).nlpFallbackReason).toBe('Pipeline error');
        });
    });
});
