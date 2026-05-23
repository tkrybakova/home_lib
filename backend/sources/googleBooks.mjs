import { fetchJson } from '../utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

const SOURCE = 'google_books';
const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

export async function fetchGoogleBookByIsbn(isbn, options = {}) {
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  const byIsbn = await fetchGoogleBooks(`isbn:${normalizedIsbn}`, { ...options, isbnHint: normalizedIsbn });
  if (byIsbn.length) return byIsbn;
  return fetchGoogleBooks(normalizedIsbn, { ...options, isbnHint: normalizedIsbn });
}

export async function searchGoogleBooks(query, options = {}) {
  return fetchGoogleBooks(query, options);
}

async function fetchGoogleBooks(query, { timeoutMs = 3000, isbnHint = '' } = {}) {
  const params = new URLSearchParams({ q: query, maxResults: '10' });
  const data = await fetchJson(`${BASE_URL}?${params}`, { timeoutMs });

  return (data.items || []).map((item) => normalizeVolume(item, isbnHint)).filter((book) => book.title);
}

function normalizeVolume(item, isbnHint) {
  const volume = item.volumeInfo || {};
  const identifiers = volume.industryIdentifiers || [];
  const isbn13 = identifiers.find((identifier) => identifier.type === 'ISBN_13')?.identifier;
  const isbn10 = identifiers.find((identifier) => identifier.type === 'ISBN_10')?.identifier;
  const isbn = normalizeIsbn(isbn13 || isbn10 || isbnHint);
  const cover = volume.imageLinks?.extraLarge || volume.imageLinks?.large || volume.imageLinks?.medium || volume.imageLinks?.thumbnail || volume.imageLinks?.smallThumbnail || '';

  return {
    isbn,
    title: [volume.title, volume.subtitle].filter(Boolean).join(': '),
    authors: uniqueStrings(volume.authors || []),
    publisher: volume.publisher || '',
    year: parseYear(volume.publishedDate),
    cover: cover ? cover.replace('http://', 'https://') : '',
    description: volume.description || '',
    tags: uniqueStrings(volume.categories || []),
    sources: [SOURCE],
    raw: { [SOURCE]: item },
  };
}
