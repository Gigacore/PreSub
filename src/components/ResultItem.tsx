import { useMemo, useState } from 'react';
import type { ProcessedFile } from '../App';
import { ResultItemHeader } from './result-item/ResultItemHeader';
import { PotentialIssues } from './result-item/PotentialIssues';
import { InfoBanner } from './result-item/InfoBanner';
import { MetadataDisplay } from './result-item/MetadataDisplay';
import { ExifDisplay } from './result-item/ExifDisplay';
import { Lightbox } from './result-item/Lightbox';
import { ContentFindings } from './result-item/ContentFindings';
import { ResearchSignals } from './result-item/ResearchSignals';

interface ResultItemProps {
  result: ProcessedFile;
  onRemove?: () => void;
}

function ResultItem({ result, onRemove }: ResultItemProps) {
  // Feature flag: toggle EXIF table/expand UI without removing code
  const ENABLE_EXIF_TABLE = false as const;
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());
  // Lightbox preview for images
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const ISSUE_TYPE_BY_KEY: Record<string, string> = {
    author: 'AUTHOR FOUND',
    creator: 'CREATOR FOUND',
    lastModifiedBy: 'LAST MODIFIED BY FOUND',
  };

  const toggleIgnore = (key: string) => {
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredIssues = useMemo(() => {
    const ignoredTypes = new Set(
      Array.from(ignoredKeys)
        .map((k) => ISSUE_TYPE_BY_KEY[k])
        .filter(Boolean)
    );
    return (result.potentialIssues || []).filter((iss) => !ignoredTypes.has(iss.type));
  }, [ignoredKeys, result.potentialIssues]);

  const fileNameLower = result.fileName.toLowerCase();
  const fileType = String((result.metadata as any).fileType || '');
  const isImage = (
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    fileNameLower.endsWith('.png') ||
    fileNameLower.endsWith('.svg') ||
    fileNameLower.endsWith('.tif') ||
    fileNameLower.endsWith('.tiff') ||
    fileType.toLowerCase().includes('image')
  );

  // Research Signals pulled from metadata
  const metaAny = result.metadata as any;
  const ackDetected = Boolean(metaAny.acknowledgementsDetected);
  const fundingDetected = Boolean(metaAny.fundingDetected);
  const affiliationsDetected = Boolean(metaAny.affiliationsDetected);
  const hasResearchSignals = ackDetected || fundingDetected || affiliationsDetected;

  // Smooth scroll helper for in-card banners
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cf = result.contentFindings;
  const legacyEmails = (result.metadata as any).emailsFound as string[] | undefined;
  const legacyUrls = (result.metadata as any).urlsFound as string[] | undefined;
  const emailsCount = (cf?.emails?.length ?? 0) || (legacyEmails?.length ?? 0);
  const urlsCount = (cf?.urls?.length ?? 0) || (legacyUrls?.length ?? 0);
  const hasContentSignals = emailsCount > 0 || urlsCount > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <ResultItemHeader
        result={result}
        isImage={isImage}
        onRemove={onRemove}
        onPreview={() => setPreviewOpen(true)}
      />
      <div className="p-6 space-y-6">
        <PotentialIssues issues={filteredIssues} />

        {hasContentSignals && (
          <InfoBanner
            onClick={() => scrollToSection('content-findings')}
            ariaLabel="Jump to Content Findings"
            title="Jump to Content Findings"
            icon="lightbulb"
            colorScheme="blue"
            primaryText="Review Suggested"
            secondaryText={`Found ${emailsCount} email${emailsCount === 1 ? '' : 's'} and ${urlsCount} URL${urlsCount === 1 ? '' : 's'} in the content. Please review details below.`}
          />
        )}

        {hasResearchSignals && (
          <InfoBanner
            onClick={() => scrollToSection('research-signals')}
            ariaLabel="Jump to Research Signals"
            title="Jump to Research Signals"
            icon="science"
            colorScheme="emerald"
            primaryText="Research Signals Detected"
            secondaryText={`${ackDetected ? 'Acknowledgements' : ''}${ackDetected && (fundingDetected || affiliationsDetected) ? ', ' : ''}${fundingDetected ? 'Funding' : ''}${(ackDetected || fundingDetected) && affiliationsDetected ? ', ' : ''}${affiliationsDetected ? 'Affiliations' : ''} present. See details below.`}
          />
        )}

        <MetadataDisplay
          metadata={result.metadata}
          ignoredKeys={ignoredKeys}
          toggleIgnore={toggleIgnore}
        />

        {ENABLE_EXIF_TABLE && <ExifDisplay exif={result.exif} />}

        {previewOpen && result.previewUrl && (
          <Lightbox
            previewUrl={result.previewUrl}
            fileName={result.fileName}
            onClose={() => setPreviewOpen(false)}
          />
        )}

        <ContentFindings result={result} />

        <ResearchSignals result={result} />
      </div>
    </div>
  );
}

export default ResultItem;
