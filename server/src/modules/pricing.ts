import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export interface CartLineInput {
  bookId: string;
  quantity: number;
}

export interface PricedLine {
  bookId: string;
  slug: string;
  title: string;
  authorNames: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface PricedQuote {
  lines: PricedLine[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  promotion: { id: string; code: string; maxRedemptions: number | null } | null;
}

export const MAX_QUANTITY_PER_TITLE = 20;
const FREE_SHIPPING_THRESHOLD_MINOR = 100_000; // ₹1,000
const FLAT_SHIPPING_MINOR = 6_000; // ₹60

/** Combines repeated lines for the same book so stock and quantity limits apply to the total. */
function mergeLines(lines: CartLineInput[]) {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.bookId, (merged.get(line.bookId) ?? 0) + line.quantity);
  return [...merged].map(([bookId, quantity]) => ({ bookId, quantity }));
}

/**
 * Recomputes the authoritative price of a cart from current catalogue data —
 * the client's displayed prices are never trusted for order creation.
 */
export async function priceCart(input: CartLineInput[], promotionCode?: string): Promise<PricedQuote> {
  const lines = mergeLines(input);
  if (lines.length === 0) throw AppError.badRequest('Your cart is empty');

  const books = await prisma.book.findMany({
    where: { id: { in: lines.map((line) => line.bookId) } },
    include: { authors: { include: { author: true } } },
  });
  const bookMap = new Map(books.map((book) => [book.id, book]));

  const pricedLines = lines.map((line): PricedLine => {
    const book = bookMap.get(line.bookId);
    if (!book || book.status !== 'PUBLISHED') {
      throw AppError.badRequest('One of the items in your cart is no longer available', { bookId: line.bookId });
    }
    if (line.quantity > MAX_QUANTITY_PER_TITLE) {
      throw AppError.badRequest(`You can order at most ${MAX_QUANTITY_PER_TITLE} copies of "${book.title}"`);
    }
    if (book.stockQuantity < line.quantity) {
      throw AppError.conflict(`"${book.title}" only has ${book.stockQuantity} left in stock`);
    }
    return {
      bookId: book.id,
      slug: book.slug,
      title: book.title,
      authorNames: book.authors.map((a) => a.author.name).join(' & '),
      quantity: line.quantity,
      unitPriceMinor: book.priceMinor,
      lineTotalMinor: book.priceMinor * line.quantity,
    };
  });

  const subtotalMinor = pricedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

  let discountMinor = 0;
  let promotion: PricedQuote['promotion'] = null;

  if (promotionCode) {
    const promo = await prisma.promotion.findUnique({ where: { code: promotionCode.trim().toUpperCase() } });
    const now = new Date();
    const isUsable =
      promo &&
      promo.isActive &&
      (!promo.startsAt || promo.startsAt <= now) &&
      (!promo.endsAt || promo.endsAt >= now) &&
      (!promo.minSpendMinor || subtotalMinor >= promo.minSpendMinor) &&
      (promo.maxRedemptions === null || promo.redeemedCount < promo.maxRedemptions);

    if (!isUsable) throw AppError.badRequest('This promotion code is not valid for your order');

    const rawDiscount =
      promo.discountType === 'PERCENT' ? Math.round((subtotalMinor * promo.discountValue) / 100) : promo.discountValue;
    discountMinor = Math.min(rawDiscount, subtotalMinor);
    promotion = { id: promo.id, code: promo.code, maxRedemptions: promo.maxRedemptions };
  }

  const discountedSubtotal = subtotalMinor - discountMinor;
  const shippingMinor = discountedSubtotal >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : FLAT_SHIPPING_MINOR;
  // Printed books are GST-exempt in India. E-books are not (18%) — this must be revisited
  // before EBOOK titles are sold through checkout.
  const taxMinor = 0;
  const totalMinor = discountedSubtotal + shippingMinor + taxMinor;

  return { lines: pricedLines, subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor, promotion };
}
