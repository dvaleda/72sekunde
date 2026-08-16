import express from 'express';
import cors from 'cors';
import { publicRouter } from './routes/public';
import { adminRouter } from './routes/admin';
import { generalApiLimiter, answerLimiter, adminLoginLimiter } from './middleware/rateLimits';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api', generalApiLimiter);
  app.use('/api/attempts/:id/answer', answerLimiter);
  app.use('/api/admin/login', adminLoginLimiter);

  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);

  // Not-found + error handlers
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Interna greška servera.' });
  });

  return app;
}
