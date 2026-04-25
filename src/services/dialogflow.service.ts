import { SessionsClient } from '@google-cloud/dialogflow';
import { env } from '../config/env';
import { resolveGoogleCredentials } from '../config/gcpCredentials';

const credentials = resolveGoogleCredentials();
const dialogflowClient = credentials ? new SessionsClient({ credentials }) : new SessionsClient();

type DetectIntentPayload = {
  sessionId: string;
  message: string;
  languageCode?: string;
};

function resolveDialogflowProjectId(): string {
  return env.dialogflowProjectId || credentials?.project_id || '';
}

function extractFulfillmentText(response: any): string {
  const directText = String(response?.queryResult?.fulfillmentText || '').trim();
  if (directText) return directText;

  const messages = response?.queryResult?.fulfillmentMessages || [];
  const fallback = messages
    .map((item: any) => item?.text?.text || [])
    .flat()
    .map((item: string) => String(item || '').trim())
    .filter(Boolean)
    .join('\n');

  return fallback || "I couldn't generate a response right now.";
}

export async function detectDialogflowIntent(payload: DetectIntentPayload): Promise<string> {
  const projectId = resolveDialogflowProjectId();
  if (!projectId) {
    throw new Error('DIALOGFLOW_PROJECT_ID is missing. Set it in backend environment variables.');
  }

  const languageCode = payload.languageCode || env.dialogflowLanguageCode;
  const sessionPath = dialogflowClient.projectAgentSessionPath(projectId, payload.sessionId);

  const [result] = await dialogflowClient.detectIntent({
    session: sessionPath,
    queryInput: {
      text: {
        text: payload.message,
        languageCode,
      },
    },
  });

  return extractFulfillmentText(result);
}
