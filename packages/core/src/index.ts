import { z } from "zod";

export type { Database, Json } from "./database.types";
export * from "./discovery";
export * from "./normalization";
export * from "./scoring";

export const SCORE_COMPONENT_MAXIMUMS = {
  domain: 30,
  skill: 30,
  evidence: 20,
  location: 10,
  eligibilityFreshness: 10,
} as const;

export const scoreComponentSchema = z.object({
  domain: z.number().int().min(0).max(SCORE_COMPONENT_MAXIMUMS.domain),
  skill: z.number().int().min(0).max(SCORE_COMPONENT_MAXIMUMS.skill),
  evidence: z.number().int().min(0).max(SCORE_COMPONENT_MAXIMUMS.evidence),
  location: z.number().int().min(0).max(SCORE_COMPONENT_MAXIMUMS.location),
  eligibilityFreshness: z.number().int().min(0).max(SCORE_COMPONENT_MAXIMUMS.eligibilityFreshness),
});

export type ScoreComponents = z.infer<typeof scoreComponentSchema>;

export function totalScore(score: ScoreComponents): number {
  return Object.values(score).reduce((total, component) => total + component, 0);
}
