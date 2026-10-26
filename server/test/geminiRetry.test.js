import test from 'node:test';
import assert from 'node:assert/strict';
import { withGeminiRetries } from '../src/services/geminiRetry.js';

const options = { maxRetries: 2, timeoutMs: 60000, baseDelayMs: 500, maxDelayMs: 5000, random: () => 0.5, wait: async () => {} };

test('retries Gemini 503 responses and returns the later success', async () => {
  let calls = 0;
  const result = await withGeminiRetries(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('high demand'), { status: 503 });
    return 'ok';
  }, options);

  assert.equal(result, 'ok');
  assert.equal(calls, 2);
});

test('retries Gemini 429 responses and respects Retry-After', async () => {
  let calls = 0;
  const waits = [];
  const result = await withGeminiRetries(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('rate limited'), { status: 429, headers: new Headers({ 'Retry-After': '2' }) });
    return 'ok';
  }, { ...options, wait: async (ms) => waits.push(ms) });

  assert.equal(result, 'ok');
  assert.deepEqual(waits, [2000]);
});

test('stops after the configured retries and reports provider unavailability', async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(
    withGeminiRetries(async () => {
      calls += 1;
      throw Object.assign(new Error('high demand'), { status: 503 });
    }, { ...options, wait: async (ms) => waits.push(ms) }),
    (error) => error.code === 'AI_PROVIDER_UNAVAILABLE' && error.status === 503 && error.providerStatus === 503,
  );

  assert.equal(calls, 3);
  assert.deepEqual(waits, [500, 1000]);
});

test('never sends a Gemini request with a deadline shorter than 10 seconds', async () => {
  let requestedTimeout;
  const result = await withGeminiRetries(async ({ timeoutMs }) => {
    requestedTimeout = timeoutMs;
    return 'ok';
  }, { ...options, timeoutMs: 1000 });

  assert.equal(result, 'ok');
  assert.ok(requestedTimeout >= 10000);
});

test('does not retry permanent provider errors', async () => {
  let calls = 0;
  await assert.rejects(
    withGeminiRetries(async () => {
      calls += 1;
      throw Object.assign(new Error('invalid model'), { status: 400 });
    }, options),
    (error) => error.code === 'AI_PROVIDER_ERROR' && error.status === 502 && error.providerStatus === 400,
  );

  assert.equal(calls, 1);
});

test('does not retry a daily free-tier quota exhaustion', async () => {
  let calls = 0;
  await assert.rejects(
    withGeminiRetries(async () => {
      calls += 1;
      throw Object.assign(new Error('{"error":{"message":"Generate content requests per day limit exceeded"}}'), { status: 429 });
    }, options),
    (error) => error.code === 'AI_QUOTA_EXCEEDED' && error.status === 429 && /daily quota/.test(error.message),
  );

  assert.equal(calls, 1);
});
