// Browser features the website's code uses that a phone doesn't have. On the web they already exist.

const g = globalThis as Record<string, unknown>;

// Per-launch flags (sign-in markers): kept in memory, cleared when the app is closed, like a browser tab.
if (typeof g.sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  g.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

// The mock API copies its answers. shortcut: a JSON copy drops Dates and files, which its data doesn't hold; swap for a full clone if that changes.
if (typeof g.structuredClone !== 'function') {
  g.structuredClone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
}

// On the phone, localStorage is the on-device database (expo-sqlite): every read is a database query, and the
// website's code reads the signed-in account on most checks. Keep a copy in memory: reads come from memory,
// writes go to both. (The app is the only writer, so the copy never goes stale.)
if (process.env.EXPO_OS !== 'web' && g.localStorage) {
  const disk = g.localStorage as Storage;
  const memory = new Map<string, string | null>();
  g.localStorage = {
    getItem(k: string) {
      if (!memory.has(k)) memory.set(k, disk.getItem(k));
      return memory.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      memory.set(k, String(v));
      disk.setItem(k, String(v));
    },
    removeItem(k: string) {
      memory.set(k, null);
      disk.removeItem(k);
    },
    clear() {
      memory.clear();
      disk.clear();
    },
    key: (i: number) => disk.key(i),
    get length() {
      return disk.length;
    },
  };
}
