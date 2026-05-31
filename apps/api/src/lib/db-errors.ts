import { isRecord, isString } from "./type-guards";

export function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;

  const directCode = error.code;
  if (isString(directCode)) return directCode;

  const cause = error.cause;
  if (isRecord(cause) && isString(cause.code)) {
    return cause.code;
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === "23505") return true;

  if (isRecord(error) && isString(error.message)) {
    return error.message.toLowerCase().includes("unique constraint");
  }

  return false;
}
