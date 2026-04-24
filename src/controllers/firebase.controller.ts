import { Request, Response } from 'express';
import {
  appendQuestionAnalytics,
  createJob,
  createJobApplication,
  createInterviewSession,
  finalizeInterviewSession,
  getUserProfile,
  getJobsByStatus,
  getQuestionAnalyticsForSession,
  getSessionById,
  listUserSessions,
  listRecruiterApplications,
  type JobStatus,
  upsertUserProfile,
  updateUserDisplayName,
  updateJobStatus,
  verifyIdToken,
  verifyGoogleIdToken,
} from '../services/firebase.service';

export async function firebaseGoogleAuthController(req: Request, res: Response) {
  try {
    const { idToken, preferredLanguage = 'en', requestedRole = 'CANDIDATE' } = req.body || {};
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    const decoded = await verifyGoogleIdToken(String(idToken));

    const role = await upsertUserProfile({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      preferredLanguage: preferredLanguage === 'ur' ? 'ur' : 'en',
      requestedRole: String(requestedRole).toUpperCase() as 'CANDIDATE' | 'RECRUITER' | 'ADMIN',
    });

    res.json({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      role,
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

    // Verify that only CANDIDATE can create interview sessions
    const userProfile = await getUserProfile(String(uid));
    if (!userProfile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    if (userProfile.role !== 'CANDIDATE') {
      res.status(403).json({ error: 'Only candidates can create interview sessions. Recruiters and admins cannot participate in interviews.' });
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
    const { idToken, preferredLanguage = 'en', requestedRole = 'CANDIDATE' } = req.body || {};
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    const decoded = await verifyIdToken(String(idToken));

    const role = await upsertUserProfile({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      preferredLanguage: preferredLanguage === 'ur' ? 'ur' : 'en',
      requestedRole: String(requestedRole).toUpperCase() as 'CANDIDATE' | 'RECRUITER' | 'ADMIN',
    });

    res.json({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      role,
    });
  } catch (error) {
    console.error('firebaseAuthSyncController error:', error);
    res.status(500).json({ error: 'Failed to sync authenticated user.' });
  }
}

export async function appendQuestionAnalyticsController(req: Request, res: Response) {
  try {
    const sessionId = String(req.params.sessionId || '');
    const {
      questionId,
      confidence,
      wpm,
      fillerCount,
      panic,
      starMissing,
      score,
      starStatus,
    } = req.body || {};

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
      starStatus,
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
    const {
      finalScore,
      strengths = [],
      improvements = [],
      analytics = null,
      transcript = [],
      metricsTimeline = [],
      videoSnapshots = [],
    } = req.body || {};

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required.' });
      return;
    }

    await finalizeInterviewSession({
      sessionId,
      finalScore: Number(finalScore || 0),
      strengths: Array.isArray(strengths) ? strengths : [],
      improvements: Array.isArray(improvements) ? improvements : [],
      analytics,
      transcript: Array.isArray(transcript) ? transcript : [],
      metricsTimeline: Array.isArray(metricsTimeline) ? metricsTimeline : [],
      videoSnapshots: Array.isArray(videoSnapshots) ? videoSnapshots : [],
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

export async function createJobController(req: Request, res: Response) {
  try {
    const { title, company, logoUrl = '', description, salary, recruiterId } = req.body || {};
    if (!title || !company || !description || !salary || !recruiterId) {
      res.status(400).json({ error: 'title, company, description, salary, recruiterId are required.' });
      return;
    }

    const jobId = await createJob({
      title: String(title),
      company: String(company),
      logoUrl: String(logoUrl || ''),
      description: String(description),
      salary: String(salary),
      recruiterId: String(recruiterId),
    });

    res.status(201).json({ id: jobId });
  } catch (error) {
    console.error('createJobController error:', error);
    res.status(500).json({ error: 'Failed to create job.' });
  }
}

export async function listJobsByStatusController(req: Request, res: Response) {
  try {
    const recruiterId = String(req.query.recruiterId || '');
    if (recruiterId) {
      const jobs = (await getJobsByStatus('PENDING')).concat(await getJobsByStatus('APPROVED'), await getJobsByStatus('REJECTED'))
        .filter(job => String((job as any).recruiterId || '') === recruiterId);
      res.json({ jobs });
      return;
    }

    const rawStatus = String(req.query.status || 'PENDING').toUpperCase();
    const status = (['PENDING', 'APPROVED', 'REJECTED'].includes(rawStatus) ? rawStatus : 'PENDING') as JobStatus;
    const jobs = await getJobsByStatus(status);
    res.json({ jobs });
  } catch (error) {
    console.error('listJobsByStatusController error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs.' });
  }
}

export async function updateJobStatusController(req: Request, res: Response) {
  try {
    const jobId = String(req.params.jobId || '');
    const statusRaw = String(req.body?.status || '').toUpperCase();
    if (!jobId || !['PENDING', 'APPROVED', 'REJECTED'].includes(statusRaw)) {
      res.status(400).json({ error: 'jobId and valid status are required.' });
      return;
    }

    await updateJobStatus(jobId, statusRaw as JobStatus);
    res.json({ ok: true });
  } catch (error) {
    console.error('updateJobStatusController error:', error);
    res.status(500).json({ error: 'Failed to update job status.' });
  }
}

export async function applyToJobController(req: Request, res: Response) {
  try {
    const jobId = String(req.params.jobId || '');
    const { recruiterId, candidateUid, candidateEmail, candidateName } = req.body || {};
    if (!jobId || !recruiterId || !candidateUid || !candidateEmail) {
      res.status(400).json({ error: 'jobId, recruiterId, candidateUid, and candidateEmail are required.' });
      return;
    }

    const id = await createJobApplication({
      jobId,
      recruiterId: String(recruiterId),
      candidateUid: String(candidateUid),
      candidateEmail: String(candidateEmail),
      candidateName: String(candidateName || ''),
    });

    res.status(201).json({ id, status: 'APPLIED' });
  } catch (error) {
    console.error('applyToJobController error:', error);
    res.status(500).json({ error: 'Failed to apply to job.' });
  }
}

export async function listRecruiterApplicationsController(req: Request, res: Response) {
  try {
    const recruiterId = String(req.params.recruiterId || '');
    if (!recruiterId) {
      res.status(400).json({ error: 'recruiterId is required.' });
      return;
    }

    const applications = await listRecruiterApplications(recruiterId);
    res.json({ applications });
  } catch (error) {
    console.error('listRecruiterApplicationsController error:', error);
    res.status(500).json({ error: 'Failed to fetch recruiter applications.' });
  }
}

export async function getUserProfileController(req: Request, res: Response) {
  try {
    const uid = String(req.params.uid || '');
    if (!uid) {
      res.status(400).json({ error: 'uid is required.' });
      return;
    }

    const user = await getUserProfile(uid);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('getUserProfileController error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
}

export async function updateUserProfileController(req: Request, res: Response) {
  try {
    const uid = String(req.params.uid || '');
    const displayName = String(req.body?.displayName || '').trim();

    if (!uid || !displayName) {
      res.status(400).json({ error: 'uid and displayName are required.' });
      return;
    }

    await updateUserDisplayName(uid, displayName);
    const user = await getUserProfile(uid);
    res.json({ user });
  } catch (error) {
    console.error('updateUserProfileController error:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
}
