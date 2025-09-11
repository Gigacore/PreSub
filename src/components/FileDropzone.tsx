import { useDropzone } from 'react-dropzone';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

function FileDropzone({ onFilesSelected }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFilesSelected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors
        ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center">
        <svg
          className="w-16 h-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4H7z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 16v-4m0 0l-2 2m2-2l2 2"
          />
        </svg>
        <p className="mt-4 text-lg text-gray-600">
          {isDragActive
            ? 'Drop the files here ...'
            : 'Drop files here or click to select'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          All processing happens on your device. No data is uploaded.
        </p>
        <div className="mt-6 space-x-2">
          <span className="inline-block bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-full">
            PDF
          </span>
          <span className="inline-block bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-full">
            Word
          </span>
          <span className="inline-block bg-yellow-500 text-white text-sm font-semibold px-4 py-2 rounded-full">
            Excel
          </span>
          <span className="inline-block bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full">
            PowerPoint
          </span>
        </div>
      </div>
    </div>
  );
}

export default FileDropzone;
