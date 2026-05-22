import { BookCache } from '../cache/sqliteCache.mjs';
import { fetchGoogleBookByIsbn, searchGoogleBooks } from '../sources/googleBooks.mjs';
import { fetchOpenLibraryBookByIsbn, searchOpenLibraryBooks } from '../sources/openLibrary.mjs';
import { fetchSearchResults } from '../sources/serp.mjs';
import { fetchLiveLibFromSearchResults } from '../sources/livelib.mjs';
import { normalizeBooks, toPublicBook } from '../normalizer/index.mjs';
import { looksLikeIsbn, normalizeIsbn } from '../utils/isbn.mjs';

const DEFAULT_TIMEOUT_MS = Number(process.env.BOOK_SOURCE_TIMEOUT_MS || 3000);

export class BookResolverService {
  constructor({ cache = new BookCache(), timeoutMs = DEFAULT_TIMEOUT_MS, logger = console } = {}) {
    this.cache = cache;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  async resolveByIsbn(isbn) {
    const normalizedIsbn = normalizeIsbn(isbn);
    if (!looksLikeIsbn(normalizedIsbn)) {
      return { status: 400, body: { error: 'Invalid ISBN' } };
    }

    const cached = this.cache.getFresh(normalizedIsbn);
    if (cached) {
      return { status: 200, body: { ...toPublicBook(cached), cache: cached.cache } };
    }

    const serpResultsPromise = this.safeSource('serp', () => fetchSearchResults(normalizedIsbn, { timeoutMs: this.timeoutMs }));
    const livelibPromise = serpResultsPromise.then((serpResults) =>
      this.safeSource('livelib', () => fetchLiveLibFromSearchResults(serpResults, { timeoutMs: this.timeoutMs })),
    );
    const [google, openLibrary, serpResults, livelib] = await Promise.all([
      this.safeSource('google_books', () => fetchGoogleBookByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })),
      this.safeSource('open_library', () => fetchOpenLibraryBookByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })),
      serpResultsPromise,
      livelibPromise,
    ]);
    const normalized = normalizeBooks([...google, ...openLibrary, ...serpResults, ...livelib]);
    const best = normalized.find((book) => book.isbn === normalizedIsbn) || normalized[0];

    if (!best) {
      return { status: 404, body: { error: 'Book not found', isbn: normalizedIsbn } };
    }

    if (best.isbn) this.cache.upsert(best);
    return { status: 200, body: { ...toPublicBook(best), cache: { hit: false } } };
  }

  async search(query) {
    const q = String(query || '').trim();
    if (!q) return { status: 400, body: { error: 'Missing query parameter q' } };
    if (looksLikeIsbn(q)) return this.resolveByIsbn(q);

    const serpResultsPromise = this.safeSource('serp', () => fetchSearchResults(q, { timeoutMs: this.timeoutMs }));
    const livelibPromise = serpResultsPromise.then((serpResults) =>
      this.safeSource('livelib', () => fetchLiveLibFromSearchResults(serpResults, { timeoutMs: this.timeoutMs })),
    );
    const [google, openLibrary, serpResults, livelib] = await Promise.all([
      this.safeSource('google_books', () => searchGoogleBooks(q, { timeoutMs: this.timeoutMs })),
      this.safeSource('open_library', () => searchOpenLibraryBooks(q, { timeoutMs: this.timeoutMs })),
      serpResultsPromise,
      livelibPromise,
    ]);
    const normalized = normalizeBooks([...google, ...openLibrary, ...serpResults, ...livelib]).slice(0, 10);

    for (const book of normalized) {
      if (book.isbn) this.cache.upsert(book);
    }

    return {
      status: 200,
      body: {
        query: q,
        results: normalized.map((book) => ({ ...toPublicBook(book), cache: { hit: false } })),
      },
    };
  }

  async safeSource(name, callback) {
    try {
      return await callback();
    } catch (error) {
      this.logger.warn?.(`[${name}] ${error.message}`);
      return [];
    }
  }
}
