/** Formats an amount in paise as rupees for display, e.g. 123450 -> "₹1,234.50". */
export function formatInr(amountMinor: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amountMinor / 100);
}

/** Converts a rupee amount from an API body to paise, rejecting sub-paise precision. */
export function rupeesToMinor(rupees: number) {
  return Math.round(rupees * 100);
}

/** Converts stored paise to rupees for API responses. */
export function minorToRupees(amountMinor: number) {
  return amountMinor / 100;
}
