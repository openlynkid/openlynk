import { headers } from "next/headers";
import { auth } from "./index";
import type { Session, User } from "./index";

export type AuthenticatedUser = User;

export interface SessionResult {
  user: AuthenticatedUser;
  session: Session;
}

/**
 * Resolves the signed-in user for a server component or route handler.
 *
 * Returns `null` rather than throwing, so a caller can choose between a 401 (API) and a
 * redirect (page). Every creator route needs this, and duplicating the header plumbing
 * in each one is how the two drift.
 */
export async function getSessionUser(
  requestHeaders?: Headers
): Promise<SessionResult | null> {
  const resolved = requestHeaders ?? (await headers());
  const result = await auth.api.getSession({ headers: resolved });
  if (!result?.user) return null;
  return { user: result.user, session: result.session };
}
