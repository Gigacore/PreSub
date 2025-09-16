import type { ProcessedFile } from '../../App';
import {
  extractXmpMetadataFromXml,
  extractXmpXmlFromString,
} from '../utils/image';
import { parseXml, textContent } from '../utils/xml';
import { shouldFlagAuthorValue } from '../analysis/nlp';

export async function parseSvg(file: File): Promise<ProcessedFile> {
  const text = await file.text();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'SVG Image',
    },
  };

  try {
    const doc = parseXml(text);
    const titleEl = doc.getElementsByTagName('title')[0];
    const descEl = doc.getElementsByTagName('desc')[0];
    if (titleEl) processedFile.metadata.title = textContent(titleEl);
    if (descEl) processedFile.metadata.description = textContent(descEl);

    // Common attributes seen in SVG editors
    const svgEl = doc.getElementsByTagName('svg')[0];
    if (svgEl) {
      const docname = svgEl.getAttribute('sodipodi:docname') || svgEl.getAttribute('docname');
      if (docname) processedFile.metadata.docName = docname;
      const creatorTool = svgEl.getAttribute('inkscape:version') || svgEl.getAttribute('xmp:CreatorTool');
      if (creatorTool) processedFile.metadata.creatorTool = creatorTool;
    }

    // XMP metadata embedded in <metadata> (RDF)
    const xmpXml = extractXmpXmlFromString(text);
    if (xmpXml) {
      const meta = extractXmpMetadataFromXml(xmpXml);
      Object.assign(processedFile.metadata, meta);
    } else {
      // Fallback: try any <creator> element text
      const creators = doc.getElementsByTagName('*');
      for (let i = 0; i < creators.length; i++) {
        const el = creators[i] as Element;
        if (el.localName === 'creator') {
          const v = textContent(el);
          if (v) {
            processedFile.metadata.author = v;
            break;
          }
        }
      }
    }

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const author = String((processedFile.metadata as any).author || '').trim();
    const creator = String((processedFile.metadata as any).creator || '').trim();
    if (author && (await shouldFlagAuthorValue(author))) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('SVG parse warning:', e);
  }

  return processedFile;
}
