import { normalizeIsbn, uniqueStrings } from '../utils/isbn.mjs';

const PRIORITY = ['livelib', 'google_books', 'open_library', 'serp'];

export function normalizeBooks(results = []) {
  const groups = new Map();
  for (const result of results.filter(Boolean)) {
    const key = normalizeIsbn(result.isbn) || normalizeTitleKey(result.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }

  return [...groups.values()].map(mergeBookGroup).sort((a, b) => b.confidence_score - a.confidence_score);
}

export function mergeBookGroup(group = []) {
  const byPriority = [...group].sort((a, b) => sourceRank(a) - sourceRank(b));
  const sources = uniqueStrings(byPriority.flatMap((book) => book.sources || []));
  const isbn = normalizeIsbn(firstValue(byPriority, 'isbn'));
  const title = firstValue(byPriority, 'title');
  const authors = uniqueStrings(byPriority.flatMap((book) => book.authors || []));
  const publisher = firstValue(byPriority, 'publisher');
  const year = firstValue(byPriority, 'year');
  const cover = firstValue(byPriority, 'cover');
  const description = firstValue(byPriority, 'description');
  const tags = uniqueStrings(byPriority.flatMap((book) => book.tags || []));
  const raw = Object.assign({}, ...byPriority.map((book) => book.raw || {}));
  const links = uniqueStrings(byPriority.flatMap((book) => book.links || []));
  const book = { isbn, title, authors, publisher, year, cover, description, tags, sources, raw, links };

  return {
    isbn: book.isbn,
    title: book.title,
    authors: book.authors,
    publisher: book.publisher,
    year: book.year,
    cover: book.cover,
    description: book.description,
    tags: book.tags,
    sources: book.sources,
    confidence_score: calculateConfidence(book),
    raw,
    links,
  };
}

export function toPublicBook(book) {
  return {
    isbn: book.isbn || '',
    title: book.title || '',
    authors: book.authors || [],
    publisher: book.publisher || '',
    year: book.year || undefined,
    cover: book.cover || '',
    description: book.description || '',
    tags: book.tags || [],
    sources: book.sources || [],
    confidence_score: book.confidence_score || 0,
  };
}

function firstValue(books, field) {
  return books.find((book) => book[field])?.[field] || '';
}

function sourceRank(book) {
  const source = (book.sources || [])[0];
  const rank = PRIORITY.indexOf(source);
  return rank === -1 ? PRIORITY.length : rank;
}

function calculateConfidence(book) {
  let score = 0.15;
  score += Math.min((book.sources || []).length, 4) * 0.16;
  if (book.isbn) score += 0.12;
  if (book.title) score += 0.12;
  if ((book.authors || []).length > 0) score += 0.1;
  if (book.year) score += 0.06;
  if (book.cover) score += 0.06;
  return Math.min(1, Number(score.toFixed(2)));
}

function normalizeTitleKey(title = '') {
  return String(title).trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}
