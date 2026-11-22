// The visitor's recent searches, kept only in this browser (localStorage).
// Nothing here is sent to the server. Storage can be blocked or full, so every
// read and write is wrapped in try/catch and the site works without it.

const KEY = 'mse-search-history';
const MAX_ENTRIES = 50;

export function readHistory() {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((e) => e && typeof e.q === 'string') : [];
  } catch {
    return [];
  }
}

// Newest first; searching the same words again moves them to the top.
export function addToHistory(entry) {
  try {
    const rest = readHistory().filter((e) => e.q.toLowerCase() !== entry.q.toLowerCase());
    window.localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, MAX_ENTRIES)));
  } catch {
    // History is a convenience; searching still works without it.
  }
}

export function clearHistory() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
