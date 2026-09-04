/**
 * Progress that survives closing the tab.
 *
 * Safari in private browsing throws on localStorage access, and this game is
 * absolutely not worth a crash, so every call is wrapped.
 */

import { normalizeProgress } from '../core/progress.js';

const KEY = 'dots-writing-quest.v1';

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return normalizeProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeProgress(null);
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
