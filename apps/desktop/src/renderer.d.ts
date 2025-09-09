import { AnalysisResult } from 'core';

export interface ICore {
  analyze: (filePath: string) => Promise<AnalysisResult>;
  sanitize: (filePath: string) => Promise<Uint8Array>;
}

declare global {
  interface Window {
    core: ICore;
  }
}
