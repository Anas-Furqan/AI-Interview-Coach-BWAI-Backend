import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { env } from '../config/env';

export interface UpsertUserPayload {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  preferredLanguage?: 'en' | 'ur';
  requestedRole?: 'CANDIDATE' | 'RECRUITER' | 'ADMIN';
}

export interface CreateSessionPayload {
  uid: string;
  roleId: string;
  companyContext: string;
  languageCode: 'en-US' | 'ur-PK';
  status?: 'active' | 'completed';
}

export interface AppendQuestionPayload {
  sessionId: string;
  questionId: string;
  confidence: number;
  wpm: number;
  fillerCount: number;
  panic: boolean;
  starMissing: boolean;
  score: number;
  starStatus?: {
    hasSituation: boolean;
    hasTask: boolean;
    hasAction: boolean;
    hasResult: boolean;
  };
}

export interface FinalizeSessionPayload {
  sessionId: string;
  finalScore: number;
  strengths: string[];
  improvements: string[];
  analytics?: {
    filler_count: number;
    avg_wpm: number;
    star_compliance: number;
    confidence_scores: Array<{ questionId: string; confidence: number; score: number }>;
  } | null;
  transcript?: Array<{
    sender: 'ai' | 'user';
    text: string;
    timestamp?: string;
  }>;
  metricsTimeline?: Array<{
    questionId: string;
    confidence: number;
    wpm: number;
    fillerCount: number;
    panic: boolean;
    score: number;
    createdAt?: string;
  }>;
  videoSnapshots?: string[];
}

export type JobStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateJobPayload {
  title: string;
  company: string;
  logoUrl: string;
  description: string;
  salary: string;
  recruiterId: string;
}

export interface CreateJobApplicationPayload {
  jobId: string;
  recruiterId: string;
  candidateUid: string;
  candidateEmail: string;
  candidateName: string;
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  preferredLanguage: 'en' | 'ur';
  role: 'CANDIDATE' | 'RECRUITER' | 'ADMIN';
}

function requireFirebaseAdminEnv() {
  if (!env.firebaseProjectId || !env.firebaseClientEmail || !env.firebasePrivateKey) {
    throw new Error('Missing Firebase Admin env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
  }
}

function getAdminApp() {
  requireFirebaseAdminEnv();

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey?.replace(/\\n/g, '\n'),
    }),
  });
}

