import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { env } from '../config/env';
import { InterviewContext } from '../models/interview.models';

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const genAI = new GoogleGenerativeAI(env.geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', safetySettings });

export async function generateContentWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      if (error.status === 503 || error.status === 500) {
        attempt += 1;
        if (attempt >= maxRetries) throw error;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to generate content after retries.');
}

export async function extractCandidateName(cvText: string): Promise<string> {
  const namePrompt = `From the following CV text, extract the candidate's full name. Respond with ONLY the name and nothing else. If you cannot find a name, respond with 'Candidate'. CV Text: """${cvText}"""`;
  try {
    const response = await model.generateContent(namePrompt);
    return response.response.text().trim() || 'Candidate';
  } catch {
    return 'Candidate';
  }
}

export function buildInterviewerPrompt(currentPhase: string, context: InterviewContext): { prompt: string; nextPhase: string } {
  const lang = context.language;
  const isUrdu = /urdu|ur/i.test(lang);
  const langInstruction = isUrdu
    ? 'IMPORTANT: Reply in natural Urdu written in Urdu script (not Roman Urdu).'
    : `IMPORTANT: Reply in ${lang}.`;

  const professional = 'You must remain professional, respectful, unbiased, and interview-appropriate.';
  const pakistanContext = 'Use Pakistani hiring context where relevant (Systems Ltd, HBL, Jazz, Unilever Pakistan).';
  const summaryContext = context.profileSummary ? `Candidate summary: """${context.profileSummary}"""` : '';

  if (currentPhase === 'GREETING') {
    const nameTag = context.userName && context.userName !== 'Candidate' ? `, ${context.userName}` : '';
    return {
      prompt: `${langInstruction} ${professional} ${pakistanContext} Start the interview for ${context.role}. Greet the candidate${nameTag} and ask for a concise introduction. ${summaryContext}`,
      nextPhase: 'INTRODUCTION',
    };
  }

  if (currentPhase === 'INTRODUCTION') {
    return {
      prompt: `${langInstruction} ${professional} ${pakistanContext} Candidate intro: "${context.userAnswer}". Ask the next experience question using CV and summary context. CV: """${context.cvText}""" ${summaryContext}`,
      nextPhase: 'EXPERIENCE',
    };
  }

  if (parseInt(context.expQuestionsAsked, 10) < parseInt(context.numExpQuestions, 10)) {
    const nextPhase = parseInt(context.expQuestionsAsked, 10) + 1 >= parseInt(context.numExpQuestions, 10) ? 'ROLE_SPECIFIC' : 'EXPERIENCE';
    return {
      prompt: `${langInstruction} ${professional} ${pakistanContext} Candidate answer: "${context.userAnswer}". Ask experience question ${parseInt(context.expQuestionsAsked, 10) + 1}/${context.numExpQuestions}. CV: """${context.cvText}"""`,
      nextPhase,
    };
  }

  if (parseInt(context.roleQuestionsAsked, 10) < parseInt(context.numRoleQuestions, 10)) {
    const nextPhase = parseInt(context.roleQuestionsAsked, 10) + 1 >= parseInt(context.numRoleQuestions, 10) ? 'PERSONALITY' : 'ROLE_SPECIFIC';
    const jdContext = context.jobDescription ? `Use this job description: """${context.jobDescription}"""` : `Ask a realistic ${context.role} role-specific question.`;
    return {
      prompt: `${langInstruction} ${professional} ${pakistanContext} Candidate answer: "${context.userAnswer}". ${jdContext}`,
      nextPhase,
    };
  }

  if (parseInt(context.personalityQuestionsAsked, 10) < parseInt(context.numPersonalityQuestions, 10)) {
    const nextPhase = parseInt(context.personalityQuestionsAsked, 10) + 1 >= parseInt(context.numPersonalityQuestions, 10) ? 'CLOSING' : 'PERSONALITY';
    return {
      prompt: `${langInstruction} ${professional} ${pakistanContext} Ask a fresh personality/behavioral question and avoid repeating earlier ones from history: """${context.fullChatHistory || ''}"""`,
      nextPhase,
    };
  }

  return {
    prompt: `${langInstruction} ${professional} Interview complete. Thank ${context.userName} and explain next steps without specific timeline.`,
    nextPhase: 'FINISHED',
  };
}

export function buildPostAnswerPrompt(language: string, lastQuestion: string, userAnswer: string): string {
  return `You are a career coach. The question was: "${lastQuestion}" and candidate answered: "${userAnswer}". Respond only as valid JSON in ${language} with keys score (0-10) and feedback (2-3 concise sentences).`;
}

export function buildPreAnswerPrompt(language: string, question: string, cvText: string, profileSummary?: string): string {
  const summary = profileSummary ? `Candidate summary: """${profileSummary}"""` : '';
  return `You are a career coach. For question "${question}", provide guidance for candidate based on CV and summary. CV: """${cvText}""" ${summary}. Respond only as valid JSON in ${language} with keys hint and exampleAnswer.`;
}
