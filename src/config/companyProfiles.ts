export interface CompanyProfile {
  company: string;
  interviewStyle: string;
  focusAreas: string[];
  opener: string;
}

const companyProfiles: CompanyProfile[] = [
  { company: 'Google', interviewStyle: 'structured, systems-heavy, and evidence-driven', focusAreas: ['problem solving', 'clarity', 'ownership'], opener: 'Prioritize scale, rigor, and tradeoff reasoning.' },
  { company: 'Amazon', interviewStyle: 'Leadership Principles-first and bar-raiser focused', focusAreas: ['customer obsession', 'bias for action', 'dive deep'], opener: 'Probe for STAR examples tied to leadership principles.' },
  { company: 'McKinsey', interviewStyle: 'case-style, concise, and commercial', focusAreas: ['structured thinking', 'client impact', 'business judgment'], opener: 'Favor crisp frameworks and quantified outcomes.' },
  { company: 'HBL', interviewStyle: 'stakeholder-aware, process-focused, and compliance-minded', focusAreas: ['risk awareness', 'service mindset', 'execution'], opener: 'Keep examples grounded in banking operations and trust.' },
];

export function getCompanyProfile(targetCompany?: string): CompanyProfile | null {
  if (!targetCompany) return null;
  const normalized = targetCompany.trim().toLowerCase();
  return companyProfiles.find(profile => normalized.includes(profile.company.toLowerCase())) || null;
}
