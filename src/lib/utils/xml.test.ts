import { describe, it, expect } from 'vitest';
import { parseXml, mapByLocalName, text, textContent } from './xml';

// Mocking DOMParser for Node.js environment
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;

describe('xml utils', () => {
  const xmlString = '<root><child><name>Test</name></child></root>';
  let doc: Document;

  it('parses an XML string into a Document', () => {
    doc = parseXml(xmlString);
    expect(doc).toBeDefined();
    expect(doc.documentElement.localName).toBe('root');
  });

  it('maps XML elements by their local name', () => {
    doc = parseXml(xmlString);
    const map = mapByLocalName(doc);
    expect(map.root).toBeDefined();
    expect(map.child).toBeDefined();
    expect(map.name).toBeDefined();
    expect(map.name.textContent).toBe('Test');
  });

  it('extracts text content from an element', () => {
    doc = parseXml(xmlString);
    const nameElement = doc.getElementsByTagName('name')[0];
    expect(text(nameElement)).toBe('Test');
    expect(textContent(nameElement)).toBe('Test');
  });

  it('handles empty or undefined elements gracefully', () => {
    expect(text(undefined)).toBe('');
  });
});
