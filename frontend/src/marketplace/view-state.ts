'use client';
import { useCallback, useEffect, useState, useSyncExternalStore, type SetStateAction } from 'react';

const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
const prefix = 'talentiq-view-v1:';
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Small, browser-local UI state: filters, drafts and return positions, never credentials. */
export function useViewState<T>(key: string, initial: T) {
  const [fallback] = useState(initial);
  const snapshot = useCallback(() => {
    if (!cache.has(key)) {
      let value = fallback;
      try { const stored = sessionStorage.getItem(prefix + key); if (stored) value = JSON.parse(stored); } catch { /* Keep the view usable without storage. */ }
      cache.set(key, value);
    }
    return cache.get(key) as T;
  }, [key, fallback]);
  const state = useSyncExternalStore(subscribe, snapshot, () => fallback);
  const setState = useCallback((action: SetStateAction<T>) => {
    const value = typeof action === 'function' ? (action as (value: T) => T)(snapshot()) : action;
    cache.set(key, value);
    try { sessionStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* The in-memory state remains available. */ }
    listeners.forEach(listener => listener());
  }, [key, snapshot]);
  return [state, setState] as const;
}

export function useListReturn(key: string) {
  useEffect(() => {
    let position = 0;
    try { position = Number(sessionStorage.getItem(prefix + key + ':scroll')) || 0; } catch { /* Optional. */ }
    const frame = requestAnimationFrame(() => { if (position) window.scrollTo({ top: position, behavior: 'instant' }); });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  return () => {
    try { sessionStorage.setItem(prefix + key + ':scroll', String(window.scrollY)); } catch { /* Optional. */ }
    return window.location.pathname + window.location.search;
  };
}
