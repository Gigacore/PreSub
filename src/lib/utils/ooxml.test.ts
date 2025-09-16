import { describe, it, expect, vi } from 'vitest';
import { extractOOXMLMetadata } from './ooxml';
import JSZip from 'jszip';

vi.mock('jszip');

describe('ooxml utils', () => {
  it('extracts all metadata from a mock OOXML file', async () => {
    const mockZip = {
      file: (path: string) => {
        if (path === 'docProps/core.xml') {
          return {
            async: () => Promise.resolve(`
              <coreProperties>
                <title>Test Title</title>
                <creator>Test Creator</creator>
                <subject>Test Subject</subject>
                <description>Test Description</description>
                <keywords>Test, Keywords</keywords>
                <category>Test Category</category>
                <lastModifiedBy>Test Modifier</lastModifiedBy>
                <created>2024-01-01T12:00:00Z</created>
                <modified>2024-01-01T13:00:00Z</modified>
              </coreProperties>
            `),
          };
        }
        if (path === 'docProps/app.xml') {
          return {
            async: () => Promise.resolve(`
              <Properties>
                <Application>Test App</Application>
                <AppVersion>1.0</AppVersion>
                <Company>Test Company</Company>
                <Manager>Test Manager</Manager>
                <Slides>5</Slides>
                <Pages>3</Pages>
                <Words>100</Words>
                <TotalTime>10</TotalTime>
              </Properties>
            `),
          };
        }
        return null;
      },
    };

    (JSZip.loadAsync as vi.Mock).mockResolvedValue(mockZip);

    const metadata = await extractOOXMLMetadata(new ArrayBuffer(0));

    expect(metadata.title).toBe('Test Title');
    expect(metadata.creator).toBe('Test Creator');
    expect(metadata.author).toBe('Test Creator');
    expect(metadata.subject).toBe('Test Subject');
    expect(metadata.description).toBe('Test Description');
    expect(metadata.keywords).toBe('Test, Keywords');
    expect(metadata.category).toBe('Test Category');
    expect(metadata.lastModifiedBy).toBe('Test Modifier');
    expect(metadata.creationDate).toBe('2024-01-01T12:00:00.000Z');
    expect(metadata.modificationDate).toBe('2024-01-01T13:00:00.000Z');
    expect(metadata.application).toBe('Test App');
    expect(metadata.appVersion).toBe('1.0');
    expect(metadata.company).toBe('Test Company');
    expect(metadata.manager).toBe('Test Manager');
    expect(metadata.slides).toBe(5);
    expect(metadata.pages).toBe(3);
    expect(metadata.words).toBe(100);
    expect(metadata.totalTime).toBe(10);
  });

  it('handles missing core.xml file gracefully', async () => {
    const mockZip = {
      file: (path: string) => {
        if (path === 'docProps/app.xml') {
          return { async: () => Promise.resolve('<Properties></Properties>') };
        }
        return null;
      },
    };
    (JSZip.loadAsync as vi.Mock).mockResolvedValue(mockZip);
    const metadata = await extractOOXMLMetadata(new ArrayBuffer(0));
    expect(metadata).toEqual({});
  });

  it('handles missing app.xml file gracefully', async () => {
    const mockZip = {
      file: (path: string) => {
        if (path === 'docProps/core.xml') {
          return { async: () => Promise.resolve('<coreProperties></coreProperties>') };
        }
        return null;
      },
    };
    (JSZip.loadAsync as vi.Mock).mockResolvedValue(mockZip);
    const metadata = await extractOOXMLMetadata(new ArrayBuffer(0));
    expect(metadata).toEqual({});
  });

  it('handles empty properties in xml files', async () => {
    const mockZip = {
      file: (path: string) => {
        if (path === 'docProps/core.xml') {
          return { async: () => Promise.resolve('<coreProperties></coreProperties>') };
        }
        if (path === 'docProps/app.xml') {
          return { async: () => Promise.resolve('<Properties></Properties>') };
        }
        return null;
      },
    };
    (JSZip.loadAsync as vi.Mock).mockResolvedValue(mockZip);
    const metadata = await extractOOXMLMetadata(new ArrayBuffer(0));
    expect(metadata).toEqual({});
  });

  it('handles missing metadata files gracefully', async () => {
    const mockZip = {
      file: () => null,
    };
    (JSZip.loadAsync as vi.Mock).mockResolvedValue(mockZip);
    const metadata = await extractOOXMLMetadata(new ArrayBuffer(0));
    expect(metadata).toEqual({});
  });
});
