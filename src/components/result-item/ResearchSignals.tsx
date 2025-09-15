import { useState } from 'react';
import type { ProcessedFile } from '../../App';

interface ResearchSignalsProps {
  result: ProcessedFile;
}

export function ResearchSignals({ result }: ResearchSignalsProps) {
  const [ackDismissed, setAckDismissed] = useState<Set<string>>(new Set());
  const [affDismissed, setAffDismissed] = useState<Set<string>>(new Set());

  const metaAny = result.metadata as any;
  const ackDetected = Boolean(metaAny.acknowledgementsDetected);
  const ackExcerpt = typeof metaAny.acknowledgementsExcerpt === 'string' ? metaAny.acknowledgementsExcerpt : '';
  const fundingDetected = Boolean(metaAny.fundingDetected);
  const fundingMentions: string[] = Array.isArray(metaAny.fundingMentions) ? metaAny.fundingMentions : [];
  const grantIds: string[] = Array.isArray(metaAny.grantIds) ? metaAny.grantIds : [];
  const affiliationsDetected = Boolean(metaAny.affiliationsDetected);
  const affiliationsGuesses: string[] = Array.isArray(metaAny.affiliationsGuesses) ? metaAny.affiliationsGuesses : [];
  const hasResearchSignals = ackDetected || fundingDetected || affiliationsDetected;
  const researchFindings = (result as any).researchFindings as
    | { acknowledgements: Array<{ text: string; pages: number[] }>; affiliations: Array<{ text: string; pages: number[] }> }
    | undefined;

  if (!hasResearchSignals && !researchFindings) return null;

  return (
    <div id="research-signals" className="scroll-mt-16">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Research Signals</h3>
      <div className="space-y-4">
        {/* Acknowledgements with actions */}
        {ackDetected && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex items-start gap-2">
              <span aria-hidden className="material-symbols-outlined text-gray-600">handshake</span>
              <div className="min-w-0 w-full">
                {(() => {
                  const items = researchFindings?.acknowledgements || [];
                  const fileType = String((result.metadata as any).fileType || '').toUpperCase();
                  const useLineLabel = fileType === 'JSON' || fileType === 'MARKDOWN' || fileType === 'CSV';
                  const fileNameLower = result.fileName.toLowerCase();
                  const isPdf = fileType === 'PDF' || fileNameLower.endsWith('.pdf');
                  const isDoc = fileType.includes('MICROSOFT WORD DOCUMENT') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
                  const isPpt = fileType.includes('POWERPOINT') || fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt');
                  const positionLabel = useLineLabel ? 'Line' : isPdf || isDoc ? 'Page(s)' : isPpt ? 'Slide(s)' : 'Pages';
                  const flaggedCount = Math.max(0, items.length - ackDismissed.size);
                  return (
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Acknowledgements <span className="ml-1 text-xs text-gray-600">({flaggedCount} mentions)</span></p>
                      {items.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {items.map((it, i) => {
                            const id = `${it.text}:${it.pages.join('|')}`;
                            const dismissed = ackDismissed.has(id);
                            return (
                              <li key={i} className={`flex items-start gap-3 ${dismissed ? 'opacity-70' : ''}`}>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm ${dismissed ? 'text-gray-400 line-through' : 'text-gray-700'} break-words`}>{it.text}</p>
                                  <p className={`text-xs ${dismissed ? 'text-gray-300 line-through' : 'text-gray-500'} mt-0.5`}>{positionLabel}: {it.pages.join(', ')}</p>
                                </div>
                                <div className="shrink-0">
                                  {!dismissed ? (
                                    <button type="button" onClick={() => setAckDismissed((prev) => { const n = new Set(prev); n.add(id); return n; })} className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer">Dismiss</button>
                                  ) : (
                                    <button type="button" onClick={() => setAckDismissed((prev) => { const n = new Set(prev); n.delete(id); return n; })} className="text-xs text-gray-600 hover:text-gray-800 underline underline-offset-2 cursor-pointer">Flag</button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">Acknowledgements section or phrasing detected.</p>
                          {ackExcerpt && <p className="mt-1 text-sm text-gray-700 break-words">{ackExcerpt}</p>}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {fundingDetected && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex items-start gap-2">
              <span aria-hidden className="material-symbols-outlined text-gray-600">payments</span>
              <div className="min-w-0 w-full">
                <p className="text-sm font-semibold text-gray-800">Funding</p>
                {fundingMentions.length > 0 ? (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-700">
                    {fundingMentions.map((f, i) => (
                      <li key={i} className="break-words">{f}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">Funding statements detected.</p>
                )}
                {!!grantIds.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {grantIds.map((g, i) => (
                      <span key={i} className="text-xs bg-white text-gray-800 border border-gray-300 rounded-md px-2 py-1">{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Affiliations with actions */}
        {affiliationsDetected && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex items-start gap-2">
              <span aria-hidden className="material-symbols-outlined text-gray-600">account_balance</span>
              <div className="min-w-0 w-full">
                {(() => {
                  const items = researchFindings?.affiliations || [];
                  const fileType = String((result.metadata as any).fileType || '').toUpperCase();
                  const useLineLabel = fileType === 'JSON' || fileType === 'MARKDOWN' || fileType === 'CSV';
                  const fileNameLower = result.fileName.toLowerCase();
                  const isPdf = fileType === 'PDF' || fileNameLower.endsWith('.pdf');
                  const isDoc = fileType.includes('MICROSOFT WORD DOCUMENT') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
                  const isPpt = fileType.includes('POWERPOINT') || fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt');
                  const positionLabel = useLineLabel ? 'Line' : isPdf || isDoc ? 'Page(s)' : isPpt ? 'Slide(s)' : 'Pages';
                  const flaggedCount = Math.max(0, items.length - affDismissed.size);
                  return (
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Affiliations <span className="ml-1 text-xs text-gray-600">({flaggedCount} mentions)</span></p>
                      {items.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {items.map((it, i) => {
                            const id = `${it.text}:${it.pages.join('|')}`;
                            const dismissed = affDismissed.has(id);
                            return (
                              <li key={i} className={`flex items-start gap-3 ${dismissed ? 'opacity-70' : ''}`}>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm ${dismissed ? 'text-gray-400 line-through' : 'text-gray-700'} break-words`}>{it.text}</p>
                                  <p className={`text-xs ${dismissed ? 'text-gray-300 line-through' : 'text-gray-500'} mt-0.5`}>{positionLabel}: {it.pages.join(', ')}</p>
                                </div>
                                <div className="shrink-0">
                                  {!dismissed ? (
                                    <button type="button" onClick={() => setAffDismissed((prev) => { const n = new Set(prev); n.add(id); return n; })} className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer">Dismiss</button>
                                  ) : (
                                    <button type="button" onClick={() => setAffDismissed((prev) => { const n = new Set(prev); n.delete(id); return n; })} className="text-xs text-gray-600 hover:text-gray-800 underline underline-offset-2 cursor-pointer">Flag</button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">Affiliation cues detected near author block.</p>
                          {affiliationsGuesses.length > 0 && (
                            <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-700">
                              {affiliationsGuesses.map((a, i) => (
                                <li key={i} className="break-words">{a}</li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
