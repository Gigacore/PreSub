import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCleanupOutdatedCaches = vi.fn();
const mockPrecacheAndRoute = vi.fn();
const mockClientsClaim = vi.fn();

vi.mock('workbox-precaching', () => ({
    cleanupOutdatedCaches: mockCleanupOutdatedCaches,
    precacheAndRoute: mockPrecacheAndRoute,
}));

vi.mock('workbox-core', () => ({
    clientsClaim: mockClientsClaim,
}));

const mockMatch = vi.fn();
const mockCaches = {
    open: vi.fn(() => Promise.resolve({
        match: mockMatch,
    })),
};

const createMockSelf = () => ({
    skipWaiting: vi.fn(),
    addEventListener: vi.fn(),
    __WB_MANIFEST: [],
    registration: {
        scope: 'test-scope',
    },
    caches: mockCaches,
});

describe('Service Worker', () => {
    let mockSelf: any;

    beforeEach(() => {
        mockSelf = createMockSelf();
        vi.stubGlobal('self', mockSelf);
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should setup precaching and claim clients', async () => {
        await import('./sw');
        expect(mockCleanupOutdatedCaches).toHaveBeenCalled();
        expect(mockPrecacheAndRoute).toHaveBeenCalledWith([]);
        expect(mockSelf.skipWaiting).toHaveBeenCalled();
        expect(mockClientsClaim).toHaveBeenCalled();
    });
});
