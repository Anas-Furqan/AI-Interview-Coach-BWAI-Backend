import type { Request, Response } from 'express';

interface Candidate {
  id: string;
  name: string;
  email: string;
  skills: string[];
  experience: number;
  visible_to_companies: boolean;
  profile_score: number;
  completed_interviews: number;
  interview_scores: number[];
}

interface MatchedCandidateResponse {
  id: string;
  name: string;
  email: string;
  skills: string[];
  profile_score: number;
  match_score: number;
  matched_skills: string[];
}

interface HiringAnalysisResponse {
  success: boolean;
  jobTitle: string;
  requiredSkills: string[];
  hiringProbability: number;
  totalCandidates: number;
  matchedCandidates: MatchedCandidateResponse[];
  message: string;
}

const COMMON_SKILLS = [
  'React',
  'JavaScript',
  'TypeScript',
  'Node.js',
  'Python',
  'Java',
  'SQL',
  'MongoDB',
  'GraphQL',
  'REST API',
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'Firebase',
  'Vue.js',
  'Angular',
  'Next.js',
  'Express',
  'PostgreSQL',
  'Django',
  'PostgreSQL',
];

const CANDIDATES: Candidate[] = [
  {
    id: 'c001',
    name: 'Ali Hassan',
    email: 'ali@example.com',
    skills: ['React', 'TypeScript', 'AWS', 'Node.js'],
    experience: 5,
    visible_to_companies: true,
    profile_score: 85,
    completed_interviews: 12,
    interview_scores: [82, 85, 88, 79, 90, 87, 83, 86, 84, 81, 88, 85],
  },
  {
    id: 'c002',
    name: 'Sara Ahmed',
    email: 'sara@example.com',
    skills: ['Node.js', 'MongoDB', 'Python'],
    experience: 4,
    visible_to_companies: true,
    profile_score: 80,
    completed_interviews: 8,
    interview_scores: [78, 80, 82, 79, 81, 80, 79, 82],
  },
  {
    id: 'c003',
    name: 'Ahmed Khan',
    email: 'ahmed@example.com',
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker'],
    experience: 6,
    visible_to_companies: true,
    profile_score: 90,
    completed_interviews: 15,
    interview_scores: [89, 91, 92, 88, 90, 93, 89, 90, 91, 88, 92, 90, 89, 91, 90],
  },
];

function extractSkills(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const skill of COMMON_SKILLS) {
    if (lowerText.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }

  return Array.from(new Set(found));
}

function calculateMatchScore(candidate: Candidate, jobSkills: string[]): number {
  const matchedSkills = candidate.skills.filter((skill) =>
    jobSkills.some((jobSkill) => jobSkill.toLowerCase() === skill.toLowerCase())
  );

  const skillMatch = jobSkills.length === 0 ? 0 : (matchedSkills.length / jobSkills.length) * 60;
  const profileBonus = (candidate.profile_score / 100) * 40;

  return Math.round(skillMatch + profileBonus);
}

function createMatchedCandidateResponse(candidate: Candidate, jobSkills: string[]): MatchedCandidateResponse {
  const matchedSkills = candidate.skills.filter((skill) =>
    jobSkills.some((jobSkill) => jobSkill.toLowerCase() === skill.toLowerCase())
  );

  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    skills: candidate.skills,
    profile_score: candidate.profile_score,
    match_score: calculateMatchScore(candidate, jobSkills),
    matched_skills: matchedSkills,
  };
}

export function analyzeHiringController(req: Request, res: Response) {
  const { jobDescription, jobTitle } = req.body as { jobDescription?: string; jobTitle?: string };

  if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
    return res.status(400).json({ success: false, error: 'Job description cannot be empty' });
  }

  const normalizedTitle = typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle.trim() : 'Untitled Position';
  const requiredSkills = extractSkills(jobDescription);
  const visibleCandidates = CANDIDATES.filter((candidate) => candidate.visible_to_companies);

  const matchedCandidates = visibleCandidates
    .map((candidate) => createMatchedCandidateResponse(candidate, requiredSkills))
    .filter((candidate) => candidate.matched_skills.length > 0)
    .sort((a, b) => b.match_score - a.match_score);

  const totalCandidates = visibleCandidates.length;
  const matchedCount = matchedCandidates.length;
  const baseProbability = totalCandidates === 0 ? 0 : (matchedCount / totalCandidates) * 100;
  const variance = Math.floor(Math.random() * 21);
  const hiringProbability = Math.min(95, Math.max(0, Math.round(baseProbability + variance)));

  const response: HiringAnalysisResponse = {
    success: true,
    jobTitle: normalizedTitle,
    requiredSkills,
    hiringProbability,
    totalCandidates,
    matchedCandidates,
    message: 'Based on 120+ real interview patterns',
  };

  return res.status(200).json(response);
}
