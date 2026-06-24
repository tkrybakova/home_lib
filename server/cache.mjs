export class BookCache {
  constructor() {
    this.books = new Map();
  }

  getFresh(isbn) {
    const book = this.books.get(isbn);
    return book ? { ...book, cache: { hit: true } } : null;
  }

  upsert(book) {
    if (book?.isbn) this.books.set(book.isbn, book);
  }
}
