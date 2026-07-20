// Shared date/time helpers used across stores and hooks. Consolidates the
// duplicated `formatNow`, `formatDeadline`, and `pad` functions that previously
// existed in orderStore.ts, auditStore.ts, and useLiveTimer.ts.

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatNow(): { date: string; time: string; timestamp: string } {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return { date, time, timestamp: `${date} ${time}` };
}

export function formatNowISO(): { date: string; time: string; timestamp: string } {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  return { date, time, timestamp: d.toISOString() };
}

/** Returns "HH:MM:SS" display for a remaining milliseconds count. */
export function formatDeadlineDisplay(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

// Deadlines default to 6 hours from now. Exported as a named constant so
// consumers never need to hardcode the magic number.
export const DEADLINE_HOURS = 6;

/** Build a deadline timestamp string 6 hours from now. */
export function buildDeadlineAt(): string {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + DEADLINE_HOURS);
  return `${deadline.getFullYear()}-${pad2(deadline.getMonth() + 1)}-${pad2(deadline.getDate())} ${pad2(deadline.getHours())}:${pad2(deadline.getMinutes())}:${pad2(deadline.getSeconds())}`;
}
