const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH']);

export class GeminiProviderUnavailableError extends Error {
  constructor({ providerStatus, cause, timedOut = false }) {
    super(timedOut
      ? 'The AI case generator timed out. Please try again.'
      : 'The AI case generator is temporarily busy or unavailable. Please try again shortly.');
    this.name = 'GeminiProviderUnavailableError';
    this.code = timedOut ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNAVAILABLE';
    this.status = timedOut ? 504 : 503;
    this.providerStatus = providerStatus;
    this.cause = cause;
  }
}

export class GeminiProviderRequestError extends Error {
  constructor({ providerStatus, cause }) {
    const message = providerStatus === 401 || providerStatus === 403
      ? 'Gemini access was denied. Check the server API key and model access.'
      : 'Gemini rejected the generation request. Check the configured model and request compatibility.';
    super(message);
    this.name = 'GeminiProviderRequestError';
    this.code = 'AI_PROVIDER_ERROR';
    this.status = 502;
    this.providerStatus = providerStatus;
    this.cause = cause;
  }
}

function errorChain(error) {
  const chain = [];
  let current = error;
  while (current && chain.length < 5) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

export function getGeminiStatus(error) {
  for (const item of errorChain(error)) {
    const value = Number(item.status ?? item.statusCode ?? item.response?.status);
    if (Number.isInteger(value) && value >= 100 && value <= 599) return value;
  }
  return undefined;
}

function isTimeout(error) {
  return errorChain(error).some((item) => /timeout/i.test(item.name || '') || item.code === 'ETIMEDOUT');
}

function isTransientNetworkError(error) {
  return errorChain(error).some((item) => TRANSIENT_NETWORK_CODES.has(item.code));
}

export function isRetryableGeminiError(error) {
  const status = getGeminiStatus(error);
  return RETRYABLE_STATUSES.has(status) || isTimeout(error) || isTransientNetworkError(error);
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

function parseRetryAfter(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export function getGeminiRetryAfterMs(error) {
  for (const item of errorChain(error)) {
    const rawMilliseconds = headerValue(item.headers, 'retry-after-ms');
    if (rawMilliseconds !== undefined && Number.isFinite(Number(rawMilliseconds)) && Number(rawMilliseconds) >= 0) {
      return Number(rawMilliseconds);
    }
    const retryAfter = parseRetryAfter(headerValue(item.headers, 'retry-after'));
    if (retryAfter !== undefined) return retryAfter;
    const responseRetryAfter = parseRetryAfter(headerValue(item.response?.headers, 'retry-after'));
    if (responseRetryAfter !== undefined) return responseRetryAfter;
  }
  return undefined;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withGeminiRetries(operation, {
  maxRetries = 2,
  timeoutMs = 60000,
  attemptTimeoutMs = 30000,
  baseDelayMs = 500,
  maxDelayMs = 5000,
  random = Math.random,
  wait = sleep,
  now = Date.now,
} = {}) {
  const deadline = now() + timeoutMs;
  let retries = 0;

  while (true) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new GeminiProviderUnavailableError({ providerStatus: 504, timedOut: true });
    }

    try {
      return await operation({ timeoutMs: Math.max(1, Math.min(attemptTimeoutMs, remainingMs)), attempt: retries + 1 });
    } catch (error) {
      const providerStatus = getGeminiStatus(error);
      const timedOut = isTimeout(error);
      if (!isRetryableGeminiError(error)) {
        throw new GeminiProviderRequestError({ providerStatus, cause: error });
      }
      if (retries >= maxRetries) {
        throw new GeminiProviderUnavailableError({ providerStatus: providerStatus ?? (timedOut ? 504 : undefined), cause: error, timedOut });
      }

      const retryAfterMs = getGeminiRetryAfterMs(error);
      // Honor long Retry-After values by stopping instead of retrying before the provider permits it.
      if (retryAfterMs !== undefined && retryAfterMs > maxDelayMs) {
        throw new GeminiProviderUnavailableError({ providerStatus, cause: error, timedOut });
      }
      const exponential = Math.min(maxDelayMs, baseDelayMs * (2 ** retries) * (0.5 + random()));
      const delayMs = Math.max(exponential, retryAfterMs ?? 0);
      if (delayMs >= deadline - now()) {
        throw new GeminiProviderUnavailableError({ providerStatus: providerStatus ?? (timedOut ? 504 : undefined), cause: error, timedOut });
      }
      await wait(delayMs);
      retries += 1;
    }
  }
}
