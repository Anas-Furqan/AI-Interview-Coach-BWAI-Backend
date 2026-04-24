import pdf from 'pdf-parse';
import { generateContentWithRetry } from './gemini.service';

export async function analyzeResume(buffer: Buffer) {
  const data = await pdf(buffer);
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

  const responseText = await generateContentWithRetry(prompt);
  try {
    // Clean up response text in case it contains markdown blocks
    const cleanedJson = responseText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error('Failed to parse Gemini response for ATS check:', responseText);
    throw new Error('Failed to analyze resume. Please try again.');
  }
}
