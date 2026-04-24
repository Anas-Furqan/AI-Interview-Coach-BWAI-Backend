import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import interviewRoutes from './routes/interview.routes';
import userRoutes from './routes/user.routes';
import analyticsRoutes from './routes/analytics.routes';
import firebaseRoutes from './routes/firebase.routes';
import sttRoutes from './routes/stt.routes';
import geminiRoutes from './routes/gemini.routes';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cors());

  app.get('/', (_req, res) => {
    res.send('AI Interview Coach Backend is running!');
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'ai-interview-coach-backend',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/interview', interviewRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/firebase', firebaseRoutes);
  app.use('/api/stt', sttRoutes);
  app.use('/api/gemini', geminiRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    res.status(500).json({ error: message });
  });

  return app;
}
