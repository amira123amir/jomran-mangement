import { useState, useEffect } from 'react';
import { formatDeadlineDisplay, DEADLINE_HOURS, pad2 } from '../utils/dateHelpers';

export function useLiveTimer(intervalMs = 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function formatElapsed(createdAt: string): { h: string; m: string; s: string } {
  const diff = Date.now() - new Date(createdAt.replace(' ', 'T')).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h: pad2(h), m: pad2(m), s: pad2(s) };
}

export function formatDeadline(ms: number): { text: string; expired: boolean; pct: number } {
  const totalMs = DEADLINE_HOURS * 3600 * 1000;
  return {
    text: formatDeadlineDisplay(ms),
    expired: ms <= 0,
    pct: ms <= 0 ? 100 : Math.min(100, ((totalMs - ms) / totalMs) * 100),
  };
}
