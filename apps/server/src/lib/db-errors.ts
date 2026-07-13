function hasUniqueViolationCode(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}

// O driver `pg` lança um erro com `.code`, mas o Drizzle o envolve numa
// DrizzleQueryError com o erro original em `.cause` — checar os dois níveis.
export function isUniqueViolation(err: unknown): boolean {
  if (hasUniqueViolationCode(err)) return true;
  if (typeof err === "object" && err !== null && "cause" in err) {
    return hasUniqueViolationCode((err as { cause: unknown }).cause);
  }
  return false;
}
