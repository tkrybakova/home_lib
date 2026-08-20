export class BookCache {
  constructor({ ttlMs = Number(process.env.BOOK_CACHE_TTL_MS || 24 * 60 * 60 * 1000) } = {}) {
    this.books = new Map();
    this.ttlMs = Math.max(0, ttlMs);
  }

  getFresh(isbn) {
    const entry = this.books.get(isbn);
    if (!entry) return null;

    if (this.ttlMs === 0 || Date.now() - entry.cachedAt > this.ttlMs) {
      this.books.delete(isbn);
      return null;
    }

    return { ...entry.book, cache: { hit: true, cachedAt: entry.cachedAt } };
  }

  upsert(book) {
    if (book?.isbn) {
      this.books.set(book.isbn, {
        book: { ...book },
        cachedAt: Date.now(),
      });
    }
  }
}
