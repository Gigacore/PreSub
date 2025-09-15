import JSZip from 'jszip';
import { mapByLocalName, parseXml, text } from './xml';
import { toISO } from './date';
import { number } from './number';
import { safeReadText } from './zip';

export async function extractOOXMLMetadata(arrayBuffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const coreXml = await safeReadText(zip, 'docProps/core.xml');
  const appXml = await safeReadText(zip, 'docProps/app.xml');

  const meta: Record<string, string | number | boolean | null | undefined> = {};

  if (coreXml) {
    const core = parseXml(coreXml);
    const map = mapByLocalName(core);
    if (map.title) meta.title = text(map.title);
    if (map.creator) meta.creator = text(map.creator);
    if (map.subject) meta.subject = text(map.subject);
    if (map.description) meta.description = text(map.description);
    if (map.keywords) meta.keywords = text(map.keywords);
    if (map.category) meta.category = text(map.category);
    if (map.lastModifiedBy) meta.lastModifiedBy = text(map.lastModifiedBy);
    if (map.created) meta.creationDate = toISO(text(map.created));
    if (map.modified) meta.modificationDate = toISO(text(map.modified));
    // For consistency with other parsers
    if (!meta.author && map.creator) meta.author = text(map.creator);
  }

  if (appXml) {
    const app = parseXml(appXml);
    const map = mapByLocalName(app);
    if (map.Company) meta.company = text(map.Company);
    if (map.Manager) meta.manager = text(map.Manager);
    if (map.Application) meta.application = text(map.Application);
    if (map.AppVersion) meta.appVersion = text(map.AppVersion);
    if (map.Slides) meta.slides = number(text(map.Slides));
    if (map.Pages) meta.pages = number(text(map.Pages));
    if (map.Words) meta.words = number(text(map.Words));
    if (map.TotalTime) meta.totalTime = number(text(map.TotalTime));
  }

  return meta;
}
