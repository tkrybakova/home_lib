// backend/api/resolver.mjs
import { BookCache } from '../cache.mjs';
import { fetchLiveLibByIsbn } from './livelib.mjs';
import { fetchIsbnSearchByIsbn } from './isbnsearch.mjs';
import { fetchIsbnDbByIsbn } from './isbndb.mjs';
import { normalizeBooks, toPublicBook } from '../index.js';
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
    if (cached && isAllowedCachedBook(cached)) {
      const publicBook = toPublicBook(cached);
      return {
        status: 200,
        body: {
          ...publicBook,
          variants: [publicBook],
          cache: cached.cache,
        },
      };
    }

    const [livelibByIsbn, isbnSearch, isbnDb] = await Promise.all([
      this.safeSource('livelib', () =>
        fetchLiveLibByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })
      ),
      this.safeSource('isbn_search', () =>
        fetchIsbnSearchByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })
      ),
      this.safeSource('isbn_db', () =>
        fetchIsbnDbByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })
      ),
    ]);

    const sourceCandidates = [
      ...livelibByIsbn,
      ...isbnSearch,
      ...isbnDb,
    ];

    const normalized = normalizeBooks(sourceCandidates);
    const best = normalized.find((book) => book.isbn === normalizedIsbn) || normalized[0];

    if (!best) {
      return { status: 404, body: { error: 'Book not found', isbn: normalizedIsbn } };
    }

    if (best.isbn) this.cache.upsert(best);

    const variants = buildVariants(normalized, sourceCandidates);

    return {
      status: 200,
      body: {
        ...toPublicBook(best),
        variants,
        cache: { hit: false },
      },
    };
  }

  async search(query) {
    const q = String(query || '').trim();
    if (!q) return { status: 400, body: { error: 'Missing query parameter q' } };

    if (looksLikeIsbn(q)) return this.resolveByIsbn(q);

    return {
      status: 501,
      body: { error: 'Text search is not available without SERP integration' },
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

function isAllowedCachedBook(book) {
  const allowed = new Set(['livelib', 'isbn_search', 'isbn_db']);
  return (book.sources || []).every((source) => allowed.has(source));
}

function buildVariants(normalizedBooks, sourceCandidates) {
  const variants = [];
  const seen = new Set();

  for (const book of [...normalizedBooks, ...sourceCandidates]) {
    const publicBook = { ...toPublicBook(book), cache: { hit: false } };
    if (!publicBook.title) continue;

    const key = [
      publicBook.isbn,
      publicBook.title,
      publicBook.authors.join(','),
      publicBook.sources.join(',')
    ].join('|').toLocaleLowerCase('ru-RU');

    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(publicBook);

    if (variants.length >= 8) break;
  }

  return variants;
}
