export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ApiCategory {
  id?: string;
  name: string;
  slug: string;
  bookCount?: number;
}

export interface ApiAuthorRef {
  id?: string;
  slug: string;
  name: string;
}

export interface ApiAuthor extends ApiAuthorRef {
  credentials: string;
  bio: string;
  books: { slug: string; title: string }[];
}

export type ApiAvailability = 'IN_STOCK' | 'PRE_ORDER' | 'OUT_OF_STOCK';
export type ApiFormat = 'PAPERBACK' | 'HARDBOUND' | 'EBOOK';

export interface ApiBook {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  price: number;
  currency: string;
  edition: string;
  format: ApiFormat;
  isbn: string;
  pages: number;
  availability: ApiAvailability;
  inStock: boolean;
  description: string;
  highlights: string[];
  coverPalette: 'pine' | 'amber' | 'clay' | 'slate';
  coverImageUrl: string | null;
  featured: boolean;
  newRelease: boolean;
  category: ApiCategory;
  authors: ApiAuthorRef[];
}

export interface ApiAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export type ApiOrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface ApiOrderItem {
  id: string;
  bookId: string;
  titleSnapshot: string;
  authorSnapshot: string;
  priceMinorSnapshot: number;
  quantity: number;
  lineTotalMinor: number;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: ApiOrderStatus;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  shippingAddress: ApiAddress;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: ApiOrderItem[];
}

export interface ApiWishlistItem {
  id: string;
  bookId: string;
  book: ApiBook;
}

export interface ApiQuoteLine {
  bookId: string;
  slug: string;
  title: string;
  authorNames: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface ApiQuote {
  lines: ApiQuoteLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  promotion: { id: string; code: string } | null;
}
