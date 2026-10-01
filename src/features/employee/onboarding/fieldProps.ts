/** aria props for an input that may have an error and/or a hint. */
export function describe(id: string, error?: string, hasHint?: boolean) {
  const ids = [error ? `${id}-error` : "", hasHint ? `${id}-hint` : ""].filter(Boolean).join(" ");
  return { "aria-invalid": error ? true : undefined, "aria-describedby": ids || undefined } as const;
}
