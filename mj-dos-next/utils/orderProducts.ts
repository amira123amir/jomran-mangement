import type { Order, OrderProduct, OrderPricing } from '../types';

// Shared read helpers for the multi-product order model. Keep all "how do I
// summarise / group products" logic here so components and the store agree.

/** First product name + a "+N أخرى" suffix when the order has more than one. */
export function productSummary(order: Pick<Order, 'products'>): string {
  const products = order.products || [];
  if (products.length === 0) return '—';
  const first = products[0].productName || '—';
  if (products.length === 1) return first;
  return `${first} +${products.length - 1} أخرى`;
}

/** Total quantity across every product in the order. */
export function totalQuantity(order: Pick<Order, 'products'>): number {
  return (order.products || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
}

/** Distinct category labels, joined — for list/table columns. */
export function categorySummary(order: Pick<Order, 'products'>): string {
  const labels = Array.from(
    new Set((order.products || []).map((p) => p.categoryLabel).filter(Boolean)),
  );
  return labels.length ? labels.join('، ') : '—';
}

/** All pricing versions for one product, in submission order. */
export function pricingForProduct(order: Pick<Order, 'pricingHistory'>, productId: string): OrderPricing[] {
  return (order.pricingHistory || []).filter((p) => p.productId === productId);
}

/** The latest pricing version for one product, or null. */
export function latestPricingForProduct(
  order: Pick<Order, 'pricingHistory'>,
  productId: string,
): OrderPricing | null {
  const list = pricingForProduct(order, productId);
  return list.length ? list[list.length - 1] : null;
}

/** True once every product in the order has at least one pricing version. */
export function allProductsPriced(order: Pick<Order, 'products' | 'pricingHistory'>): boolean {
  const products = order.products || [];
  if (products.length === 0) return false;
  return products.every((p) => pricingForProduct(order, p.id).length > 0);
}

/** Products still missing a pricing version. */
export function unpricedProducts(order: Pick<Order, 'products' | 'pricingHistory'>): OrderProduct[] {
  return (order.products || []).filter((p) => pricingForProduct(order, p.id).length === 0);
}

/** Sum of the latest per-product base totals (RMB / USD) — the quote base. */
export function orderBaseTotals(order: Pick<Order, 'products' | 'pricingHistory'>): { rmb: number; usd: number } {
  let rmb = 0;
  let usd = 0;
  for (const p of order.products || []) {
    const lp = latestPricingForProduct(order, p.id);
    if (lp) {
      rmb += lp.totalRMB;
      usd += lp.totalUSD;
    }
  }
  return { rmb: +rmb.toFixed(3), usd: +usd.toFixed(3) };
}
