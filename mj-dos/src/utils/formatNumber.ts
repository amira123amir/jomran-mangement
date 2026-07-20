// Global display-only number formatter.
//
// Rules (per the MJ-DOS number formatting standard):
//   1. Add thousands separators (",") to the integer part.
//   2. Drop trailing ".00" — do not show decimals when the value is a whole number.
//   3. Preserve real decimal values (5.373 stays 5.373, 1400.5 stays 1,400.5).
//   4. Never round or truncate meaningful decimal digits within maxDecimals.
//
// This is a DISPLAY helper. Never feed formatted strings back into
// calculations, never store them, never send them across the wire.

const DEFAULT_MAX_DECIMALS = 3;

export function formatNumber(
  value: number | string | null | undefined,
  maxDecimals: number = DEFAULT_MAX_DECIMALS,
): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return String(value);

  // Round only at the maxDecimals boundary; strip trailing zeros so whole
  // values render without ".00" and fractional values keep their meaningful
  // digits (e.g. 5.373 stays as-is, 100.50 becomes 100.5).
  const withMaxDecimals = n.toFixed(maxDecimals);
  const trimmed = withMaxDecimals.replace(/\.?0+$/, '');
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart, decPart] = unsigned.split('.');

  // Insert thousands separators. Avoid Number(intPart) so very large integers
  // never lose precision on the display path.
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = decPart ? `${intFormatted}.${decPart}` : intFormatted;
  return negative ? `-${body}` : body;
}

// Convenience wrapper for cost/currency rendering. Keeps the currency symbol
// and the number stitched together consistently.
export function formatMoney(
  value: number | string | null | undefined,
  symbol: string,
  maxDecimals: number = DEFAULT_MAX_DECIMALS,
): string {
  const formatted = formatNumber(value, maxDecimals);
  if (!formatted) return '';
  return `${symbol} ${formatted}`;
}
