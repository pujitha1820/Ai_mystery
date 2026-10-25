import { blueprintSchema, evidenceBatchSchema, CaseConsistencyError } from '../schemas/caseSchema.js';
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

export async function generateMystery(input, { generateJsonFn = generateJson } = {}) {
  const maxAttempts = Math.max(1, Math.min(3, Number(process.env.CASE_GENERATION_MAX_ATTEMPTS || 3)));
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const blueprint = await generateJsonFn(blueprintPrompt(input), blueprintResponseSchema);
      const parsedBlueprint = blueprintSchema.safeParse(blueprint);
      if (!parsedBlueprint.success) {
        throw Object.assign(new Error('Gemini returned a blueprint that did not match the required case format.'), { code: 'AI_SCHEMA_INVALID', status: 502, cause: parsedBlueprint.error });
      }
      const validBlueprint = parsedBlueprint.data;
      const batch = await generateJsonFn(evidencePrompt(input, validBlueprint), evidenceResponseSchema);
      const parsedEvidence = evidenceBatchSchema.safeParse(batch);
      if (!parsedEvidence.success) {
        throw Object.assign(new Error('Gemini returned evidence that did not match the required case format.'), { code: 'AI_SCHEMA_INVALID', status: 502, cause: parsedEvidence.error });
      }
      let validated;
      try {
        validated = validateGeneratedEvidence(validBlueprint, parsedEvidence.data.evidence, input.difficulty);
      } catch (cause) {
        if (!(cause instanceof CaseConsistencyError)) throw cause;
        throw Object.assign(new Error('The generated clues did not form a consistent mystery. Please try again.'), { code: 'CASE_INCONSISTENT', status: 502, cause });
      }
      return { ...validated, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (['AI_PROVIDER_UNAVAILABLE', 'AI_PROVIDER_TIMEOUT', 'AI_PROVIDER_ERROR'].includes(error.code)) throw error;
    }
  }
  if (lastError?.code) throw lastError;
  throw Object.assign(new Error('Case generation failed. Please try again.'), { code: 'GENERATION_FAILED', status: 502, cause: lastError });
}
