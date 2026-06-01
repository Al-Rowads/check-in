const PHONE_NORMALIZATION_PATTERN = /[\s()+-]/g;

export function normalizePhoneNumber(value: unknown): string {
  return String(value ?? "").trim().replace(PHONE_NORMALIZATION_PATTERN, "");
}

export function looksLikePhoneSearch(value: string): boolean {
  const trimmed = value.trim();

  return /\d/.test(trimmed) && /^[\d\s()+-]+$/.test(trimmed);
}
