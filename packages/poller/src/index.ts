export const DISCOVERY_DEADLINE_MS = 180_000 as const;
export const SOURCE_TIMEOUT_MS = 8_000 as const;

export * from "./adapters";
export * from "./deduplication";
export * from "./http";
export * from "./pipeline";
export * from "./postgrest";
export * from "./repository";
export * from "./scheduler";
export * from "./types";
