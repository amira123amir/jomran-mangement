import { useState, useEffect } from 'react';

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
  const pad = (n: number) => String(n).padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s) };
}

export function formatDeadline(ms: number): { text: string; expired: boolean; pct: number } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    text: `${pad(h)}:${pad(m)}:${pad(s)}`,
    expired: ms <= 0,
    pct: ms <= 0 ? 100 : Math.min(100, ((6 * 3600 * 1000 - ms) / (6 * 3600 * 1000)) * 100),
  };
}
