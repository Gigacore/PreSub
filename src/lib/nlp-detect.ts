// Lightweight NLP.js integration for acknowledgements and affiliation detection
// - Dynamically imports NLP.js so the app still works without it installed
// - Trains a tiny classifier once per session and caches it

type NlpProcessResult = {
  intent: string;
  score: number;
};

let nlpManager: any | null = null;
let initPromise: Promise<void> | null = null;

async function ensureNlp() {
  if (nlpManager) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Dynamic imports keep bundle slim if NLP is unused
    const [{ Nlp }, { LangEn }] = await Promise.all([
      import('@nlpjs/basic'),
      import('@nlpjs/lang-en-min'),
    ]);

    // Build a minimal container + NLP with English support
    const nlp = new Nlp({ languages: ['en'] });
    // Register English tools (tokenizer, stemmer)
    // LangEn attaches itself when instantiated
    void new LangEn();

    // Acknowledgements intent
    const ackUtterances = [
      'we thank {org}',
      'we thank the {org}',
      'we acknowledge {org}',
      'i thank {person}',
      'i would like to thank {person}',
      'acknowledgements',
      'acknowledgments',
      'the authors thank {org}',
      'this work was supported by {org}',
      'this research was supported by {org}',
      'funded by {org}',
      'supported by grant',
    ];
    const affUtterances = [
      'Department of {org}',
      '{org} Department',
      'University of {org}',
      '{org} University',
      '{org} Institute',
      '{org} Laboratory',
      '{org} Hospital',
      '{org} Center',
      '{org} Centre',
      '{org} School of {org}',
      '{org} Inc.',
      '{org} LLC',
      '{org} Ltd.',
    ];

    // Basic placeholder entity for org/person words; improves classifier tokenization
    const orgSeeds = [
      'University', 'College', 'Institute', 'Department', 'Laboratory', 'Hospital', 'Center', 'Centre',
      'School', 'Company', 'Inc', 'Ltd', 'LLC', 'GmbH', 'CNRS', 'Max Planck', 'Oxford', 'Cambridge',
      'Harvard', 'Stanford', 'MIT', 'Caltech', 'ETH', 'Tsinghua', 'Peking', 'National Laboratory',
    ];
    const personSeeds = ['authors', 'author', 'colleagues', 'reviewers', 'editor'];

    // Using the built-in Nlp.addDocument API
    for (const u of ackUtterances) nlp.addDocument('en', u, 'acknowledgement');
    for (const u of affUtterances) nlp.addDocument('en', u, 'affiliation');

    // Seed entities in training set to help features
    for (const org of orgSeeds) nlp.addDocument('en', `the ${org}`, 'affiliation');
    for (const p of personSeeds) nlp.addDocument('en', `we thank the ${p}`, 'acknowledgement');

    // Add a few negatives to reduce false positives
    const negatives = [
      'we present a method',
      'in this paper we show',
      'introduction',
      'related work',
      'conclusion',
    ];
    for (const n of negatives) nlp.addDocument('en', n, 'other');

    await nlp.train();
    nlpManager = nlp;
  })();

  return initPromise;
}

function splitSentences(text: string): string[] {
  return (text || '')
    .replace(/\u00AD/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
}

export type NlpFindings = {
  ackSentences: string[];
  affSentences: string[];
};

export async function detectWithNlp(text: string): Promise<NlpFindings | null> {
  try {
    await ensureNlp();
  } catch (e) {
    // NLP not available (deps missing) — gracefully skip
    return null;
  }

  if (!nlpManager) return null;

  const sentences = splitSentences(text);
  const ack: string[] = [];
  const aff: string[] = [];
  const minLen = 12;
  const maxLen = 500;
  const threshold = 0.68;

  for (const s of sentences) {
    if (s.length < minLen || s.length > maxLen) continue;
    // Process using the trained classifier
    const res: NlpProcessResult = await nlpManager.process('en', s);
    const intent = res?.intent || 'other';
    const score = typeof res?.score === 'number' ? res.score : 0;
    if (intent === 'acknowledgement' && score >= threshold) ack.push(s);
    else if (intent === 'affiliation' && score >= threshold) aff.push(s);
  }

  return {
    ackSentences: Array.from(new Set(ack)),
    affSentences: Array.from(new Set(aff)),
  };
}
