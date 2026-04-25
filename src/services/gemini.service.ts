import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { env } from '../config/env';
import { InterviewContext } from '../models/interview.models';
import { getCompanyProfile } from '../config/companyProfiles';

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const geminiApiKey = String(env.geminiApiKey || '').trim();
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
function normalizeModelName(value?: string): string {
  return String(value || '')
    .trim()
    .replace(/^models\//i, '');
}

const modelCandidates = [
  normalizeModelName(process.env.GEMINI_MODEL),
  normalizeModelName(process.env.GEMINI_FALLBACK_MODEL),
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
].filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index);
const backoffScheduleMs = [1000, 2000, 4000];

function createModel(modelName: string) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured. Interview generation is unavailable until it is set.');
  }
  return genAI.getGenerativeModel({ model: modelName, safetySettings });
}

function isTransientModelError(error: any): boolean {
  const status = Number(error?.status);
  return status === 429 || status === 500 || status === 503;
}

async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateContentWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  let lastError: unknown = null;

  for (const modelName of modelCandidates) {
    const model = createModel(modelName);

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        lastError = error;

        if (!isTransientModelError(error)) {
          // Non-transient errors can be model-specific (e.g., 404 model not found).
          // Move to next candidate model instead of aborting all generation.
          break;
        }

        const isLastAttemptForModel = attempt >= maxRetries - 1;
        if (isLastAttemptForModel) {
          break;
        }

        await delay(backoffScheduleMs[attempt] || backoffScheduleMs[backoffScheduleMs.length - 1]);
      }
    }
  }

  throw lastError || new Error('Failed to generate content after retries.');
}

export async function extractCandidateName(cvText: string): Promise<string> {
  const namePrompt = `From the following CV text, extract the candidate's full name. Respond with ONLY the name and nothing else. If you cannot find a name, respond with 'Candidate'. CV Text: """${cvText}"""`;
  try {
    const responseText = await generateContentWithRetry(namePrompt, 2);
    return responseText.trim() || 'Candidate';
  } catch {
    try {
      const fallbackModel = createModel(modelCandidates[0]);
      const response = await fallbackModel.generateContent(namePrompt);
      return response.response.text().trim() || 'Candidate';
    } catch {
      return 'Candidate';
    }
  }
}

