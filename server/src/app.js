import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import caseRoutes from './routes/caseRoutes.js';
import { errorResponse } from './utils/apiError.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { connectSrc: ["'self'", process.env.CLIENT_ORIGIN || 'http://localhost:5173', 'http://localhost:5000'] } } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '20kb' }));
app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/v1/cases', caseRoutes);
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'This API route was not found.' } }));
app.use((error, _req, res, _next) => {
  if (error?.name === 'ZodError') error = Object.assign(new Error('Generated case content failed validation.'), { status: 502, code: 'GENERATION_FAILED' });
  const response = errorResponse(error);
  if (response.status >= 500) console.error('[api]', response.body.error.code);
  res.status(response.status).json(response.body);
});
export default app;
