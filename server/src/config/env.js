import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required.').refine((key) => !key.startsWith('replace_with_'), 'Replace the placeholder GEMINI_API_KEY.'),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  GEMINI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  CASE_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(60000),
  CASE_GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(3),
});

export function loadEnv(source = process.env) {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join(' ');
    throw new Error(`Invalid server environment: ${details}`);
  }
  return parsed.data;
}
