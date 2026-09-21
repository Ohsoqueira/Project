export type PricedLine = {
  quantity: number | string;
  unitPrice: number | string;
  taxable: boolean;
};

export function computeTotals(lines: PricedLine[], taxRatePercents: number[]) {
  const subtotal = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);
  const taxableSubtotal = lines
    .filter((l) => l.taxable)
    .reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);
  const tax = taxRatePercents.reduce((sum, rate) => sum + taxableSubtotal * rate, 0);
  return { subtotal, tax, total: subtotal + tax };
}
