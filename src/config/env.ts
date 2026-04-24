import dotenv from 'dotenv';

dotenv.config();

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable not set.');
}

export const env = {
  port: Number(process.env.PORT || 8080),
  geminiApiKey: process.env.GEMINI_API_KEY,
  gcpCredentialsJson: process.env.GCP_CREDENTIALS_JSON || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS),
  adminEmails: parseCsv(process.env.ADMIN_EMAILS).map(email => email.toLowerCase()),
  allowVercelPreviews: String(process.env.ALLOW_VERCEL_PREVIEWS || 'false').toLowerCase() === 'true',
};
