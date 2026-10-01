/** aria props for an input that may have an error and/or a hint. */
export function describe(id: string, error?: string, hasHint?: boolean) {
  const ids = [error ? `${id}-error` : "", hasHint ? `${id}-hint` : ""].filter(Boolean).join(" ");
  return { "aria-invalid": error ? true : undefined, "aria-describedby": ids || undefined } as const;
}

/** Reads a nested error message ("extras.provCity") from react-hook-form's error tree. */
export function errorAt(errors: unknown, path: string): string | undefined {
  const node = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), errors);
  return node && typeof node === "object" && "message" in node ? String((node as { message?: unknown }).message ?? "") || undefined : undefined;
}
