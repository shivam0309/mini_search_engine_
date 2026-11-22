'use client';

import { useEffect } from 'react';
import { addToHistory } from '@/lib/history';

// Adds the current search to the visitor's history (shown on /history).
export default function RememberSearch({ query, total }) {
  useEffect(() => {
    if (query) addToHistory({ q: query, total, at: new Date().toISOString() });
  }, [query, total]);
  return null;
}
