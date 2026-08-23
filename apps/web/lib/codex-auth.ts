import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isAuthorizedCodexRequest(authorization: string | null, expectedToken: string | undefined) {
  if (!authorization?.startsWith("Bearer ") || !expectedToken || expectedToken.length < 32) return false;
  return timingSafeEqual(digest(authorization.slice(7)), digest(expectedToken));
}
