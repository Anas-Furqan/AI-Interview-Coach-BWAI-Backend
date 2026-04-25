import { Router } from 'express';
import {
  applyToJobController,
  appendQuestionAnalyticsController,
  createJobController,
  getUserProfileController,
  listRecruiterApplicationsController,
  createSessionController,
  firebaseAuthSyncController,
  finalizeSessionController,
  firebaseGoogleAuthController,
  getSessionReportController,
  listJobsByStatusController,
  listUserSessionsController,
  updateUserProfileController,
  updateJobStatusController,
} from '../controllers/firebase.controller';

const router = Router();

router.post('/auth/google', firebaseGoogleAuthController);
router.post('/auth/sync', firebaseAuthSyncController);
router.get('/users/:uid', getUserProfileController);
router.patch('/users/:uid/profile', updateUserProfileController);
router.post('/sessions', createSessionController);
router.post('/jobs', createJobController);
router.get('/jobs', listJobsByStatusController);
router.patch('/jobs/:jobId/status', updateJobStatusController);
router.post('/jobs/:jobId/apply', applyToJobController);
router.get('/recruiter/:recruiterId/applications', listRecruiterApplicationsController);
router.get('/recruiters/:recruiterId/applications', listRecruiterApplicationsController);
router.get('/r/:recruiterId/applications', listRecruiterApplicationsController);
router.get('/sessions/report/:sessionId', getSessionReportController);
router.post('/sessions/:sessionId/questions', appendQuestionAnalyticsController);
router.patch('/sessions/:sessionId/finalize', finalizeSessionController);
router.get('/sessions/:uid', listUserSessionsController);

export default router;
