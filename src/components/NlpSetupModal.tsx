import { useEffect, useRef, useState } from 'react';
import { NLP_SETUP_EVENT, type NlpSetupEvent } from '../lib/analysis/nlp';

export default function NlpSetupModal() {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimeout = () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };

    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<NlpSetupEvent | undefined>).detail;
      if (!detail) return;

      switch (detail.status) {
        case 'start':
          clearHideTimeout();
          setIsVisible(true);
          break;
        case 'progress':
          setIsVisible(true);
          break;
        case 'ready':
          clearHideTimeout();
          hideTimeoutRef.current = window.setTimeout(() => {
            setIsVisible(false);
            hideTimeoutRef.current = null;
          }, 600);
          break;
        case 'error':
          clearHideTimeout();
          setIsVisible(false);
          hideTimeoutRef.current = null;
          break;
        default:
          break;
      }
    };

    window.addEventListener(NLP_SETUP_EVENT, handleEvent as EventListener);
    return () => {
      clearHideTimeout();
      window.removeEventListener(NLP_SETUP_EVENT, handleEvent as EventListener);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nlp-setup-title"
        aria-describedby="nlp-setup-description"
        className="w-full max-w-sm transform rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="material-symbols-outlined text-4xl text-sky-600">neurology</span>
          <div>
            <h2 id="nlp-setup-title" className="text-lg font-semibold text-gray-900">
              Setting up Natural Language Processing
            </h2>
            <p id="nlp-setup-description" className="mt-1 text-sm text-gray-600">
              Downloading the language model. This one-time setup may take a moment.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"
            role="status"
            aria-label="Downloading NLP model"
          />
          <p className="mt-3 text-sm text-gray-600">Hang tight—this runs only once.</p>
        </div>
      </div>
    </div>
  );
}
