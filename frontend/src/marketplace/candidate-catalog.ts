import { candidates, pipelineCandidate } from './data';

// Both sources already exist in the design data. Lists, dashboard and pipeline share the same pool.
export const recruitmentCandidates = [...candidates, pipelineCandidate];
