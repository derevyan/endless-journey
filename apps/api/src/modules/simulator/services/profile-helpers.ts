import type { PersonaProfile } from "@journey/schemas";

import { isRecord, isString } from "../../../lib/type-guards";

export function normalizePersonaProfile(value: unknown): PersonaProfile {
  if (!isRecord(value)) {
    return {};
  }

  const profile: PersonaProfile = {};

  if (isString(value.firstName)) {
    profile.firstName = value.firstName;
  }
  if (isString(value.lastName)) {
    profile.lastName = value.lastName;
  }
  if (isString(value.username)) {
    profile.username = value.username;
  }
  if (isString(value.languageCode)) {
    profile.languageCode = value.languageCode;
  }

  return profile;
}

export function normalizeUserVars(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}
