import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaseSchema, publicCase, validateAccusation, validatePlayableCase } from '../src/schemas/caseSchema.js';

const blueprint = {
  title: 'The Last Bell', summary: 'A clock vanished during a storm.', incident: 'The clock disappeared from the locked library.', culpritId: 'suspect_01',
  suspects: [1,2,3].map((n) => ({ id: `suspect_0${n}`, name: `Person ${n}`, role: 'Guest', background: 'A guest at the manor.', motive: 'Wanted the clock.', alibi: 'Was in the west wing.', relatedEvidenceIds: [] })),
  timeline: [{time:'20:00',event:'Guests arrive.'},{time:'21:00',event:'The lights fail.'},{time:'21:10',event:'The clock disappears.'},{time:'22:00',event:'The room is searched.'}],
  solution: { motive: 'The culprit wanted the clock.', sequence: 'They used the blackout.', explanation: 'A fictional solution with supporting clues.', decisiveEvidenceIds: ['evidence_01','evidence_02'] },
};
const evidence = Array.from({length:5},(_,i)=>({ id:`evidence_0${i+1}`,title:`Clue ${i+1}`,type:'document',description:'A fictional record.',timestamp:'21:00',source:'Archive',relatedSuspectIds:['suspect_01'],clueSummary:'This fact connects the suspect to the scene.',clueRole:i<2?'key':i===2?'red_herring':'supporting',transcript:[] }));

test('scenario validation applies defaults and enforces the minimum', () => {
  const input = createCaseSchema.parse({ scenario: 'A sufficiently long fictional mystery scenario.' });
  assert.equal(input.difficulty, 'medium'); assert.equal(input.category, 'General mystery');
  assert.equal(createCaseSchema.safeParse({ scenario: 'Too short' }).success, false);
});
test('accepts a solvable easy case with one culprit and two decisive clues', () => {
  assert.equal(validatePlayableCase(blueprint, evidence, 'easy').blueprint.culpritId, 'suspect_01');
});
test('rejects duplicate suspect IDs', () => {
  const duplicate = structuredClone(blueprint); duplicate.suspects[1].id = duplicate.suspects[0].id;
  assert.throws(() => validatePlayableCase(duplicate, evidence, 'easy'), /unique/);
});
test('rejects a solution without two independent key clues', () => {
  const weak = evidence.map((item, i) => ({...item, clueRole:i===0?'key':i===2?'red_herring':'supporting'}));
  assert.throws(() => validatePlayableCase(blueprint, weak, 'easy'), /Key clue/);
});
test('public case projection never includes the culprit or solution', () => {
  const safe = publicCase({ _id:'case-1', title:'A case', summary:'Summary', incident:'Incident', category:'Theft', difficulty:'easy', status:'ready', suspects:blueprint.suspects, evidence, timeline:blueprint.timeline, culpritId:'suspect_01', solution:blueprint.solution, generation:{model:'secret'} });
  assert.equal('culpritId' in safe, false); assert.equal('solution' in safe, false); assert.equal('generation' in safe, false);
});
test('accusation check is deterministic and completed cases reject another guess', () => {
  const base = {status:'ready', culpritId:'suspect_01', suspects:blueprint.suspects};
  assert.equal(validateAccusation(base, 'suspect_01'), true);
  assert.equal(validateAccusation(base, 'suspect_02'), false);
  assert.throws(() => validateAccusation({...base,status:'completed'}, 'suspect_02'), {code:'CASE_ALREADY_COMPLETED'});
});
