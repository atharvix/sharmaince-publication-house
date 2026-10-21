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
  promotion: { id: string; code: string } | null;
}

const FREE_SHIPPING_THRESHOLD_MINOR = 100_000; // ₹1,000
const FLAT_SHIPPING_MINOR = 6_000; // ₹60

/**
 * Recomputes the authoritative price of a cart from current catalogue data —
 * the client's displayed prices are never trusted for order creation.
 */
export async function priceCart(lines: CartLineInput[], promotionCode?: string): Promise<PricedQuote> {
  if (lines.length === 0) throw AppError.badRequest('Your cart is empty');

  const bookIds = lines.map((line) => line.bookId);
  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    include: { authors: { include: { author: true } } },
  });

  const bookMap = new Map(books.map((book) => [book.id, book]));
  const pricedLines: PricedLine[] = [];

  for (const line of lines) {
    const book = bookMap.get(line.bookId);
    if (!book || book.status !== 'PUBLISHED') {
      throw AppError.badRequest(`One of the items in your cart is no longer available`, { bookId: line.bookId });
    }
    if (line.quantity < 1 || line.quantity > 20) {
      throw AppError.badRequest('Quantity must be between 1 and 20');
    }
    if (book.stockQuantity < line.quantity) {
      throw AppError.conflict(`"${book.title}" only has ${book.stockQuantity} left in stock`);
    }

    pricedLines.push({
      bookId: book.id,
      slug: book.slug,
      title: book.title,
      authorNames: book.authors.map((a) => a.author.name).join(' & '),
      quantity: line.quantity,
      unitPriceMinor: book.priceMinor,
      lineTotalMinor: book.priceMinor * line.quantity,
    });
  }

  const subtotalMinor = pricedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

  let discountMinor = 0;
  let promotion: PricedQuote['promotion'] = null;

  if (promotionCode) {
    const promo = await prisma.promotion.findUnique({ where: { code: promotionCode.toUpperCase() } });
    const now = new Date();
    const isUsable =
      promo &&
      promo.isActive &&
      (!promo.startsAt || promo.startsAt <= now) &&
      (!promo.endsAt || promo.endsAt >= now) &&
      (!promo.minSpendMinor || subtotalMinor >= promo.minSpendMinor) &&
      (!promo.maxRedemptions || promo.redeemedCount < promo.maxRedemptions);

    if (!isUsable) throw AppError.badRequest('This promotion code is not valid for your order');

    discountMinor =
      promo.discountType === 'PERCENT'
        ? Math.round((subtotalMinor * promo.discountValue) / 100)
        : Math.min(promo.discountValue, subtotalMinor);
    promotion = { id: promo.id, code: promo.code };
  }

  const taxableBase = subtotalMinor - discountMinor;
  const shippingMinor = taxableBase >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : FLAT_SHIPPING_MINOR;
  const taxMinor = 0; // Books are nil-rated for GST in the common case; revisit if the catalogue expands.
  const totalMinor = taxableBase + shippingMinor + taxMinor;

  return { lines: pricedLines, subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor, promotion };
}