function getFirebaseClients() {
  const app = getAdminApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export async function verifyGoogleIdToken(idToken: string) {
  const { auth } = getFirebaseClients();
  return auth.verifyIdToken(idToken);
}

export async function verifyIdToken(idToken: string) {
  const { auth } = getFirebaseClients();
  return auth.verifyIdToken(idToken);
}

export async function upsertUserProfile(payload: UpsertUserPayload): Promise<'CANDIDATE' | 'RECRUITER' | 'ADMIN'> {
  const { db } = getFirebaseClients();

  const email = String(payload.email || '').toLowerCase();
  const normalizedRequestedRole = String(payload.requestedRole || 'CANDIDATE').toUpperCase();
  const computedRole = env.adminEmails.includes(email)
    ? 'ADMIN'
    : normalizedRequestedRole === 'RECRUITER'
      ? 'RECRUITER'
      : 'CANDIDATE';

  await db.collection('users').doc(payload.uid).set(
    {
      email: payload.email,
      displayName: payload.displayName,
      photoURL: payload.photoURL,
      preferredLanguage: payload.preferredLanguage || 'en',
      role: computedRole,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return computedRole;
}

export async function getUserProfile(uid: string): Promise<UserProfileRecord | null> {
  const { db } = getFirebaseClients();
  const snapshot = await db.collection('users').doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() || {};
  const roleRaw = String(data.role || 'CANDIDATE').toUpperCase();
  const role = roleRaw === 'ADMIN' ? 'ADMIN' : roleRaw === 'RECRUITER' ? 'RECRUITER' : 'CANDIDATE';

  return {
    uid,
    email: String(data.email || ''),
    displayName: String(data.displayName || ''),
    photoURL: String(data.photoURL || ''),
    preferredLanguage: String(data.preferredLanguage || 'en') === 'ur' ? 'ur' : 'en',
    role,
  };
}

export async function updateUserDisplayName(uid: string, displayName: string) {
  const { db } = getFirebaseClients();
  await db.collection('users').doc(uid).set(
    {
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createInterviewSession(payload: CreateSessionPayload): Promise<string> {
  const { db } = getFirebaseClients();
  const ref = await db.collection('sessions').add({
    uid: payload.uid,
    roleId: payload.roleId,
    companyContext: payload.companyContext,
    languageCode: payload.languageCode,
    status: payload.status || 'active',
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function appendQuestionAnalytics(payload: AppendQuestionPayload) {
  const { db } = getFirebaseClients();
  await db.collection('questionAnalytics').add({
    sessionId: payload.sessionId,
    questionId: payload.questionId,
    confidence: payload.confidence,
    wpm: payload.wpm,
    fillerCount: payload.fillerCount,
    panic: payload.panic,
    starMissing: payload.starMissing,
    score: payload.score,
    starStatus: payload.starStatus || null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function finalizeInterviewSession(payload: FinalizeSessionPayload) {
  const { db } = getFirebaseClients();
  await db.collection('sessions').doc(payload.sessionId).set(
    {
      status: 'completed',
      finalScore: payload.finalScore,
      strengths: payload.strengths,
      improvements: payload.improvements,
      transcript: payload.transcript || [],
      metricsTimeline: payload.metricsTimeline || [],
      videoSnapshots: payload.videoSnapshots || [],
      analytics: payload.analytics || null,
      endedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function listUserSessions(uid: string, limit = 20) {
  const { db } = getFirebaseClients();
  const snap = await db
    .collection('sessions')
    .where('uid', '==', uid)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getSessionById(sessionId: string) {
  const { db } = getFirebaseClients();
  const doc = await db.collection('sessions').doc(sessionId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

export async function getQuestionAnalyticsForSession(sessionId: string, limit = 100) {
  const { db } = getFirebaseClients();
  const snap = await db
    .collection('questionAnalytics')
    .where('sessionId', '==', sessionId)
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createJob(payload: CreateJobPayload): Promise<string> {
  const { db } = getFirebaseClients();
  const ref = await db.collection('jobs').add({
    title: payload.title,
    company: payload.company,
    logoUrl: payload.logoUrl || '',
    description: payload.description,
    salary: payload.salary,
    recruiterId: payload.recruiterId,
    status: 'PENDING',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getJobsByStatus(status: JobStatus) {
  const { db } = getFirebaseClients();
  const snap = await db.collection('jobs').where('status', '==', status).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => {
      const at = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bt = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bt - at;
    });
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  const { db } = getFirebaseClients();
  await db.collection('jobs').doc(jobId).set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createJobApplication(payload: CreateJobApplicationPayload): Promise<string> {
  const { db } = getFirebaseClients();

  const existing = await db
    .collection('jobApplications')
    .where('jobId', '==', payload.jobId)
    .where('candidateUid', '==', payload.candidateUid)
    .limit(1)
    .get();

  if (!existing.empty) {
    return existing.docs[0].id;
  }

  const ref = await db.collection('jobApplications').add({
    jobId: payload.jobId,
    recruiterId: payload.recruiterId,
    candidateUid: payload.candidateUid,
    candidateEmail: payload.candidateEmail,
    candidateName: payload.candidateName,
    status: 'APPLIED',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

export async function listRecruiterApplications(recruiterId: string) {
  const { db } = getFirebaseClients();
  const snap = await db.collection('jobApplications').where('recruiterId', '==', recruiterId).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => {
      const at = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bt = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bt - at;
    });
}
