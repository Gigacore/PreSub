import { describe, it, expect, vi } from 'vitest';
import worker from './worker';

describe('Cloudflare Worker', () => {
    it('should serve static assets', async () => {
        const mockFetch = vi.fn(() => Promise.resolve(new Response('asset content')));
        const env = { ASSETS: { fetch: mockFetch } };
        const request = new Request('http://localhost/asset.js');

        const response = await worker.fetch(request, env);

        expect(mockFetch).toHaveBeenCalledWith(request);
        expect(await response.text()).toBe('asset content');
    });

    it('should serve index.html for 404 navigation requests', async () => {
        const mockFetch = vi.fn((req: Request) => {
            if (req.url.endsWith('/index.html')) {
                return Promise.resolve(new Response('index.html content'));
            }
            return Promise.resolve(new Response('not found', { status: 404 }));
        });
        const env = { ASSETS: { fetch: mockFetch } };
        const request = new Request('http://localhost/nonexistent-page', {
            headers: { Accept: 'text/html' },
        });

        const response = await worker.fetch(request, env);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(await response.text()).toBe('index.html content');
    });

    it('should return 404 for non-navigation requests that are not found', async () => {
        const mockFetch = vi.fn(() => Promise.resolve(new Response('not found', { status: 404 })));
        const env = { ASSETS: { fetch: mockFetch } };
        const request = new Request('http://localhost/nonexistent-asset.js');

        const response = await worker.fetch(request, env);

        expect(response.status).toBe(404);
    });
});
