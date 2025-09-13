import { useDropzone } from 'react-dropzone';
import type { FileError, Accept } from 'react-dropzone';
import { useMemo, useState } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

function FileDropzone({ onFilesSelected }: FileDropzoneProps) {
  const [message, setMessage] = useState<string | null>(null);
  
  const accept = useMemo<Accept>(() => {
    const documentsOnly: Accept = {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/csv': ['.csv'],
      'text/markdown': ['.md', '.markdown'],
      'application/json': ['.json'],
    };
    return {
      ...documentsOnly,
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/svg+xml': ['.svg'],
      'image/tiff': ['.tif', '.tiff'],
    };
  }, []);

  // Build a set of allowed file extensions for validation (lowercase, with leading dot)
  const allowedExtensions = useMemo(() => {
    const exts = new Set<string>();
    Object.values(accept).forEach((arr) => {
      arr.forEach((ext) => exts.add(ext.toLowerCase()));
    });
    return exts;
  }, [accept]);

  // Many touch devices restrict pickers to images if the input has an accept attr including images.
  // To let users browse all files on mobile, drop the accept attribute for touch devices and validate in code.
  const shouldRelaxAccept = useMemo(() => {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    // iPadOS 13+ sometimes reports as Macintosh; detect via touch points
    const isIOSLike = /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Macintosh') && (navigator as any).maxTouchPoints > 1);
    const isCoarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    return isAndroid || isIOSLike || isCoarsePointer;
  }, []);

  const validateFile = (file: File): FileError | null => {
    const name = file.name || '';
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    const ext = dot >= 0 ? lower.slice(dot) : '';
    if (!allowedExtensions.has(ext)) {
      return {
        code: 'file-invalid-type',
        message: 'Unsupported file type. Please select a supported format.',
      } as FileError;
    }
    return null;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      setMessage(null);
      onFilesSelected(accepted);
    },
    onDropRejected: (rejections) => {
      const legacy = rejections
        .map((r) => r.file.name.toLowerCase())
        .filter((name) => name.endsWith('.doc') || name.endsWith('.ppt') || name.endsWith('.xls'));
      if (legacy.length > 0) {
        setMessage('Legacy formats (.doc, .ppt, .xls) are not supported. Please convert to .docx, .pptx, or .xlsx.');
      } else {
        setMessage('Some files were rejected due to type restrictions.');
      }
    },
    // Only set accept on non-touch devices to avoid iOS/Android limiting to images view
    accept: shouldRelaxAccept ? undefined : accept,
    validator: validateFile,
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 md:p-12 text-center cursor-pointer mb-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <span aria-hidden="true" className="material-symbols-outlined text-gray-500 text-5xl sm:text-6xl">cloud_upload</span>
          <p className="mt-4 text-base sm:text-lg font-semibold text-gray-700">
            {isDragActive ? 'Drop the files here ...' : 'Drop files here or tap to select'}
          </p>
          <p className="text-sm text-gray-600 mb-6 px-2">
            PreSub can make mistakes — please double-check important information.
          </p>
          <ul className="flex justify-center flex-wrap gap-2 sm:gap-3" aria-label="Supported formats" role="list">
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-pink-100 text-pink-700 ring-1 ring-inset ring-pink-200">PDF</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200">Word</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-green-100 text-green-700 ring-1 ring-inset ring-green-200">Excel</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200">PowerPoint</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">CSV</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200">Markdown</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-gray-200 text-gray-800 ring-1 ring-inset ring-gray-300">JSON</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200">Images</span></li>
          </ul>
        </div>
      </div>
      {message && (
        <p className="-mt-6 mb-8 text-sm text-red-600 text-center" role="alert">{message}</p>
      )}

    </>
  );
}

export default FileDropzone;
