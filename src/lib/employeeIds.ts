// Employee IDs for new hires: YYYY-MM-DD, starting from the hire day. The
// first person hired on Sep 23, 2026 is 2026-09-23; a second hire that same
// day is 2026-09-24, a third 2026-09-25, and so on. Same-day hires are
// ordered alphabetically by last name, then first name.
//
// IDs must stay unique, so each person takes their hire day or the number
// after the person before them, whichever is later — a Sep 24 hire coming
// after two Sep 23 hires is 2026-09-25. (A very busy month can run past 31.)
//
// A later entry can sort ahead of someone already added (an earlier day, or a
// same-day surname that comes first), so IDs within a month are recomputed on
// every add and the caller re-keys any record whose ID moved.

export interface IdCandidate {
  /** Current ID, or undefined for the person being added. */
  id?: string;
  /** ISO date, "2026-09-29". */
  dateHired: string;
  lastName: string;
  firstName: string;
}

const ID_PATTERN = /^\d{4}-\d{2}-\d{2,}$/;

/** True for IDs issued under the hire-date scheme (not the older MSMA-xxxxx seed IDs). */
export function isHireDateId(id: string) {
  return ID_PATTERN.test(id);
}

function compareHires(a: IdCandidate, b: IdCandidate) {
  return (
    a.dateHired.localeCompare(b.dateHired) ||
    a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" }) ||
    a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" })
  );
}

/**
 * IDs for everyone hired in the same month as `candidate`, including them.
 * Returns the new hire's ID and a map of existing IDs that change.
 */
export function assignHireDateIds(candidate: IdCandidate, existing: IdCandidate[]) {
  const month = candidate.dateHired.slice(0, 7);
  const sameMonth = existing.filter((e) => e.dateHired.slice(0, 7) === month);
  const ordered = [...sameMonth, candidate].sort(compareHires);

  const renamed = new Map<string, string>();
  let newId = "";
  let last = 0;
  for (const person of ordered) {
    const day = Number(person.dateHired.slice(8, 10));
    const n = Math.max(day, last + 1);
    last = n;
    const id = `${month}-${String(n).padStart(2, "0")}`;
    if (person === candidate) newId = id;
    else if (person.id && person.id !== id) renamed.set(person.id, id);
  }
  return { newId, renamed };
}
