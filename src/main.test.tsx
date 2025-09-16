import { describe, it, expect, vi, beforeEach } from 'vitest';

const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));

vi.mock('react-dom/client', () => ({ createRoot }));
vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {
        workerSrc: '',
    },
    getDocument: vi.fn(() => ({
        promise: Promise.resolve({
            numPages: 1,
            getPage: vi.fn(() => Promise.resolve({
                getTextContent: vi.fn(() => Promise.resolve({ items: [] })),
            })),
        }),
    })),
    version: 'mock-version',
}));


describe('main.tsx', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const rootElement = document.createElement('div');
        rootElement.id = 'root';
        document.body.innerHTML = '';
        document.body.appendChild(rootElement);
    });

    it('should render the App component into the root element', async () => {
        await import('./main.tsx');
        expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
        expect(render).toHaveBeenCalled();
    });
});
