// The React side of lib/permissions.ts: the signed-in person and what they may do.
// Pages and buttons use these instead of checking roles themselves.

import { useAuth } from "@/features/auth/AuthContext";
import { can, canFor, scopeFor, type Action, type Feature, type Who } from "./permissions";
import { whoFor } from "./session";

/** The signed-in person (role, own employee record, team), read fresh on each render. */
export function useWho(): Who {
  const { user } = useAuth();
  return whoFor(user?.accountId);
}

/** can(user, action, feature), or for one employee's record when an ID is given. */
export function useCan(action: Action, feature: Feature, employeeId?: string) {
  const who = useWho();
  return employeeId === undefined ? can(who, action, feature) : canFor(who, action, feature, employeeId);
}

/** All, team, own, or null (no access). */
export function useScope(action: Action, feature: Feature) {
  return scopeFor(useWho(), action, feature);
}
