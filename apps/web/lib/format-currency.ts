export function formatCurrency(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits }).format(value);
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  return new Date(value).toLocaleDateString('en-IN', options);
}
