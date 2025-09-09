import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';
import { js2xml } from 'xml-js';

export interface AnalysisResult {
  critical: { id: string; description: string; value: string }[];
  warning: { id: string; description: string; value: string }[];
  info: { id: string; description: string; value: string }[];
}

export async function analyzeFile(buf: Uint8Array, mime?: string, name?:string): Promise<AnalysisResult> {
  console.log('Starting file analysis...');
  const result: AnalysisResult = {
    critical: [],
    warning: [],
    info: [],
  };

  try {
    console.log('Loading with JSZip...');
    const zip = await JSZip.loadAsync(buf);
    console.log('JSZip loading complete.');
    const corePropsXml = await zip.file('docProps/core.xml')?.async('string');

    if (corePropsXml) {
      const coreProps = await parseStringPromise(corePropsXml, {
        explicitArray: false,
        tagNameProcessors: [tag => tag.replace('cp:', '')],
      });

      const properties = coreProps.coreProperties;
      if (properties) {
        const creator = properties['dc:creator'];
        if (creator) {
          result.critical.push({
            id: 'author',
            description: 'The author of the document.',
            value: creator,
          });
        }

        const lastModifiedBy = properties.lastModifiedBy;
        if (lastModifiedBy) {
          result.warning.push({
            id: 'lastModifiedBy',
            description: 'The person who last modified the document.',
            value: lastModifiedBy,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
    // For now, we just ignore errors and return an empty result.
    // In the future, we might want to return an error message.
  }

  return result;
}

export async function sanitizeFile(buf: Uint8Array, opts?: any): Promise<Uint8Array> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const corePropsXmlPath = 'docProps/core.xml';
    const corePropsXml = await zip.file(corePropsXmlPath)?.async('string');

    if (corePropsXml) {
      const coreProps = await parseStringPromise(corePropsXml, {
        explicitArray: false,
        tagNameProcessors: [tag => tag.replace('cp:', '')],
      });

      const properties = coreProps.coreProperties;
      if (properties) {
        if (properties['dc:creator']) {
          delete properties['dc:creator'];
        }
        if (properties.lastModifiedBy) {
          delete properties.lastModifiedBy;
        }
      }

      const builderOptions = {
        compact: true,
        spaces: 2,
      };
      const newCorePropsXml = js2xml(coreProps, builderOptions);
      zip.file(corePropsXmlPath, newCorePropsXml);
    }

    return zip.generateAsync({ type: 'uint8array' });
  } catch (error) {
    console.error('Error sanitizing file:', error);
    // Return original buffer on error
    return buf;
  }
}
