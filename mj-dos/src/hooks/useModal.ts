import { useEffect, useRef } from 'react';

// Shared modal keyboard/lifecycle helper.
//
// Every modal in MJ-DOS must:
//   1. Close when the user presses Escape (unless an operation is in-flight
//      and the caller explicitly locks it).
//   2. Never trap the user — the Cancel/Close button must always work.
//
// Prior to this hook the codebase had no ESC handling at all, which combined
// with a synchronous export flow made the quotation dialog feel frozen. This
// hook installs a single document-level keydown listener while the modal is
// open and tears it down on close/unmount — no orphaned listeners, no state
// out-of-sync with the DOM.
export interface UseModalOptions {
  // When true, ESC will NOT close the modal (e.g. while a save/export is
  // running). The Close button remains functional either way — locking only
  // suppresses the keyboard shortcut.
  locked?: boolean;
  // TEMP DIAGNOSTIC: when set, this hook emits [PROFORMA_DEBUG]-prefixed logs
  // for every effect run, listener add/remove, and ESC keypress. Opt-in per
  // caller so other modals stay silent. Remove after diagnosis.
  debugTag?: string;
}

export function useModal(open: boolean, onClose: () => void, opts: UseModalOptions = {}): void {
  const locked = !!opts.locked;
  const debugTag = opts.debugTag;
  // Callers typically pass inline arrow functions, so `onClose` is a fresh
  // reference on every render. Keeping it in a ref lets the main effect below
  // depend only on `open`/`locked`/`debugTag` — otherwise the keydown listener
  // would be detached and re-attached on every parent render, which under a
  // 1 Hz forced-tick or any store update turns into visible churn (and, when
  // combined with the PDF popup's window.print, an apparent tab freeze).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (debugTag) console.log(`[PROFORMA_DEBUG] useModal(${debugTag}) effect START open=${open} locked=${locked} at ${new Date().toISOString()}`);
    if (!open) {
      if (debugTag) console.log(`[PROFORMA_DEBUG] useModal(${debugTag}) effect END (not open, no listener attached)`);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (debugTag) console.log(`[PROFORMA_DEBUG] useModal(${debugTag}) ESC keypress captured, locked=${locked}`);
      if (locked) return;
      // Preserve any focused-element behaviour; we just want to close the
      // modal reliably. stopPropagation avoids closing nested overlays that
      // may listen on the same document.
      e.stopPropagation();
      onCloseRef.current();
    };
    // Capture phase so the listener runs before any bubble-phase handlers
    // that might swallow the event.
    if (debugTag) console.log(`[PROFORMA_DEBUG] useModal(${debugTag}) addEventListener('keydown', capture)`);
    document.addEventListener('keydown', handler, true);
    if (debugTag) console.log(`[PROFORMA_DEBUG] useModal(${debugTag}) effect END (listener attached)`);
    return () => {
      if (debugTag) console.log(`[PROFORMA_DEBUG] useModal(${debugTag}) CLEANUP removeEventListener('keydown', capture) at ${new Date().toISOString()}`);
      document.removeEventListener('keydown', handler, true);
    };
  }, [open, locked, debugTag]);
}
