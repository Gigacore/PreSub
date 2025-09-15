export function parseXml(xml: string) {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
}

export function mapByLocalName(doc: Document) {
  const nodes = doc.getElementsByTagName('*');
  const map: Record<string, Element> = {};
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as Element;
    const key = el.localName; // ignore namespaces
    if (!(key in map)) map[key] = el;
  }
  return map as Record<string, Element> & { [k: string]: Element };
}

export function text(el?: Element) {
  return el ? (el.textContent || '').trim() : '';
}

export function textContent(el: Element) {
  return (el.textContent || '').trim();
}
