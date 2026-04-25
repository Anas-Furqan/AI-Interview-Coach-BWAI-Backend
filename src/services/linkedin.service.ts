import pdf from 'pdf-parse';
import { generateContentWithRetry } from './gemini.service';

interface LinkedInSectionScore {
  score: number;
  strengths: string[];
  gaps: string[];
  actionItems: string[];
}

export interface LinkedInOptimizerResult {
  overallScore: number;
  profileLevel: 'Needs Work' | 'Fair' | 'Strong' | 'Outstanding';
  summary: string;
  sectionBreakdown: {
    headline: LinkedInSectionScore;
    about: LinkedInSectionScore;
    experience: LinkedInSectionScore;
    skills: LinkedInSectionScore;
  };
  missingKeywords: string[];
  actionItems: string[];
  quickWins: string[];
  longTermImprovements: string[];
}

function parseModelJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error('Model response did not contain valid JSON.');
    }
    return JSON.parse(objectMatch[0]) as T;
  }
}

function normalizeScore(score: unknown, fallback: number): number {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeStringArray(value: unknown, minItems = 0): string[] {
  const array = Array.isArray(value) ? value : [];
  const normalized = array
    .map(item => String(item || '').trim())
    .filter(Boolean);

  if (normalized.length >= minItems) {
    return normalized;
  }

  return normalized;
}

function estimateScoreFromText(text: string): number {
  const normalized = text.toLowerCase();
  const signalKeywords = [
    'headline',
    'about',
    'experience',
    'skills',
    'impact',
    'achieved',
    '%',
    'built',
    'led',
  ];

  const hits = signalKeywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
  const lengthFactor = Math.min(28, Math.floor(text.length / 180));
  const keywordFactor = Math.min(32, hits * 4);
  return Math.max(30, Math.min(92, 35 + lengthFactor + keywordFactor));
}

function fallbackResult(text: string): LinkedInOptimizerResult {
  const overallScore = estimateScoreFromText(text);

  return {
    overallScore,
    profileLevel: overallScore >= 85 ? 'Outstanding' : overallScore >= 70 ? 'Strong' : overallScore >= 50 ? 'Fair' : 'Needs Work',
    summary:
      'Fallback analysis was used because AI parsing failed. Your profile needs stronger positioning, more measurable achievements, and clearer keyword targeting for recruiters.',
    sectionBreakdown: {
      headline: {
        score: Math.max(35, overallScore - 12),
        strengths: ['Professional identity is partially visible.'],
        gaps: ['Headline lacks niche value proposition and keyword density.'],
        actionItems: [
          'Use a niche-specific headline formula: Role + Domain + Outcome.',
          'Add 2-3 target hiring keywords directly in the headline.',
        ],
      },
      about: {
        score: Math.max(30, overallScore - 10),
        strengths: ['Profile includes background context.'],
        gaps: ['About section does not clearly communicate quantified impact.'],
        actionItems: [
          'Rewrite About section in first person with a 3-part structure: expertise, evidence, mission.',
          'Add at least 2 quantified outcomes with business impact.',
        ],
      },
      experience: {
        score: Math.max(35, overallScore - 8),
        strengths: ['Experience timeline appears to be present.'],
        gaps: ['Bullets are not consistently achievement-first or metric-driven.'],
        actionItems: [
          'Convert each bullet into Action + Context + Result format.',
          'Ensure each role has 3-5 impact bullets with numbers.',
        ],
      },
      skills: {
        score: Math.max(30, overallScore - 14),
        strengths: ['Some skill coverage is visible.'],
        gaps: ['Skill keywords are not clearly mapped to target role search intent.'],
        actionItems: [
          'Prioritize top 15 skills based on target role job descriptions.',
          'Add both technical and domain-specific strategic skills.',
        ],
      },
    },
    missingKeywords: ['Stakeholder management', 'Performance optimization', 'System design', 'Cross-functional leadership', 'Business impact'],
    actionItems: [
      'Rewrite headline to include role, specialization, and measurable value.',
      'Start About section with a one-line positioning statement.',
      'Add quantified impact in every Experience entry.',
      'Replace task-only bullets with achievement-driven bullets.',
      'Align top skills to target role job descriptions.',
      'Include at least one leadership or ownership example.',
      'Use recruiter-friendly keyword phrasing in About and Experience.',
      'Add one portfolio or project proof point with outcomes.',
      'Ensure profile language is concise and ATS-friendly.',
      'Reorder sections to emphasize strongest evidence first.',
    ],
    quickWins: [
      'Update headline with role-specific keywords today.',
      'Add 2 quantified results in About section.',
      'Improve first two experience bullets with measurable impact.',
    ],
    longTermImprovements: [
      'Build stronger narrative across all roles with progressive responsibility.',
      'Collect recommendations and endorsements aligned to top skills.',
      'Continuously refresh profile with new projects and outcomes each quarter.',
    ],
  };
}

function normalizeSection(value: unknown, fallbackScore: number): LinkedInSectionScore {
  const section = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  return {
    score: normalizeScore(section.score, fallbackScore),
    strengths: normalizeStringArray(section.strengths),
    gaps: normalizeStringArray(section.gaps),
    actionItems: normalizeStringArray(section.actionItems),
  };
}

function normalizeResult(raw: LinkedInOptimizerResult, sourceText: string): LinkedInOptimizerResult {
  const fallback = fallbackResult(sourceText);
  const overallScore = normalizeScore(raw?.overallScore, fallback.overallScore);
  const profileLevel =
    overallScore >= 85 ? 'Outstanding' : overallScore >= 70 ? 'Strong' : overallScore >= 50 ? 'Fair' : 'Needs Work';

  const sectionBreakdown = {
    headline: normalizeSection(raw?.sectionBreakdown?.headline, fallback.sectionBreakdown.headline.score),
    about: normalizeSection(raw?.sectionBreakdown?.about, fallback.sectionBreakdown.about.score),
    experience: normalizeSection(raw?.sectionBreakdown?.experience, fallback.sectionBreakdown.experience.score),
    skills: normalizeSection(raw?.sectionBreakdown?.skills, fallback.sectionBreakdown.skills.score),
  };

  const actionItems = normalizeStringArray(raw?.actionItems, 10);

  return {
    overallScore,
    profileLevel,
    summary: String(raw?.summary || fallback.summary),
    sectionBreakdown,
    missingKeywords: normalizeStringArray(raw?.missingKeywords).slice(0, 20),
    actionItems: actionItems.length >= 10 ? actionItems : fallback.actionItems,
    quickWins: normalizeStringArray(raw?.quickWins).slice(0, 8),
    longTermImprovements: normalizeStringArray(raw?.longTermImprovements).slice(0, 8),
  };
}

export async function analyzeLinkedInProfile(options: {
  pdfBuffer?: Buffer;
  rawText?: string;
}): Promise<LinkedInOptimizerResult> {
  let sourceText = String(options.rawText || '').trim();

  if (options.pdfBuffer && options.pdfBuffer.length > 0) {
    const parsed = await pdf(options.pdfBuffer);
    sourceText = `${sourceText}\n${String(parsed.text || '').trim()}`.trim();
  }

  if (!sourceText) {
    throw new Error('Please upload a LinkedIn PDF export or provide profile text.');
  }

  const prompt = `
You are a senior LinkedIn career strategist. Analyze the candidate's LinkedIn profile content using Careerflow-style standards.

PROFILE CONTENT:
"""${sourceText}"""

Produce only valid JSON with these exact keys:
- overallScore: number (0-100)
- profileLevel: one of ["Needs Work", "Fair", "Strong", "Outstanding"]
- summary: string (4-6 sentences)
- sectionBreakdown: object with keys headline, about, experience, skills. Each section must include:
  - score: number (0-100)
  - strengths: string[] (at least 2)
  - gaps: string[] (at least 2)
  - actionItems: string[] (at least 3)
- missingKeywords: string[] (8-15 role-relevant keywords)
- actionItems: string[] (at least 12 specific bullet-point improvements)
- quickWins: string[] (3-5 immediate improvements)
- longTermImprovements: string[] (3-5 strategic improvements)

Rules:
- Be direct and specific.
- Recommend measurable improvements.
- Experience bullets must emphasize action + metric + impact.
- Skills guidance must include keyword strategy for recruiter search and ATS alignment.
- Do not include markdown or prose outside the JSON object.
`;

  try {
    const rawResponse = await generateContentWithRetry(prompt);
    const parsed = parseModelJson<LinkedInOptimizerResult>(rawResponse);
    return normalizeResult(parsed, sourceText);
  } catch (error) {
    console.error('LinkedIn optimizer model analysis failed, using fallback:', error);
    return fallbackResult(sourceText);
  }
}
