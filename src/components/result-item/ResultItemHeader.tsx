import type { ProcessedFile } from '../../App';

interface ResultItemHeaderProps {
  result: ProcessedFile;
  isImage: boolean;
  onRemove?: () => void;
  onPreview: () => void;
}

const headerIconMap = {
  image: { icon: 'image', color: 'text-gray-500' },
  ppt: { icon: 'slideshow', color: 'text-gray-500' },
  excel: { icon: 'table', color: 'text-gray-500' },
  json: { icon: 'code', color: 'text-gray-500' },
  text: { icon: 'text_snippet', color: 'text-gray-500' },
  default: { icon: 'description', color: 'text-gray-500' },
};

function getFileIcon(fileName: string, fileType: string, isImage: boolean) {
  if (isImage) return headerIconMap.image;
  const lowerFileName = fileName.toLowerCase();
  const lowerFileType = fileType.toLowerCase();
  if (lowerFileName.endsWith('.ppt') || lowerFileName.endsWith('.pptx') || lowerFileType.includes('powerpoint')) {
    return headerIconMap.ppt;
  }
  if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls') || lowerFileType.includes('excel') || lowerFileType.includes('sheet')) {
    return headerIconMap.excel;
  }
  if (lowerFileName.endsWith('.json')) {
    return headerIconMap.json;
  }
  if (lowerFileName.endsWith('.csv') || lowerFileName.endsWith('.md') || lowerFileName.endsWith('.markdown')) {
    return headerIconMap.text;
  }
  return headerIconMap.default;
}

export function ResultItemHeader({ result, isImage, onRemove, onPreview }: ResultItemHeaderProps) {
  const fileType = String((result.metadata as any).fileType || '');
  const headerIcon = getFileIcon(result.fileName, fileType, isImage);

  return (
    <div className="p-4 flex flex-wrap items-center justify-between gap-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isImage && result.previewUrl ? (
          <button
            type="button"
            aria-label={`Preview ${result.fileName}`}
            onClick={onPreview}
            className="relative group h-10 w-10 shrink-0"
          >
            <img
              src={result.previewUrl}
              alt={result.fileName}
              className="h-10 w-10 rounded-md object-cover border border-gray-200 cursor-pointer"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 rounded-md bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span aria-hidden className="material-symbols-outlined text-white text-base">open_in_full</span>
            </div>
          </button>
        ) : (
          <span aria-hidden className={`material-symbols-outlined ${headerIcon.color}`}>{headerIcon.icon}</span>
        )}
        <h2 className="font-medium text-gray-800 truncate" title={result.fileName}>{result.fileName}</h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {result.previewUrl && !isImage && (
          <button
            type="button"
            aria-label={`Preview ${result.fileName}`}
            onClick={onPreview}
            className="relative group h-10 w-10"
          >
            <img
              src={result.previewUrl}
              alt={result.fileName}
              className="h-10 w-10 rounded-md object-cover border border-gray-200 cursor-pointer"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 rounded-md bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span aria-hidden className="material-symbols-outlined text-white text-base">open_in_full</span>
            </div>
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${result.fileName}`}
            title="Remove"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 cursor-pointer"
          >
            <span aria-hidden className="material-symbols-outlined">delete</span>
          </button>
        )}
      </div>
    </div>
  );
}
