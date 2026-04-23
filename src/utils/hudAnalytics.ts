export interface HudMetrics {
  fillerCount: number;
  wpm: number;
  confidenceScore: number;
  actionVerbDensity: number;
  panicFlag: boolean;
}

const EN_FILLERS = ['um', 'uh', 'like', 'basically', 'you know', 'actually', 'right', 'so'];
const UR_FILLERS = ['haan', 'matlab', 'jese', 'bas', 'acha', 'yani'];
const ACTION_VERBS = [
  'led', 'built', 'scaled', 'delivered', 'reduced', 'improved', 'launched', 'designed',
  'managed', 'increased', 'created', 'developed', 'optimized', 'drove', 'achieved', 'implemented'
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function computeHudMetrics(transcript: string, startTime: number, languageCode = 'en-US'): HudMetrics {
  const normalized = transcript.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const fillers = languageCode.startsWith('ur') ? UR_FILLERS : EN_FILLERS;

  const fillerCount = words.filter(w => fillers.includes(w)).length;
  const actionVerbCount = words.filter(w => ACTION_VERBS.includes(w)).length;

  const elapsed = (Date.now() - startTime) / 60000;
  const wpm = elapsed > 0 ? Math.round(words.length / elapsed) : 0;

  let confidenceScore = 100 - Math.min(fillerCount * 3, 40) - (wpm > 180 ? 15 : 0) - (wpm < 80 && words.length > 20 ? 10 : 0) + Math.min(actionVerbCount * 2, 20) + (words.length > 60 ? 5 : 0);
  confidenceScore = clamp(Math.round(confidenceScore), 0, 100);

  const actionVerbDensity = words.length ? Math.round((actionVerbCount / words.length) * 100) : 0;
  const panicFlag = /\b(\w+)\s+\1\b/i.test(normalized) || (normalized.match(/\.\.\.|,/g) || []).length > 5;

  return {
    fillerCount,
    wpm,
    confidenceScore,
    actionVerbDensity,
    panicFlag,
  };
}
