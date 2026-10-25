import { validatePlayableCase } from '../schemas/caseSchema.js';

export function validateGeneratedEvidence(blueprint, evidence, difficulty) {
  return validatePlayableCase(blueprint, evidence, difficulty);
}
