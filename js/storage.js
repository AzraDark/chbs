/**
 * CHBS · storage.js
 * -----------------------------------------------------------------------
 * Everything CHBS remembers lives in localStorage, on-device only.
 * Nothing is ever sent anywhere — CHBS has no server component.
 * Generated passwords in history are never stored verbatim in plaintext
 * form in this build's default config? — actually they ARE stored
 * (locally only) so the user can retrieve them; this is explicitly a
 * user-controlled, opt-out, local-only convenience feature.
 * -----------------------------------------------------------------------
 */

const CHBSStorage = (() => {
  'use strict';

  const KEYS = {
    prefs: 'chbs.preferences.v1',
    history: 'chbs.history.v1',
    customWords: 'chbs.customWordlist.v1',
    theme: 'chbs.theme.v1'
  };

  const DEFAULT_PREFS = {
    mode: 'everything',           // 'everything' | 'custom'
    defaultMode: 'everything',    // 'everything' | 'max' | 'memorable' — which Password Type chip is the sticky default
    presetLocked: true,           // false once the user hand-edits Advanced Settings away from the selected preset
    wordCount: 5,
    randomWordCount: true,
    wordLengthMin: 4,
    wordLengthMax: 8,
    maxLength: 64,
    templateId: 'random',
    capitalization: 'random-style',
    numbersMode: 'random',
    separatorsEnabled: true,
    symbolsEnabled: false,
    shuffleWordOrder: true,
    saveHistory: true,
    quantity: 1,
    useCustomWordlist: false
  };

  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v === null || v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function loadPrefs() {
    const stored = localStorage.getItem(KEYS.prefs);
    if (!stored) return Object.assign({}, DEFAULT_PREFS);
    return Object.assign({}, DEFAULT_PREFS, safeParse(stored, {}));
  }

  function savePrefs(prefs) {
    localStorage.setItem(KEYS.prefs, JSON.stringify(prefs));
  }

  function loadHistory() {
    return safeParse(localStorage.getItem(KEYS.history), []);
  }

  function addToHistory(entry, maxEntries = 25) {
    const history = loadHistory();
    history.unshift(entry);
    while (history.length > maxEntries) history.pop();
    localStorage.setItem(KEYS.history, JSON.stringify(history));
    return history;
  }

  function clearHistory() {
    localStorage.removeItem(KEYS.history);
  }

  function removeHistoryEntry(id) {
    const history = loadHistory().filter(h => h.id !== id);
    localStorage.setItem(KEYS.history, JSON.stringify(history));
    return history;
  }

  function loadCustomWordlist() {
    return safeParse(localStorage.getItem(KEYS.customWords), null);
  }

  function saveCustomWordlist(words) {
    localStorage.setItem(KEYS.customWords, JSON.stringify(words));
  }

  function clearCustomWordlist() {
    localStorage.removeItem(KEYS.customWords);
  }

  function loadTheme() {
    return localStorage.getItem(KEYS.theme) || 'dark';
  }

  function saveTheme(theme) {
    localStorage.setItem(KEYS.theme, theme);
  }

  return {
    DEFAULT_PREFS, loadPrefs, savePrefs,
    loadHistory, addToHistory, clearHistory, removeHistoryEntry,
    loadCustomWordlist, saveCustomWordlist, clearCustomWordlist,
    loadTheme, saveTheme
  };
})();
