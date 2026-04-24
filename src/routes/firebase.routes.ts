import { Router } from 'express';
import {
  appendQuestionAnalyticsController,
  createSessionController,
  finalizeSessionController,
  firebaseGoogleAuthController,
  listUserSessionsController,
} from '../controllers/firebase.controller';

const router = Router();

router.post('/auth/google', firebaseGoogleAuthController);
router.post('/sessions', createSessionController);
router.post('/sessions/:sessionId/questions', appendQuestionAnalyticsController);
router.patch('/sessions/:sessionId/finalize', finalizeSessionController);
router.get('/sessions/:uid', listUserSessionsController);

export default router;
