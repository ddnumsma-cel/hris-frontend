// A password strength meter: four segments that fill from the left and a word (Weak, Fair, Good,
// Strong), so the strength isn't told by colour alone. Only a guide: it never blocks anyone (the
// company's minimum length is checked by the form). Styles: .pw-meter in index.css.

export type Strength = 0 | 1 | 2 | 3 | 4;

/** One point each for 8+ characters, mixed case, a digit and a symbol; under 6 is Weak, under 10 can't be Strong. */
export function strengthOf(password: string): Strength {
  if (!password) return 0;
  const points = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const cap = password.length < 6 ? 1 : password.length < 10 ? 3 : 4;
  return Math.max(1, Math.min(points, cap)) as Strength;
}

const LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;

/** Put under the field and point the input's aria-describedby at `id`. */
export function PasswordStrength({ password, id }: { password: string; id: string }) {
  const level = strengthOf(password);
  return (
    <div className="pw-meter mt-2" data-level={level}>
      <div className="pw-segments" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p id={id} aria-live="polite" className="pw-label mt-1 text-xs font-medium">
        {level ? `Password strength: ${LABELS[level]}` : ""}
      </p>
    </div>
  );
}
