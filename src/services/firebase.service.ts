// Firebase is recommended for hackathon speed (auth + Firestore).
// This service file is the integration point for initialization and helpers.

export interface SessionAnalyticsRecord {
  userId: string;
  role: string;
  language: string;
  finalScore: number;
  createdAt: string;
}

export async function saveSessionAnalytics(_record: SessionAnalyticsRecord): Promise<void> {
  // TODO: Wire firebase-admin and persist to Firestore collection "session_analytics".
}
