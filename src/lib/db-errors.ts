function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}

export const isUniqueViolation = (error: unknown) => hasCode(error, "P2002");
export const isRecordNotFound = (error: unknown) => hasCode(error, "P2025");
