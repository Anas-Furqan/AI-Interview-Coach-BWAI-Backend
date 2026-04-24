import { Request, Response } from 'express';
import {
  appendQuestionAnalytics,
  createInterviewSession,
  finalizeInterviewSession,
  getQuestionAnalyticsForSession,
  getSessionById,
  listUserSessions,
  upsertUserProfile,
  verifyIdToken,
  verifyGoogleIdToken,
} from '../services/firebase.service';

export async function firebaseGoogleAuthController(req: Request, res: Response) {
  try {
    const { idToken, preferredLanguage = 'en' } = req.body || {};
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    const decoded = await verifyGoogleIdToken(String(idToken));

    await upsertUserProfile({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      preferredLanguage: preferredLanguage === 'ur' ? 'ur' : 'en',
    });

    res.json({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
    });
  } catch (error) {
    console.error('firebaseGoogleAuthController error:', error);
    res.status(500).json({ error: 'Failed to authenticate user.' });
  }
}

export async function createSessionController(req: Request, res: Response) {
  try {
    const { uid, roleId, companyContext, languageCode } = req.body || {};
    if (!uid || !roleId || !companyContext || !languageCode) {
      res.status(400).json({ error: 'uid, roleId, companyContext, languageCode are required.' });
      return;
    }

    const sessionId = await createInterviewSession({
      uid: String(uid),
      roleId: String(roleId),
      companyContext: String(companyContext),
      languageCode: String(languageCode) === 'ur-PK' ? 'ur-PK' : 'en-US',
    });

    res.status(201).json({ sessionId });
  } catch (error) {
    console.error('createSessionController error:', error);
    res.status(500).json({ error: 'Failed to create session.' });
  }
}

export async function firebaseAuthSyncController(req: Request, res: Response) {
  try {
    const { idToken, preferredLanguage = 'en' } = req.body || {};
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    const decoded = await verifyIdToken(String(idToken));

    await upsertUserProfile({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      preferredLanguage: preferredLanguage === 'ur' ? 'ur' : 'en',
    });

    res.json({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
    });
  } catch (error) {
    console.error('firebaseAuthSyncController error:', error);
    res.status(500).json({ error: 'Failed to sync authenticated user.' });
  }
}

export async function appendQuestionAnalyticsController(req: Request, res: Response) {
  try {
    const sessionId = String(req.params.sessionId || '');
    const { questionId, confidence, wpm, fillerCount, panic, starMissing, score } = req.body || {};

    if (!sessionId || !questionId) {
      res.status(400).json({ error: 'sessionId and questionId are required.' });
      return;
    }

    await appendQuestionAnalytics({
      sessionId,
      questionId: String(questionId),
      confidence: Number(confidence || 0),
      wpm: Number(wpm || 0),
      fillerCount: Number(fillerCount || 0),
      panic: Boolean(panic),
      starMissing: Boolean(starMissing),
      score: Number(score || 0),
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('appendQuestionAnalyticsController error:', error);
    res.status(500).json({ error: 'Failed to save question analytics.' });
  }
}

export async function finalizeSessionController(req: Request, res: Response) {
  try {
    const sessionId = String(req.params.sessionId || '');
    const { finalScore, strengths = [], improvements = [], transcript = [], metricsTimeline = [] } = req.body || {};

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required.' });
      return;
    }

    await finalizeInterviewSession({
      sessionId,
      finalScore: Number(finalScore || 0),
      strengths: Array.isArray(strengths) ? strengths : [],
      improvements: Array.isArray(improvements) ? improvements : [],
      transcript: Array.isArray(transcript) ? transcript : [],
      metricsTimeline: Array.isArray(metricsTimeline) ? metricsTimeline : [],
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('finalizeSessionController error:', error);
    res.status(500).json({ error: 'Failed to finalize session.' });
  }
}

export async function listUserSessionsController(req: Request, res: Response) {
  try {
    const uid = String(req.params.uid || '');
    if (!uid) {
      res.status(400).json({ error: 'uid is required.' });
      return;
    }

    const sessions = await listUserSessions(uid);
    res.json({ sessions });
  } catch (error) {
    console.error('listUserSessionsController error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
}

export async function getSessionReportController(req: Request, res: Response) {
  try {
    const sessionId = String(req.params.sessionId || '');
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required.' });
      return;
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const questionAnalytics = await getQuestionAnalyticsForSession(sessionId);
    res.json({ session, questionAnalytics });
  } catch (error) {
    console.error('getSessionReportController error:', error);
    res.status(500).json({ error: 'Failed to fetch session report.' });
  }
}
