import type { Order, OrderStatus } from '../types';
import { QUEUE_FILTERS } from '../utils/orderStatus';

// Shared status-filter chip bar used by both the Procurement queue and the
// Sales orders page. All 15 workflow statuses (plus "All Orders") come from
// QUEUE_FILTERS in src/utils/orderStatus.ts — the single source of truth for
// labels and ordering. Counts are computed from the caller-supplied
// `authorizedOrders` so each page shows only what the current user can see.
//
// This is a presentation-layer control: clicking a chip fires onFilterChange
// with the QUEUE_FILTERS id. Nothing mutates order.status or writes to the
// store.

interface Props {
  authorizedOrders: Order[];
  activeFilterId: string;
  onFilterChange: (id: string) => void;
  className?: string;
}

export default function OrderStatusFilterBar({
  authorizedOrders,
  activeFilterId,
  onFilterChange,
  className,
}: Props) {
  return (
    <div className={`pw-filters ${className || ''}`.trim()}>
      {QUEUE_FILTERS.map((f) => {
        const count = authorizedOrders.filter((o) => f.match(o.status as OrderStatus)).length;
        const active = activeFilterId === f.id;
        return (
          <button
            key={f.id}
            type="button"
            className={`pw-filter-chip ${active ? 'active' : ''}`}
            onClick={() => onFilterChange(f.id)}
          >
            {f.label}
            {f.department && <span className="pw-filter-chip-dept">{f.department}</span>}
            <span className="pw-filter-chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
