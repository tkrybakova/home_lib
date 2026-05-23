import { fetchJson } from '../utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

const SOURCE = 'open_library';

export async function fetchOpenLibraryBookByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  const params = new URLSearchParams({ bibkeys: `ISBN:${normalizedIsbn}`, format: 'json', jscmd: 'data' });
  const data = await fetchJson(`https://openlibrary.org/api/books?${params}`, { timeoutMs });
  const book = data[`ISBN:${normalizedIsbn}`];
  return book ? [normalizeBookData(book, normalizedIsbn)] : [];
}

export async function searchOpenLibraryBooks(query, { timeoutMs = 3000 } = {}) {
  const params = new URLSearchParams({ q: query, limit: '10' });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params}`, { timeoutMs });
  return (data.docs || []).map(normalizeSearchDoc).filter((book) => book.title);
}

function normalizeBookData(book, isbnHint) {
  return {
    isbn: normalizeIsbn(isbnHint),
    title: book.title || '',
    authors: uniqueStrings((book.authors || []).map((author) => author.name)),
    publisher: book.publishers?.[0]?.name || '',
    year: parseYear(book.publish_date),
    cover: book.cover?.large || book.cover?.medium || book.cover?.small || (isbnHint ? `https://covers.openlibrary.org/b/isbn/${isbnHint}-L.jpg` : ''),
    description: typeof book.notes === 'string' ? book.notes : '',
    tags: uniqueStrings((book.subjects || []).map((subject) => subject?.name || '').filter(Boolean)),
    sources: [SOURCE],
    raw: { [SOURCE]: book },
  };
}

function normalizeSearchDoc(doc) {
  const isbn = normalizeIsbn(doc.isbn?.find((value) => normalizeIsbn(value).length === 13) || doc.isbn?.[0] || '');
  return {
    isbn,
    title: doc.title || '',
    authors: uniqueStrings(doc.author_name || []),
    publisher: doc.publisher?.[0] || '',
    year: doc.first_publish_year,
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    description: '',
    tags: uniqueStrings(doc.subject?.slice(0, 8) || []),
    sources: [SOURCE],
    raw: { [SOURCE]: doc },
  };
}
