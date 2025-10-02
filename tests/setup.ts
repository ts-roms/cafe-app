// Global test setup for Jest

// Ensure localStorage is clean before each test
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

// Some parts of the app use crypto.randomUUID; provide a stable fallback if missing
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = {} as any;
}
if (!(globalThis as any).crypto.randomUUID) {
  (globalThis as any).crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}
