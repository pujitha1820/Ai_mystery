import mongoose from 'mongoose';

const Suspect = new mongoose.Schema({ id: { type: String, required: true }, name: String, role: String, background: String, motive: String, alibi: String, portraitUrl: { type: String, default: '' }, relatedEvidenceIds: [String] }, { _id: false });
const Transcript = new mongoose.Schema({ speaker: String, text: String, time: String }, { _id: false });
const Evidence = new mongoose.Schema({ id: { type: String, required: true }, title: String, type: String, description: String, timestamp: String, source: String, relatedSuspectIds: [String], clueSummary: String, clueRole: String, transcript: [Transcript] }, { _id: false });
const Timeline = new mongoose.Schema({ time: String, event: String, relatedSuspectIds: [String] }, { _id: false });
const Result = new mongoose.Schema({ isCorrect: Boolean, suspectId: String, reasoning: { type: String, default: '' }, completedAt: Date }, { _id: false });
const Solution = new mongoose.Schema({ motive: String, sequence: String, explanation: String, decisiveEvidenceIds: [String] }, { _id: false });

const MysteryCaseSchema = new mongoose.Schema({
  title: { type: String, required: true }, scenario: { type: String, required: true }, category: { type: String, required: true }, difficulty: { type: String, required: true },
  status: { type: String, enum: ['ready', 'completed', 'failed'], default: 'ready', index: true }, summary: String, incident: String,
  suspects: { type: [Suspect], required: true }, evidence: { type: [Evidence], required: true }, timeline: { type: [Timeline], required: true },
  culpritId: { type: String, required: true, select: false }, solution: { type: Solution, required: true, select: false },
  generation: { model: String, schemaVersion: Number, attempts: Number }, result: { type: Result, default: undefined }, completedAt: Date,
}, { timestamps: true, collection: 'mysterycases' });

export default mongoose.models.MysteryCase || mongoose.model('MysteryCase', MysteryCaseSchema);
