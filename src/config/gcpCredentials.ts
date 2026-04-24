import { env } from './env';

type ParsedCredentials = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

function parseJsonCredentials(raw: string): ParsedCredentials | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ParsedCredentials;
    const hasRequired = Boolean(parsed.project_id && parsed.client_email && parsed.private_key);
    if (!hasRequired) return null;
    return {
      ...parsed,
      private_key: String(parsed.private_key || '').replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

export function resolveGoogleCredentials(): ParsedCredentials | undefined {
  const explicit = parseJsonCredentials(env.gcpCredentialsJson);
  if (explicit) return explicit;

  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return {
      type: 'service_account',
      project_id: env.firebaseProjectId,
      client_email: env.firebaseClientEmail,
      private_key: env.firebasePrivateKey.replace(/\\n/g, '\n'),
    };
  }

  return undefined;
}
