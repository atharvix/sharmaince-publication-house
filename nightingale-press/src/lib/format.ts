const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fractional = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** Formats a rupee amount: "₹1,234" when whole, "₹1,234.50" otherwise. */
export function formatRupees(amount: number) {
  return (Number.isInteger(amount) ? whole : fractional).format(amount);
}

/** Formats paise as rupees, e.g. 123450 -> "₹1,234.50". */
export function formatMinor(amountMinor: number) {
  return formatRupees(amountMinor / 100);
}

/** Turns an API enum like PENDING_PAYMENT into "Pending payment". */
export function humanizeEnum(value: string) {
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
