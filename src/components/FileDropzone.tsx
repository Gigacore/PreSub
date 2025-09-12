import { useDropzone } from 'react-dropzone';
import { useMemo, useState } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

function FileDropzone({ onFilesSelected }: FileDropzoneProps) {
  const [message, setMessage] = useState<string | null>(null);
  
  // Detect mobile to avoid image-only pickers on iOS/Android when images are in accept list
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const accept = useMemo(() => {
    const documentsOnly = {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/csv': ['.csv'],
      'text/markdown': ['.md', '.markdown'],
      'application/json': ['.json'],
    } as const;

    // On desktop: keep images enabled. On mobile: exclude images to ensure Files picker shows docs.
    if (isMobile) return documentsOnly as any;

    return {
      ...documentsOnly,
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/svg+xml': ['.svg'],
      'image/tiff': ['.tif', '.tiff'],
    } as const as any;
  }, [isMobile]);

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
    accept,
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
          <span aria-hidden="true" className="material-symbols-outlined text-gray-500 text-5xl sm:text-6xl">upload_file</span>
          <p className="mt-4 text-base sm:text-lg font-semibold text-gray-700">
            {isDragActive ? 'Drop the files here ...' : 'Drop files here or click to select'}
          </p>
          <p className="text-sm text-gray-600 mb-6 px-2">
            PreSub can make mistakes — please double-check important information.
          </p>
          <ul className="flex justify-center flex-wrap gap-2 sm:gap-3" aria-label="Supported formats" role="list">
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200">PDF</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200">Word</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-green-100 text-green-700 ring-1 ring-inset ring-green-200">Excel</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200">PowerPoint</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">CSV</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200">Markdown</span></li>
            <li><span className="inline-flex items-center rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium bg-gray-200 text-gray-800 ring-1 ring-inset ring-gray-300">JSON</span></li>
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
