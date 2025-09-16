import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NlpSetupModal from './NlpSetupModal';
import { NLP_SETUP_EVENT, type NlpSetupEvent } from '../lib/analysis/nlp';

describe('NlpSetupModal', () => {
    it('is not visible by default', () => {
        const { container } = render(<NlpSetupModal />);
        expect(container).toBeEmptyDOMElement();
    });

    it('becomes visible on "start" event', () => {
        render(<NlpSetupModal />);
        act(() => {
            window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail: { status: 'start', model: 'test' } }));
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('becomes visible on "progress" event', () => {
        render(<NlpSetupModal />);
        act(() => {
            window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail: { status: 'progress', model: 'test', progress: 50 } }));
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('hides after a delay on "ready" event', () => {
        vi.useFakeTimers();
        render(<NlpSetupModal />);
        act(() => {
            window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail: { status: 'start', model: 'test' } }));
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail: { status: 'ready', model: 'test' } }));
        });

        act(() => {
            vi.advanceTimersByTime(700);
        });

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        vi.useRealTimers();
    });

    it('hides immediately on "error" event', () => {
        render(<NlpSetupModal />);
        act(() => {
            window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail: { status: 'start', model: 'test' } }));
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent<NlpSetupEvent>(NLP_SETUP_EVENT, { detail: { status: 'error', model: 'test', error: 'test error' } }));
        });
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
});
