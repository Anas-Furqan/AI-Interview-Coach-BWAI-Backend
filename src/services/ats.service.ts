import pdf from 'pdf-parse';
import { generateContentWithRetry } from './gemini.service';

interface AtsAnalysis {
  score: number;
  missingKeywords: string[];
  formattingImprovements: string[];
  summary: string;
}

function buildFallbackAnalysis(text: string): AtsAnalysis {
  const normalized = text.toLowerCase();
  const mustHave = ['experience', 'education', 'skills', 'project', 'achievement'];
  const present = mustHave.filter(keyword => normalized.includes(keyword));
  const missing = mustHave.filter(keyword => !normalized.includes(keyword));

  const lengthSignal = Math.min(20, Math.floor(text.length / 250));
  const structureSignal = Math.min(20, present.length * 4);
  const score = Math.max(40, Math.min(92, 45 + lengthSignal + structureSignal));

  return {
    score,
    missingKeywords: (missing.length > 0 ? missing : ['leadership', 'impact', 'optimization', 'stakeholder', 'results']).slice(0, 5),
    formattingImprovements: [
      'Use concise bullet points with measurable outcomes.',
      'Keep section headings consistent and ATS-friendly.',
      'Avoid dense paragraphs; improve whitespace and readability.',
    ],
    summary: 'AI fallback analysis was used. Add quantified achievements, role-specific keywords, and clear section structure for stronger ATS compatibility.',
  };
}

export async function analyzeResume(buffer: Buffer) {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Resume file is empty.');
    }

    console.log('Parsing PDF... Buffer size:', buffer.length);
    const data = await pdf(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text extracted from PDF. Please ensure the PDF contains readable text.');
    }

    console.log('PDF parsed successfully. Text length:', data.text.length);
    const text = data.text;

    const prompt = `
    Analyze the following resume text and provide a detailed ATS (Applicant Tracking System) scorecard.
    Resume Text: """${text}"""

    Please provide the response in valid JSON format with the following keys:
    - score: a number from 1 to 100.
    - missingKeywords: an array of 5 missing keywords.
    - formattingImprovements: an array of 3 formatting improvements.
    - summary: a brief summary of the analysis.

    Respond with ONLY the JSON object.
  `;

    console.log('Calling Gemini API for ATS analysis...');
    try {
      const responseText = await generateContentWithRetry(prompt);
      console.log('Gemini response received:', responseText.substring(0, 100));

      // Clean up response text in case it contains markdown blocks
      const cleanedJson = responseText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedJson);
    } catch (modelError) {
      console.error('Gemini ATS analysis failed, using fallback:', modelError);
      return buildFallbackAnalysis(text);
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error occurred during resume analysis';
    console.error('ATS Service Error:', errorMessage, error);
    throw new Error(errorMessage || 'Failed to analyze resume. Please try again.');
  }
}
