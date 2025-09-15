declare module '@nlpjs/basic' {
  export class Nlp {
    constructor(opts?: any);
    addDocument(lang: string, utterance: string, intent: string): void;
    train(): Promise<void>;
    process(lang: string, utterance: string): Promise<{ intent: string; score: number }>;
  }
}

declare module '@nlpjs/lang-en-min' {
  export class LangEn {
    constructor(opts?: any);
  }
}

