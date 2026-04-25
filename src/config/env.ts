import dotenv from 'dotenv';

dotenv.config();

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT || 8000),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  gcpCredentialsJson: process.env.GCP_CREDENTIALS_JSON || '',
  gcpCredentialsPath: process.env.GCP_CREDENTIALS_PATH || '',
  dialogflowProjectId: process.env.DIALOGFLOW_PROJECT_ID || '',
  dialogflowClientEmail: process.env.DIALOGFLOW_CLIENT_EMAIL || '',
  dialogflowPrivateKey: process.env.DIALOGFLOW_PRIVATE_KEY || '',
  dialogflowLanguageCode: process.env.DIALOGFLOW_LANGUAGE_CODE || 'en',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS),
  adminEmails: parseCsv(process.env.ADMIN_EMAILS).map(email => email.toLowerCase()),
  allowVercelPreviews: String(process.env.ALLOW_VERCEL_PREVIEWS || 'false').toLowerCase() === 'true',
};
