import { Router } from 'express';
import {
  appendQuestionAnalyticsController,
  createSessionController,
  firebaseAuthSyncController,
  finalizeSessionController,
  firebaseGoogleAuthController,
  getSessionReportController,
  listUserSessionsController,
} from '../controllers/firebase.controller';

const router = Router();

router.post('/auth/google', firebaseGoogleAuthController);
router.post('/auth/sync', firebaseAuthSyncController);
router.post('/sessions', createSessionController);
router.post('/sessions/:sessionId/questions', appendQuestionAnalyticsController);
router.patch('/sessions/:sessionId/finalize', finalizeSessionController);
router.get('/sessions/report/:sessionId', getSessionReportController);
router.get('/sessions/:uid', listUserSessionsController);

export default router;
