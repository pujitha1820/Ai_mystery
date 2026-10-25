import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('health endpoint and invalid create request use the documented response envelope', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).data.status, 'ok');
  const invalid = await fetch(`${base}/cases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'Too short' }) });
  assert.equal(invalid.status, 400);
  const body = await invalid.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});
