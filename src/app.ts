import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { env } from './config/env';
import interviewRoutes from './routes/interview.routes';
import userRoutes from './routes/user.routes';
import analyticsRoutes from './routes/analytics.routes';
import firebaseRoutes from './routes/firebase.routes';
import sessionRoutes from './routes/session.routes';
import sttRoutes from './routes/stt.routes';
import atsRoutes from './routes/ats.routes';
import ttsRoutes from './routes/tts.routes';
import chatbotRoutes from './routes/chatbot.routes';

const localOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const vercelProductionOrigin = 'https://ai-interview-bwai.vercel.app';

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (localOrigins.includes(normalizedOrigin)) {
    return true;
  }

  if (normalizedOrigin === vercelProductionOrigin) {
    return true;
  }

  if (env.allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  if (env.allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const corsOptions = {
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.get('/', (_req, res) => {
    res.send('AI Interview Coach Backend is running!');
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'ai-interview-coach-backend',
      allowedOrigins: [...new Set([...localOrigins, ...env.allowedOrigins])],
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/interview', interviewRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/firebase', firebaseRoutes);
  app.use('/api/session', sessionRoutes);
  app.use('/api/stt', sttRoutes);
  app.use('/api/ats', atsRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/chatbot', chatbotRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    res.status(500).json({ error: message });
  });

  return app;
}
