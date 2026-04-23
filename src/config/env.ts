import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable not set.');
}

if (!process.env.GCP_CREDENTIALS_JSON) {
  throw new Error('GCP_CREDENTIALS_JSON environment variable not set.');
}

export const env = {
  port: Number(process.env.PORT || 8080),
  geminiApiKey: process.env.GEMINI_API_KEY,
  gcpCredentialsJson: process.env.GCP_CREDENTIALS_JSON,
};
