import { useDropzone } from 'react-dropzone';
import { useState } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

function FileDropzone({ onFilesSelected }: FileDropzoneProps) {
  const [message, setMessage] = useState<string | null>(null);
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
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/svg+xml': ['.svg'],
      'image/tiff': ['.tif', '.tiff'],
    },
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer mb-8 transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 48 }}>upload_file</span>
          <p className="mt-4 text-lg font-semibold text-gray-700">
            {isDragActive ? 'Drop the files here ...' : 'Drop files here or click to select'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            All processing happens on your device. No data is uploaded.
          </p>
          <div className="flex justify-center flex-wrap gap-4">
            <button type="button" className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition duration-300">PDF</button>
            <button type="button" className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-6 rounded-lg transition duration-300">Word</button>
            <button type="button" className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg transition duration-300">Excel</button>
            <button type="button" className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-6 rounded-lg transition duration-300">PowerPoint</button>
          </div>
        </div>
      </div>
      {message && (
        <p className="-mt-6 mb-8 text-sm text-red-600 text-center" role="alert">{message}</p>
      )}
    </>
  );
}

export default FileDropzone;
