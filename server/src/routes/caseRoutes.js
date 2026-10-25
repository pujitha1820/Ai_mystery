import { Router } from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import MysteryCase from '../models/MysteryCase.js';
import { createCaseSchema, publicCase, validateAccusation } from '../schemas/caseSchema.js';
import { generateMystery } from '../services/mysteryGenerationService.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
const generationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many case requests. Please wait before trying again.' } } });
const accusationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many accusation requests. Please wait before trying again.' } }) });
const validObjectId = (id) => mongoose.isValidObjectId(id);

router.post('/', generationLimit, async (req, res, next) => {
  try {
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Please enter a scenario of 30 to 2,000 characters and check the selected options.');
    if (!process.env.GEMINI_API_KEY) throw new ApiError(503, 'AI_PROVIDER_ERROR', 'Case generation is not configured. Add GEMINI_API_KEY to the server environment.');
    const input = parsed.data;
    const generated = await generateMystery(input);
    const saved = await MysteryCase.create({
      title: input.title || generated.blueprint.title, scenario: input.scenario, category: input.category, difficulty: input.difficulty, status: 'ready',
      summary: generated.blueprint.summary, incident: generated.blueprint.incident, suspects: generated.blueprint.suspects,
      evidence: generated.evidence, timeline: generated.blueprint.timeline, culpritId: generated.blueprint.culpritId,
      solution: generated.blueprint.solution, generation: { model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', schemaVersion: 1, attempts: generated.attempts },
    });
    return res.status(201).json({ success: true, data: publicCase(saved) });
  } catch (error) { next(error); }
});

router.get('/:caseId', async (req, res, next) => {
  try {
    if (!validObjectId(req.params.caseId)) throw new ApiError(404, 'CASE_NOT_FOUND', 'That case file could not be found.');
    const doc = await MysteryCase.findById(req.params.caseId);
    if (!doc) throw new ApiError(404, 'CASE_NOT_FOUND', 'That case file could not be found.');
    return res.json({ success: true, data: publicCase(doc) });
  } catch (error) { next(error); }
});

router.get('/:caseId/evidence/:evidenceId', async (req, res, next) => {
  try {
    if (!validObjectId(req.params.caseId)) throw new ApiError(404, 'CASE_NOT_FOUND', 'That case file could not be found.');
    const doc = await MysteryCase.findById(req.params.caseId);
    const evidence = doc?.evidence.find((item) => item.id === req.params.evidenceId);
    if (!evidence) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'That evidence item could not be found in this case.');
    const { id, title, type, description, timestamp, source, relatedSuspectIds, clueSummary, transcript } = evidence;
    return res.json({ success: true, data: { id, title, type, description, timestamp, source, relatedSuspectIds, clueSummary, transcript } });
  } catch (error) { next(error); }
});

router.post('/:caseId/accusation', accusationLimit, async (req, res, next) => {
  try {
    const { suspectId, reasoning = '' } = req.body || {};
    if (!validObjectId(req.params.caseId) || typeof suspectId !== 'string' || suspectId.length > 48 || typeof reasoning !== 'string' || reasoning.length > 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the suspect selection and reasoning length.');
    const doc = await MysteryCase.findById(req.params.caseId).select('+culpritId +solution');
    if (!doc) throw new ApiError(404, 'CASE_NOT_FOUND', 'That case file could not be found.');
    const isCorrect = validateAccusation(doc, suspectId);
    const completedAt = new Date();
    const updated = await MysteryCase.findOneAndUpdate(
      { _id: doc._id, status: 'ready' },
      { $set: { status: 'completed', completedAt, result: { isCorrect, suspectId, reasoning: reasoning.trim(), completedAt } } },
      { new: true },
    ).select('+culpritId +solution');
    if (!updated) throw new ApiError(409, 'CASE_ALREADY_COMPLETED', 'This case already has a final accusation.');
    const culprit = updated.suspects.find((suspect) => suspect.id === updated.culpritId);
    const decisiveEvidence = updated.evidence.filter((item) => updated.solution.decisiveEvidenceIds.includes(item.id));
    return res.json({ success: true, data: { isCorrect, status: 'completed', result: { title: isCorrect ? 'Case Solved' : 'Case Unsolved', explanation: updated.solution.explanation, culpritId: updated.culpritId, decisiveEvidenceIds: updated.solution.decisiveEvidenceIds, culprit: { id: culprit.id, name: culprit.name, role: culprit.role }, decisiveEvidence: decisiveEvidence.map(({ id, title, clueSummary }) => ({ id, title, clueSummary })) } } });
  } catch (error) { next(error); }
});

router.get('/:caseId/result', async (req, res, next) => {
  try {
    if (!validObjectId(req.params.caseId)) throw new ApiError(404, 'CASE_NOT_FOUND', 'That case file could not be found.');
    const doc = await MysteryCase.findById(req.params.caseId).select('+culpritId +solution');
    if (!doc) throw new ApiError(404, 'CASE_NOT_FOUND', 'That case file could not be found.');
    if (doc.status !== 'completed' || !doc.result) throw new ApiError(403, 'RESULT_LOCKED', 'The solution stays sealed until a final accusation is submitted.');
    const culprit = doc.suspects.find((suspect) => suspect.id === doc.culpritId);
    const decisiveEvidence = doc.evidence.filter((item) => doc.solution.decisiveEvidenceIds.includes(item.id));
    return res.json({ success: true, data: { isCorrect: doc.result.isCorrect, title: doc.result.isCorrect ? 'Case Solved' : 'Case Unsolved', culprit: { id: culprit.id, name: culprit.name, role: culprit.role }, explanation: doc.solution.explanation, motive: doc.solution.motive, sequence: doc.solution.sequence, decisiveEvidence: decisiveEvidence.map(({ id, title, clueSummary }) => ({ id, title, clueSummary })) } });
  } catch (error) { next(error); }
});

export default router;
