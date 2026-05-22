import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_TTL_DAYS = 14;

export class BookCache {
  constructor({ dbPath = process.env.BOOK_CACHE_DB || 'data/book-cache.sqlite', ttlDays = Number(process.env.BOOK_CACHE_TTL_DAYS || DEFAULT_TTL_DAYS) } = {}) {
    this.dbPath = resolve(dbPath);
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        isbn TEXT PRIMARY KEY,
        title TEXT,
        authors TEXT,
        year INTEGER,
        cover TEXT,
        raw_json TEXT,
        updated_at TEXT
      )
    `);
  }

  getFresh(isbn) {
    const row = this.db.prepare('SELECT * FROM books WHERE isbn = ?').get(isbn);
    if (!row) return null;
    const updatedAt = Date.parse(row.updated_at);
    if (!updatedAt || Date.now() - updatedAt > this.ttlMs) return null;
    return this.rowToBook(row, true);
  }

  upsert(book) {
    if (!book?.isbn) return;
    this.db
      .prepare(
        `INSERT INTO books (isbn, title, authors, year, cover, raw_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(isbn) DO UPDATE SET
           title = excluded.title,
           authors = excluded.authors,
           year = excluded.year,
           cover = excluded.cover,
           raw_json = excluded.raw_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        book.isbn,
        book.title || '',
        JSON.stringify(book.authors || []),
        book.year || null,
        book.cover || '',
        JSON.stringify(book),
        new Date().toISOString(),
      );
  }

  rowToBook(row, fromCache = false) {
    let raw = {};
    try {
      raw = JSON.parse(row.raw_json || '{}');
    } catch {
      raw = {};
    }

    return {
      ...raw,
      isbn: row.isbn,
      title: row.title,
      authors: JSON.parse(row.authors || '[]'),
      year: row.year || undefined,
      cover: row.cover || '',
      cache: { hit: fromCache, updated_at: row.updated_at },
    };
  }
}
