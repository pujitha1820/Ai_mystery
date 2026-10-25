import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMystery } from '../src/services/mysteryGenerationService.js';
import { GeminiProviderUnavailableError } from '../src/services/geminiRetry.js';

const blueprint = {
  title: 'The Last Bell', summary: 'A clock vanished during a storm.', incident: 'The clock disappeared from the locked library.', culpritId: 'suspect_01',
  suspects: [1, 2, 3].map((n) => ({ id: `suspect_0${n}`, name: `Person ${n}`, role: 'Guest', background: 'A guest at the manor.', motive: 'Wanted the clock.', alibi: 'Was in the west wing.', relatedEvidenceIds: [] })),
  timeline: [{ time: '20:00', event: 'Guests arrive.' }, { time: '21:00', event: 'The lights fail.' }, { time: '21:10', event: 'The clock disappears.' }, { time: '22:00', event: 'The room is searched.' }],
  solution: { motive: 'The culprit wanted the clock.', sequence: 'They used the blackout.', explanation: 'A fictional solution with supporting clues.', decisiveEvidenceIds: ['evidence_01', 'evidence_02'] },
};
const inconsistentEvidence = Array.from({ length: 5 }, (_, i) => ({
  id: `evidence_0${i + 1}`, title: `Clue ${i + 1}`, type: 'document', description: 'A fictional record.', timestamp: '21:00', source: 'Archive',
  relatedSuspectIds: [], clueSummary: 'This fact connects the suspect to the scene.', clueRole: i < 2 ? 'key' : 'supporting',
}));

test('does not regenerate an entire mystery after a temporary provider outage', async () => {
  let providerCalls = 0;

  await assert.rejects(
    generateMystery({ scenario: 'A fictional mystery scenario with enough detail.' }, {
      generateJsonFn: async () => {
        providerCalls += 1;
        throw new GeminiProviderUnavailableError({ providerStatus: 503 });
      },
    }),
    (error) => error.code === 'AI_PROVIDER_UNAVAILABLE',
  );

  assert.equal(providerCalls, 1);
});

test('reports invalid generated structures separately from inconsistent cases', async () => {
  await assert.rejects(
    generateMystery({ scenario: 'A fictional mystery scenario with enough detail.' }, { generateJsonFn: async () => ({}) }),
    (error) => error.code === 'AI_SCHEMA_INVALID' && /required case format/.test(error.message),
  );

  let stage = 0;
  await assert.rejects(
    generateMystery({ scenario: 'A fictional mystery scenario with enough detail.', difficulty: 'easy', evidencePreferences: [] }, {
      generateJsonFn: async () => (stage++ % 2 === 0 ? blueprint : { evidence: inconsistentEvidence }),
    }),
    (error) => error.code === 'CASE_INCONSISTENT' && /consistent mystery/.test(error.message),
  );
});

test('reports invalid JSON separately from provider availability failures', async () => {
  await assert.rejects(
    generateMystery({ scenario: 'A fictional mystery scenario with enough detail.' }, {
      generateJsonFn: async () => { throw Object.assign(new Error('invalid JSON'), { code: 'AI_INVALID_JSON', status: 502 }); },
    }),
    (error) => error.code === 'AI_INVALID_JSON',
  );
});