export function buildInterviewerPrompt(currentPhase: string, context: InterviewContext): { prompt: string; nextPhase: string } {
  const lang = context.language;
  const isUrdu = /urdu|ur/i.test(lang);
  const targetCompany = context.targetCompany ? context.targetCompany : 'a top-tier tech company';
  const rigorContext = `You are a strict, highly technical interviewer at ${targetCompany}. Your questions MUST be highly rigorous and domain-specific. Do NOT accept superficial answers.`;
  const candidateRealityGuard = `CRITICAL ROLE CONTEXT: The person being interviewed is a CANDIDATE applying for a role, not a current employee of ${targetCompany}. Never ask questions that assume they already work there (forbidden examples: "How is it working at ${targetCompany}?", "What did you build at ${targetCompany}?"). Instead ask applicant-facing questions about motivation, fit, and contribution potential (examples: "Why do you want to join ${targetCompany}?", "How would you contribute to ${targetCompany}'s tech stack?").`;
  const langInstruction = isUrdu
    ? 'IMPORTANT: Reply in natural Urdu written in Urdu script (not Roman Urdu).'
    : `IMPORTANT: Reply in ${lang}.`;

  const professional = 'You must remain professional, respectful, unbiased, and interview-appropriate.';
  const pakistanContext = 'Use Pakistani hiring context where relevant (Systems Ltd, HBL, Jazz, Unilever Pakistan).';
  const difficulty = String(context.difficulty || 'MEDIUM').toUpperCase();
  const interviewMode = String(context.interviewMode || 'BEHAVIORAL').toUpperCase();
  const difficultyStyle =
    difficulty === 'EASY'
      ? 'Keep complexity beginner-friendly and focus on fundamentals.'
      : difficulty === 'HARD'
        ? 'Use senior-level depth, include constraints/trade-offs, and probe decision quality.'
        : 'Use realistic mid-level complexity and practical scenarios.';
  const modeStyle =
    interviewMode === 'CODING'
      ? 'You are conducting a coding interview. Ask coding/problem-solving questions and request concise explanations of approach, complexity, and edge cases.'
      : 'You are conducting a behavioral and role-fit interview.';
  const summaryContext = context.profileSummary ? `Candidate summary: """${context.profileSummary}"""` : '';
  const companyContext = context.targetCompany ? `Interview is for a candidate applying to ${context.targetCompany}.` : '';
  const companyProfile = getCompanyProfile(context.targetCompany);
  const companyStyle = companyProfile
    ? `Target company profile: ${companyProfile.company}. Interview style: ${companyProfile.interviewStyle}. Focus areas: ${companyProfile.focusAreas.join(', ')}. Guidance: ${companyProfile.opener}`
    : '';
  const companyTarget = context.targetCompany ? `Adapt tone and examples to ${context.targetCompany}.` : '';
  const applicationFocus = context.targetCompany
    ? `All company-related prompts must evaluate the candidate's readiness to join ${context.targetCompany}, expected value-add, and decision-making in that future role.`
    : 'Ask from an applicant perspective and evaluate readiness for the target role.';
  const brevityDirective = 'Keep each interviewer turn concise: ask one punchy question in 1-2 short sentences.';

  if (currentPhase === 'GREETING') {
    const nameTag = context.userName && context.userName !== 'Candidate' ? `, ${context.userName}` : '';
    return {
      prompt: `${rigorContext} ${candidateRealityGuard} ${applicationFocus} ${langInstruction} ${professional} ${pakistanContext} ${difficultyStyle} ${modeStyle} ${companyContext} ${companyStyle} ${companyTarget} ${brevityDirective} Start the interview for ${context.role}. Greet the candidate${nameTag} and ask for a concise introduction. ${summaryContext}`,
      nextPhase: 'INTRODUCTION',
    };
  }

  if (currentPhase === 'INTRODUCTION') {
    return {
      prompt: `${rigorContext} ${candidateRealityGuard} ${applicationFocus} ${langInstruction} ${professional} ${pakistanContext} ${difficultyStyle} ${modeStyle} ${companyContext} ${companyStyle} ${companyTarget} ${brevityDirective} Candidate intro: "${context.userAnswer}". Ask the next experience question using CV and summary context. CV: """${context.cvText}""" ${summaryContext}`,
      nextPhase: 'EXPERIENCE',
    };
  }

  if (parseInt(context.expQuestionsAsked, 10) < parseInt(context.numExpQuestions, 10)) {
    const nextPhase = parseInt(context.expQuestionsAsked, 10) + 1 >= parseInt(context.numExpQuestions, 10) ? 'ROLE_SPECIFIC' : 'EXPERIENCE';
    return {
      prompt: `${rigorContext} ${candidateRealityGuard} ${applicationFocus} ${langInstruction} ${professional} ${pakistanContext} ${difficultyStyle} ${modeStyle} ${companyContext} ${companyStyle} ${companyTarget} ${brevityDirective} Candidate answer: "${context.userAnswer}". Ask experience question ${parseInt(context.expQuestionsAsked, 10) + 1}/${context.numExpQuestions}. CV: """${context.cvText}"""`,
      nextPhase,
    };
  }

  if (parseInt(context.roleQuestionsAsked, 10) < parseInt(context.numRoleQuestions, 10)) {
    const nextPhase = parseInt(context.roleQuestionsAsked, 10) + 1 >= parseInt(context.numRoleQuestions, 10) ? 'PERSONALITY' : 'ROLE_SPECIFIC';
    const jdContext = context.jobDescription ? `Use this job description: """${context.jobDescription}"""` : `Ask a realistic ${context.role} role-specific question.`;
    const codingModeInstruction = interviewMode === 'CODING'
      ? 'Ask one coding question. Do not provide the solution. Request code plus explanation and time/space complexity.'
      : '';
    return {
      prompt: `${rigorContext} ${candidateRealityGuard} ${applicationFocus} ${langInstruction} ${professional} ${pakistanContext} ${difficultyStyle} ${modeStyle} ${companyContext} ${companyStyle} ${companyTarget} ${brevityDirective} Candidate answer: "${context.userAnswer}". ${jdContext} ${codingModeInstruction}`,
      nextPhase,
    };
  }

  if (parseInt(context.personalityQuestionsAsked, 10) < parseInt(context.numPersonalityQuestions, 10)) {
    const nextPhase = parseInt(context.personalityQuestionsAsked, 10) + 1 >= parseInt(context.numPersonalityQuestions, 10) ? 'CLOSING' : 'PERSONALITY';
    return {
      prompt: `${rigorContext} ${candidateRealityGuard} ${applicationFocus} ${langInstruction} ${professional} ${pakistanContext} ${difficultyStyle} ${modeStyle} ${companyContext} ${companyStyle} ${companyTarget} ${brevityDirective} Ask a fresh personality/behavioral question and avoid repeating earlier ones from history: """${context.fullChatHistory || ''}"""`,
      nextPhase,
    };
  }

  return {
    prompt: `${rigorContext} ${candidateRealityGuard} ${applicationFocus} ${langInstruction} ${professional} ${companyStyle} Interview complete. Thank ${context.userName} and explain next steps without specific timeline.`,
    nextPhase: 'FINISHED',
  };
}

export function buildPostAnswerPrompt(language: string, lastQuestion: string, userAnswer: string, codeAnswer?: string): string {
  const codeSection = codeAnswer?.trim()
    ? `Candidate code submission:\n"""${codeAnswer}"""\nEvaluate correctness, readability, complexity, and edge-case handling.`
    : '';

  const strictRigor = `You are a ruthless, highly technical FAANG interviewer.
DO NOT give generic praise.
If the candidate's answer lacks the STAR method (Situation, Task, Action, Result), deduct points.
You MUST cite a specific sentence the candidate said, and explain technically why it was strong or weak.
Provide a final Selection Probability between 0% and 100%.`;

  return `${strictRigor}
The question was: "${lastQuestion}" and candidate answered: "${userAnswer}".
${codeSection}
Respond only as valid JSON in ${language} with keys: score (0-10), feedback (2-4 concise sentences), evidenceQuote (exact candidate sentence), starMissing (boolean), selectionProbability (0-100).`;
}

export function buildPreAnswerPrompt(language: string, question: string, cvText: string, profileSummary?: string): string {
  const summary = profileSummary ? `Candidate summary: """${profileSummary}"""` : '';
  return `You are a career coach. For question "${question}", provide guidance for candidate based on CV and summary. CV: """${cvText}""" ${summary}. Respond only as valid JSON in ${language} with keys hint and exampleAnswer.`;
}
