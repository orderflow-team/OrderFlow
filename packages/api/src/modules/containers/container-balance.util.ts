export interface ContainerMovement {
  type: 'delivered' | 'returned' | 'adjustment';
  quantity: number | string;
}

/**
 * Empties a customer still holds for one product: everything delivered, minus everything handed
 * back, plus signed adjustments. Never negative: handing back more than was delivered (e.g. empties
 * from before the business started tracking) must not show the shop as owing the customer jars.
 */
export function pendingEmpties(movements: ContainerMovement[]): number {
  let total = 0;
  for (const m of movements) {
    const q = Number(m.quantity);
    if (m.type === 'returned') total -= q;
    else total += q;
  }
  return Math.max(0, Math.round(total * 100) / 100);
}
