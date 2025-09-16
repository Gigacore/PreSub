import { useEffect } from 'react';

interface LightboxProps {
  previewUrl: string;
  fileName: string;
  onClose: () => void;
}

export function Lightbox({ previewUrl, fileName, onClose }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={previewUrl}
          alt={fileName}
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full shadow-md border border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 flex items-center justify-center h-9 w-9"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}
