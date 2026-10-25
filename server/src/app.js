import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import caseRoutes from './routes/caseRoutes.js';
import { errorResponse } from './utils/apiError.js';

const app = express();
app.set('trust proxy', 1);
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const clientOrigin = process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';

function describeError(error) {
  let message = String(error?.message || 'Unknown error');
  for (const secret of [process.env.GEMINI_API_KEY, process.env.MONGODB_URI]) {
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  return {
    name: error?.name,
    code: error?.code,
    status: error?.status,
    message: message.slice(0, 500),
  };
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { connectSrc: ["'self'", clientOrigin, 'http://localhost:5000'] } } }));
app.use(cors({ origin: clientOrigin, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '20kb' }));
app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1', (_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'This API route was not found.' } }));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'This API route was not found.' } }));
}
app.use((error, _req, res, _next) => {
  if (error?.name === 'ZodError') error = Object.assign(new Error('Generated case content failed validation.'), { status: 502, code: 'GENERATION_FAILED', cause: error });
  const response = errorResponse(error);
  if (response.status >= 500) {
    const causes = [];
    let current = error;
    while (current && causes.length < 4) {
      causes.push(describeError(current));
      current = current.cause;
    }
    console.error('[api]', response.body.error.code, JSON.stringify(causes));
  }
  res.status(response.status).json(response.body);
});
export default app;
