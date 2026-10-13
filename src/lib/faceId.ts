// Who has enrolled their Face ID (for clocking in with a face scan). Kept per employee in
// localStorage, so a new account starts without one and the choice survives a reload.

const KEY = "heyhr-face-enrolled-v1";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isFaceEnrolled(employeeId: string): boolean {
  return load().includes(employeeId);
}

export function markFaceEnrolled(employeeId: string) {
  const ids = load();
  if (ids.includes(employeeId)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids, employeeId]));
  } catch {
    // Not kept after a reload; fine in the prototype.
  }
}
