import { blueprintSchema, evidenceBatchSchema } from '../schemas/caseSchema.js';
import { validateGeneratedEvidence } from './evidenceValidationService.js';
import { generateJson } from './geminiService.js';
import { blueprintPrompt } from '../prompts/caseBlueprintPrompt.js';
import { evidencePrompt } from '../prompts/evidencePrompt.js';

const blueprintResponseSchema = { type: 'OBJECT', properties: {
  title:{type:'STRING'},summary:{type:'STRING'},incident:{type:'STRING'},culpritId:{type:'STRING'},
  suspects:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},name:{type:'STRING'},role:{type:'STRING'},background:{type:'STRING'},motive:{type:'STRING'},alibi:{type:'STRING'},portraitUrl:{type:'STRING'},relatedEvidenceIds:{type:'ARRAY',items:{type:'STRING'}}},required:['id','name','role','background','motive','alibi','relatedEvidenceIds']}},
  timeline:{type:'ARRAY',items:{type:'OBJECT',properties:{time:{type:'STRING'},event:{type:'STRING'},relatedSuspectIds:{type:'ARRAY',items:{type:'STRING'}}},required:['time','event']}},
  solution:{type:'OBJECT',properties:{motive:{type:'STRING'},sequence:{type:'STRING'},explanation:{type:'STRING'},decisiveEvidenceIds:{type:'ARRAY',items:{type:'STRING'}}},required:['motive','sequence','explanation','decisiveEvidenceIds']}
},required:['title','summary','incident','culpritId','suspects','timeline','solution']};
const evidenceResponseSchema={type:'OBJECT',properties:{evidence:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},title:{type:'STRING'},type:{type:'STRING',enum:['chat','image','cctv','witness','document','physical']},description:{type:'STRING'},timestamp:{type:'STRING'},source:{type:'STRING'},relatedSuspectIds:{type:'ARRAY',items:{type:'STRING'}},clueSummary:{type:'STRING'},clueRole:{type:'STRING',enum:['key','supporting','red_herring']},transcript:{type:'ARRAY',items:{type:'OBJECT',properties:{speaker:{type:'STRING'},text:{type:'STRING'},time:{type:'STRING'}},required:['speaker','text','time']}}},required:['id','title','type','description','timestamp','source','relatedSuspectIds','clueSummary','clueRole']}}},required:['evidence']};

export async function generateMystery(input) {
  const maxAttempts = Math.max(1, Math.min(3, Number(process.env.CASE_GENERATION_MAX_ATTEMPTS || 3)));
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const blueprint = await generateJson(blueprintPrompt(input), blueprintResponseSchema);
      const validBlueprint = blueprintSchema.parse(blueprint);
      const batch = await generateJson(evidencePrompt(input, validBlueprint), evidenceResponseSchema);
      const validated = validateGeneratedEvidence(validBlueprint, batch.evidence, input.difficulty);
      return { ...validated, attempts: attempt };
    } catch (error) { lastError = error; }
  }
  throw Object.assign(new Error("We couldn't build a consistent case. Please try again."), { code: 'GENERATION_FAILED', status: 502, cause: lastError });
}
