import { z } from 'zod';

export const categories = ['General mystery', 'Theft', 'Missing object or person', 'Suspicious incident', 'Corporate intrigue', 'Closed-room mystery'];
export const difficulties = ['easy', 'medium', 'hard'];
export const evidenceTypes = ['chat', 'image', 'cctv', 'witness', 'document', 'physical'];
export const evidencePreferences = ['Simulated chat messages', 'Photographic clues', 'CCTV-style evidence', 'Witness statements', 'Physical or document-based clues'];
const bounded = (max) => z.string().trim().min(1).max(max);

export const createCaseSchema = z.object({
  scenario: z.string().trim().min(30).max(2000),
  category: z.enum(categories).default('General mystery'),
  difficulty: z.enum(difficulties).default('medium'),
  title: z.string().trim().max(80).optional().default(''),
  evidencePreferences: z.array(z.enum(evidencePreferences)).max(5).optional().default([]),
});

const suspectSchema = z.object({
  id: z.string().regex(/^suspect_[a-z0-9_-]{1,32}$/),
  name: bounded(80), role: bounded(100), background: bounded(600), motive: bounded(500), alibi: bounded(500),
  portraitUrl: z.string().max(0).default(''), relatedEvidenceIds: z.array(z.string().max(48)).default([]),
});
const transcriptLine = z.object({ speaker: bounded(80), text: bounded(500), time: bounded(40) });
const evidenceSchema = z.object({
  id: z.string().regex(/^evidence_[a-z0-9_-]{1,32}$/), title: bounded(120), type: z.enum(evidenceTypes),
  description: bounded(1800), timestamp: bounded(80), source: bounded(100), relatedSuspectIds: z.array(z.string().max(48)),
  clueSummary: bounded(300), clueRole: z.enum(['key', 'supporting', 'red_herring']), transcript: z.array(transcriptLine).max(12).default([]),
});
const timelineSchema = z.object({ time: bounded(40), event: bounded(250), relatedSuspectIds: z.array(z.string().max(48)).default([]) });

export const blueprintSchema = z.object({
  title: bounded(80), summary: bounded(450), incident: bounded(600),
  suspects: z.array(suspectSchema).min(3).max(6), culpritId: z.string(),
  timeline: z.array(timelineSchema).min(4).max(12),
  solution: z.object({ motive: bounded(800), sequence: bounded(1200), explanation: bounded(1800), decisiveEvidenceIds: z.array(z.string()).min(2).max(5) }),
});
export const evidenceBatchSchema = z.object({ evidence: z.array(evidenceSchema).min(5).max(15) });

const counts = { easy: [3, 5, 7], medium: [4, 8, 11], hard: [5, 12, 15] };
const suspectRanges = { easy: [3, 3], medium: [4, 5], hard: [5, 6] };
const keyClueRanges = { easy: [2, 3], medium: [3, 4], hard: [4, 5] };
const redHerringRanges = { easy: [0, 1], medium: [1, 2], hard: [2, 3] };
export function validatePlayableCase(blueprint, evidence, difficulty) {
  const parsedBlueprint = blueprintSchema.safeParse(blueprint);
  const parsedEvidence = evidenceBatchSchema.safeParse({ evidence });
  if (!parsedBlueprint.success) throw new Error('The generated case blueprint did not match the required structure.');
  if (!parsedEvidence.success) throw new Error('The generated evidence did not match the required structure.');
  const b = parsedBlueprint.data; const items = parsedEvidence.data.evidence;
  const [minimumSuspects, maxSuspects] = suspectRanges[difficulty] || suspectRanges.medium;
  const [, minEvidence, maxEvidence] = counts[difficulty] || counts.medium;
  if (b.suspects.length < minimumSuspects || b.suspects.length > maxSuspects || items.length < minEvidence || items.length > maxEvidence) throw new Error('Generated suspect or evidence counts do not match the selected difficulty.');
  const suspectIds = b.suspects.map((s) => s.id); const evidenceIds = items.map((e) => e.id);
  if (new Set(suspectIds).size !== suspectIds.length || new Set(evidenceIds).size !== evidenceIds.length) throw new Error('Generated IDs must be unique.');
  if (!suspectIds.includes(b.culpritId)) throw new Error('The official culprit must be one of the case suspects.');
  const knownSuspects = new Set(suspectIds); const knownEvidence = new Set(evidenceIds);
  for (const e of items) if (e.relatedSuspectIds.some((id) => !knownSuspects.has(id))) throw new Error('Evidence refers to an unknown suspect.');
  for (const s of b.suspects) if (s.relatedEvidenceIds.some((id) => !knownEvidence.has(id))) throw new Error('Suspect refers to unknown evidence.');
  for (const t of b.timeline) if (t.relatedSuspectIds.some((id) => !knownSuspects.has(id))) throw new Error('Timeline refers to an unknown suspect.');
  if (b.solution.decisiveEvidenceIds.some((id) => !knownEvidence.has(id))) throw new Error('The solution refers to evidence that is not in the case.');
  const keyIds = new Set(items.filter((e) => e.clueRole === 'key').map((e) => e.id));
  const [minKeyClues, maxKeyClues] = keyClueRanges[difficulty] || keyClueRanges.medium;
  const [minRedHerrings, maxRedHerrings] = redHerringRanges[difficulty] || redHerringRanges.medium;
  const keyItems = items.filter((e) => e.clueRole === 'key');
  const redHerringCount = items.filter((e) => e.clueRole === 'red_herring').length;
  if (keyItems.length < minKeyClues || keyItems.length > maxKeyClues || redHerringCount < minRedHerrings || redHerringCount > maxRedHerrings) throw new Error('Key clue or red herring counts do not match the selected difficulty.');
  if (b.solution.decisiveEvidenceIds.filter((id) => keyIds.has(id)).length < 2 || keyItems.filter((item) => item.relatedSuspectIds.includes(b.culpritId)).length < 2) throw new Error('At least two independent key clues must support the solution.');
  const culprit = b.suspects.find((s) => s.id === b.culpritId);
  if (!culprit.motive || !culprit.alibi || !b.solution.explanation) throw new Error('The solution is missing essential case details.');
  return { blueprint: b, evidence: items };
}

export function publicCase(doc) {
  const data = doc.toObject ? doc.toObject() : doc;
  return {
    caseId: String(data._id), title: data.title, summary: data.summary, incident: data.incident,
    category: data.category, difficulty: data.difficulty, status: data.status,
    suspects: data.suspects.map(({ id, name, role, background, motive, alibi, portraitUrl, relatedEvidenceIds }) => ({ id, name, role, background, motive, alibi, portraitUrl, relatedEvidenceIds })),
    evidence: data.evidence.map(({ id, title, type, description, timestamp, source, relatedSuspectIds, clueSummary, transcript }) => ({ id, title, type, description, timestamp, source, relatedSuspectIds, clueSummary, transcript })),
    timeline: data.timeline.map(({ time, event, relatedSuspectIds }) => ({ time, event, relatedSuspectIds })),
  };
}

export function validateAccusation(caseData, suspectId) {
  if (caseData.status !== 'ready') throw Object.assign(new Error(caseData.status === 'completed' ? 'This case already has a final accusation.' : 'This case is not ready for an accusation.'), { code: caseData.status === 'completed' ? 'CASE_ALREADY_COMPLETED' : 'CASE_NOT_READY', status: 409 });
  if (!caseData.suspects.some((suspect) => suspect.id === suspectId)) throw Object.assign(new Error('That person is not part of this case.'), { code: 'SUSPECT_NOT_FOUND', status: 404 });
  return suspectId === caseData.culpritId;
}
