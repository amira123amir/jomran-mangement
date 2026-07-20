// Global Arabic/Farsi numeral normalization.
//
// Users may type numbers on an Arabic keyboard ("٠١٢٣٤٥٦٧٨٩") or a
// Farsi/Persian keyboard ("۰۱۲۳۴۵۶۷۸۹"). Internally every value must be
// ASCII digits so validation, parseFloat, calculations, formatting, and
// export utilities work uniformly. Implement the conversion once, apply it
// everywhere.

const ARABIC_INDIC_ZERO = 0x0660;   // ٠
const ARABIC_INDIC_NINE = 0x0669;   // ٩
const FARSI_ZERO        = 0x06F0;   // ۰
const FARSI_NINE        = 0x06F9;   // ۹

export function normalizeDigits(input: string): string {
  if (!input) return input;
  let out = '';
  let mutated = false;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_NINE) {
      out += String.fromCharCode(0x30 + (code - ARABIC_INDIC_ZERO));
      mutated = true;
    } else if (code >= FARSI_ZERO && code <= FARSI_NINE) {
      out += String.fromCharCode(0x30 + (code - FARSI_ZERO));
      mutated = true;
    } else {
      out += input.charAt(i);
    }
  }
  return mutated ? out : input;
}

// Convenience: parse a string that may contain Arabic/Farsi digits.
export function parseArabicNumber(input: string): number {
  const n = parseFloat(normalizeDigits(input));
  return Number.isFinite(n) ? n : 0;
}

// Install a single document-level capture-phase listener that rewrites the
// value of any <input>/<textarea> before React's bubble-phase onChange fires.
// React tracks the "last known value" via _valueTracker on the DOM node; using
// the native property setter makes React notice the change during its normal
// event dispatch, so downstream state updates receive the normalized string.
export function installGlobalDigitNormalizer(): () => void {
  if (typeof document === 'undefined') return () => {};

  const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

  const handleInput = (ev: Event) => {
    const target = ev.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target) return;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
    // Skip inputs where a raw digit character actually matters (password
    // inputs, etc). Numeric type=number is intentionally excluded from this
    // file — those inputs are migrated to type=text inputMode=decimal so the
    // browser doesn't strip the Arabic character before we ever see it.
    if (target instanceof HTMLInputElement) {
      const t = target.type;
      if (t === 'password' || t === 'file' || t === 'color' || t === 'range') return;
    }
    const original = target.value;
    const normalized = normalizeDigits(original);
    if (normalized === original) return;

    const setter = target instanceof HTMLInputElement ? inputSetter : textareaSetter;
    if (!setter) {
      target.value = normalized;
    } else {
      setter.call(target, normalized);
    }
    // Ensure any listener attached in the bubble phase (React's synthetic
    // event dispatcher included) reads the normalized value.
    // The native `input` event still propagates; we only mutated the DOM
    // value, not the event object, so React will read the fresh value.
  };

  document.addEventListener('input', handleInput, true);
  return () => document.removeEventListener('input', handleInput, true);
}
