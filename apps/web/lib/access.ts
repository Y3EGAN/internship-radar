export type AccessDecision = "owner" | "anonymous" | "non_owner";

export function dashboardAccessDecision(userId: string | null, ownerId: string): AccessDecision {
  if (userId === null) return "anonymous";
  return userId === ownerId ? "owner" : "non_owner";
}
