// Shared string helpers. Consolidates `escapeHtml` / `escapeXml` duplicates
// that previously existed in xlsxWriter.ts and quotationExport.ts.

/** Escape special characters for safe insertion into HTML content. */
export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape special characters for safe insertion into XML attributes/content. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Unique ID generation ──────────────────────────────────────────────────
// Replaces the fragile module-scoped counter pattern (e.g. `let orderCounter`)
// that collided across HMR hot reloads. Uses crypto.randomUUID when available
// (all modern browsers + Node 19+), falls back to Date.now + Math.random.

let idCounter = 0;

export function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${++idCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
