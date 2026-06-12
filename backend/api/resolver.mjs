import { BookCache } from '../cache/sqliteCache.mjs';
import { fetchSearchResults } from '../sources/serp.mjs';
import { fetchLiveLibByIsbn, fetchLiveLibFromSearchResults } from '../sources/livelib.mjs';
import { fetchIsbnSearchByIsbn } from '../sources/isbnSearch.mjs';
import { fetchIsbnDbByIsbn } from '../sources/isbnDb.mjs';
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

    const serpResultsPromise = this.safeSource('serp', () => fetchSearchResults(normalizedIsbn, { timeoutMs: this.timeoutMs }));
    const livelibFromSerpPromise = serpResultsPromise.then((serpResults) =>
      this.safeSource('livelib', () => fetchLiveLibFromSearchResults(serpResults, { timeoutMs: this.timeoutMs })),
    );

    const [serpResults, livelibFromSearch, livelibByIsbn, isbnSearch, isbnDb] = await Promise.all([
      serpResultsPromise,
      livelibFromSerpPromise,
      this.safeSource('livelib', () => fetchLiveLibByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })),
      this.safeSource('isbn_search', () => fetchIsbnSearchByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })),
      this.safeSource('isbn_db', () => fetchIsbnDbByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })),
    ]);

    const sourceCandidates = [...livelibFromSearch, ...livelibByIsbn, ...isbnSearch, ...isbnDb, ...serpResults];
    const normalized = normalizeBooks(sourceCandidates);
    const best = normalized.find((book) => book.isbn === normalizedIsbn) || normalized[0];

    if (!best) {
      return { status: 404, body: { error: 'Book not found', isbn: normalizedIsbn } };
    }

    if (best.isbn) this.cache.upsert(best);
    const variants = buildVariants(normalized, sourceCandidates);
    return { status: 200, body: { ...toPublicBook(best), variants, cache: { hit: false } } };
  }

  async search(query) {
    const q = String(query || '').trim();
    if (!q) return { status: 400, body: { error: 'Missing query parameter q' } };
    if (looksLikeIsbn(q)) return this.resolveByIsbn(q);

    const serpResultsPromise = this.safeSource('serp', () => fetchSearchResults(q, { timeoutMs: this.timeoutMs }));
    const livelibPromise = serpResultsPromise.then((serpResults) =>
      this.safeSource('livelib', () => fetchLiveLibFromSearchResults(serpResults, { timeoutMs: this.timeoutMs })),
    );
    const [serpResults, livelib] = await Promise.all([serpResultsPromise, livelibPromise]);
    const normalized = normalizeBooks([...livelib, ...serpResults]).slice(0, 10);

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

function isAllowedCachedBook(book) {
  const allowed = new Set(['livelib', 'isbn_search', 'isbn_db', 'serp']);
  return (book.sources || []).every((source) => allowed.has(source));
}

function buildVariants(normalizedBooks, sourceCandidates) {
  const variants = [];
  const seen = new Set();
  for (const book of [...normalizedBooks, ...sourceCandidates]) {
    const publicBook = { ...toPublicBook(book), cache: { hit: false } };
    if (!publicBook.title) continue;
    if (variants.length > 0 && publicBook.sources.length === 1 && publicBook.sources[0] === 'serp') continue;
    const key = [publicBook.isbn, publicBook.title, publicBook.authors.join(','), publicBook.sources.join(',')].join('|').toLocaleLowerCase('ru-RU');
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(publicBook);
    if (variants.length >= 8) break;
  }
  return variants;
}
