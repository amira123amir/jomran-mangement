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
}

export function useModal(open: boolean, onClose: () => void, opts: UseModalOptions = {}): void {
  const locked = !!opts.locked;
  // Callers typically pass inline arrow functions, so `onClose` is a fresh
  // reference on every render. Keeping it in a ref lets the main effect below
  // depend only on `open`/`locked` — otherwise the keydown listener would be
  // detached and re-attached on every parent render, which under a 1 Hz
  // forced-tick or any store update turns into visible churn.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (locked) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
    };
  }, [open, locked]);
}
