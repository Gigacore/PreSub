import * as ExifReader from 'exifreader';
import { parseXml, mapByLocalName, text } from './xml';
import { toISO } from './date';

export function extractXmpXmlFromBuffer(buf: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buf);
  // Decode as Latin-1 to preserve byte values; XMP markers are ASCII
  const s = new TextDecoder('latin1').decode(bytes);
  return extractXmpXmlFromString(s);
}

export function extractXmpXmlFromString(s: string): string | null {
  const startIdx = s.indexOf('<x:xmpmeta');
  if (startIdx === -1) return null;
  const endIdx = s.indexOf('</x:xmpmeta>', startIdx);
  if (endIdx === -1) return null;
  return s.substring(startIdx, endIdx + '</x:xmpmeta>'.length);
}

export function extractXmpMetadataFromXml(xmpXml: string) {
  const doc = parseXml(xmpXml);
  const map = mapByLocalName(doc);
  const meta: Record<string, string | number | boolean | null | undefined> = {};

  // Dublin Core and common XMP
  if (map.title) meta.title = text(map.title);
  if (map.description) meta.description = text(map.description);
  if (map.creator) {
    // Often wrapped in rdf:Seq; take text content
    const creatorText = text(map.creator);
    if (creatorText) {
      meta.creator = creatorText;
      // Treat as author for highlighting
      meta.author = meta.author || creatorText;
    }
  }
  if (map.rights) meta.rights = text(map.rights);
  if (map.Copyright) meta.copyright = text(map.Copyright);
  if (map.Artist) meta.author = meta.author || text(map.Artist);
  if (map.CreatorTool) meta.creatorTool = text(map.CreatorTool);
  if (map.CreateDate) meta.creationDate = toISO(text(map.CreateDate));
  if (map.ModifyDate) meta.modificationDate = toISO(text(map.ModifyDate));
  if (map.MetadataDate) meta.metadataDate = toISO(text(map.MetadataDate));
  if (map.Credit) meta.credit = text(map.Credit);
  if (map.Source) meta.source = text(map.Source);

  return meta;
}

export function extractPngTextChunks(buf: ArrayBuffer): Record<string, string> {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const out: Record<string, string> = {};

  // PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    if (u8[i] !== sig[i]) return out; // Not a PNG
  }

  let offset = 8; // after signature
  while (offset + 8 <= u8.length) {
    const length = dv.getUint32(offset, false); // big-endian
    const type = String.fromCharCode(
      u8[offset + 4],
      u8[offset + 5],
      u8[offset + 6],
      u8[offset + 7]
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > u8.length) break;

    if (type === 'tEXt') {
      const data = u8.subarray(dataStart, dataEnd);
      // tEXt: Latin-1, keyword\0text
      const idx0 = data.indexOf(0);
      if (idx0 > 0) {
        const key = new TextDecoder('latin1').decode(data.subarray(0, idx0));
        const value = new TextDecoder('latin1').decode(data.subarray(idx0 + 1));
        out[key] = value;
      }
    } else if (type === 'iTXt') {
      const data = u8.subarray(dataStart, dataEnd);
      // iTXt: keyword\0 compressionFlag(1) compressionMethod(1) languageTag\0 translatedKeyword\0 text
      let p = 0;
      const zero = () => data.indexOf(0, p);
      const z0 = zero();
      if (z0 > 0) {
        const keyword = new TextDecoder('utf-8').decode(data.subarray(0, z0));
        p = z0 + 1;
        const compressionFlag = data[p++];
        p++; // compressionMethod (ignored)
        const z1 = data.indexOf(0, p);
        p = (z1 >= 0 ? z1 + 1 : p); // skip languageTag
        const z2 = data.indexOf(0, p);
        p = (z2 >= 0 ? z2 + 1 : p); // skip translatedKeyword
        if (compressionFlag === 0) {
          const text = new TextDecoder('utf-8').decode(data.subarray(p));
          out[keyword] = text;
          // If this is the XMP field and is uncompressed, it's full XML
          if (keyword === 'XML:com.adobe.xmp') {
            // Parse elsewhere by generic scan as well
          }
        }
        // If compressed, we skip (no inflater dependency in-browser)
      }
    }

    // Move past data + CRC
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  return out;
}

// Parse EXIF/IFD/XMP via ExifReader
export async function extractExifMetadata(arrayBuffer: ArrayBuffer) {
  try {
    // expanded: false returns tag objects; we normalize into string values
    let tags: any;
    try {
      tags = await (ExifReader as any).load(arrayBuffer);
    } catch {
      return {} as Record<string, unknown>;
    }

    const read = (key: string) => {
      const t: any = (tags as any)[key];
      if (!t) return undefined;
      // ExifReader tag has .description for human-readable, .value for raw
      return (typeof t.description !== 'undefined' ? t.description : t.value);
    };

    const meta: Record<string, string | number | boolean | null | undefined> = {};
    const author = (read('Artist') || read('XPAuthor') || read('Author')) as string | undefined;
    const creator = (read('Creator') || read('XPSubject')) as string | undefined;
    const software = read('Software') as string | undefined;
    const imageDesc = (read('ImageDescription') || read('Description') || read('XPComment')) as string | undefined;
    const copyright = (read('Copyright') || read('XPAuthor')) as string | undefined;
    const credit = read('Credit') as string | undefined;
    const source = read('Source') as string | undefined;
    const createDate = (read('DateTimeOriginal') || read('CreateDate') || read('CreationTime')) as string | undefined;
    const modifyDate = (read('ModifyDate') || read('DateTime')) as string | undefined;

    if (author) meta.author = String(author).trim();
    if (creator) meta.creator = String(creator).trim();
    if (software) meta.software = String(software).trim();
    if (imageDesc) meta.description = String(imageDesc).trim();
    if (copyright) meta.copyright = String(copyright).trim();
    if (credit) meta.credit = String(credit).trim();
    if (source) meta.source = String(source).trim();
    if (createDate) meta.creationDate = toISO(String(createDate));
    if (modifyDate) meta.modificationDate = toISO(String(modifyDate));

    // Also expose ALL EXIF tags as a flat map for display
    const exifAll: Record<string, string | number | boolean | null> = {};
    for (const key of Object.keys(tags || {})) {
      try {
        const t: any = (tags as any)[key];
        let value: unknown = undefined;
        if (t && typeof t === 'object') {
          value = typeof t.description !== 'undefined' ? t.description : t.value;
        } else {
          value = t;
        }
        // Normalize arrays and objects to readable strings
        if (Array.isArray(value)) {
          exifAll[key] = (value as any[]).map((v) => String(v)).join(', ');
        } else if (value !== undefined && value !== null) {
          exifAll[key] = (typeof value === 'object') ? JSON.stringify(value) : (value as any);
        } else {
          exifAll[key] = null;
        }
      } catch {
        // ignore malformed fields
      }
    }
    // Attach temporarily; callers can pick it and remove from metadata
    (meta as any).__exifAll = exifAll;

    return meta;
  } catch (e) {
    console.warn('EXIF parse warning:', e);
    return {} as Record<string, unknown>;
  }
}
