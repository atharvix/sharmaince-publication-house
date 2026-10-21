export interface Category {
  name: string;
  slug: string;
  bookCount?: number;
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  category: Category;
  price: number;
  edition: string;
  format: 'Paperback' | 'Hardbound' | 'E-Book';
  isbn: string;
  pages: number;
  availability: 'In Stock' | 'Pre-Order' | 'Out of Stock';
  description: string;
  highlights: string[];
  coverPalette: 'pine' | 'amber' | 'clay' | 'slate';
  coverImageUrl?: string | null;
  featured?: boolean;
  newRelease?: boolean;
}

export interface Author {
  slug: string;
  name: string;
  credentials: string;
  bio: string;
  books: { slug: string; title: string }[];
}

export interface Faq {
  question: string;
  answer: string;
  topic: string;
}
