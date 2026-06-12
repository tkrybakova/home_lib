import { fetchText } from '../utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

const SOURCE = 'isbn_search';

export async function fetchIsbnSearchByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  const url = `https://isbnsearch.org/isbn/${encodeURIComponent(normalizedIsbn)}`;
  const html = await fetchText(url, { timeoutMs });
  const book = parseIsbnSearchPage(html, url, normalizedIsbn);
  return book?.title ? [book] : [];
}

export function parseIsbnSearchPage(html = '', url = '', isbnHint = '') {
  const jsonLdBooks = extractJsonLdBooks(html);
  const jsonLd = jsonLdBooks[0] || {};
  const text = htmlToText(html);
  const title = cleanupTitle(jsonLd.name || extractMeta(html, 'og:title') || extractHeading(html) || extractTitle(html));
  const authors = uniqueStrings([
    ...normalizePeople(jsonLd.author),
    field(text, ['Author', 'Authors', 'Автор', 'Авторы']),
  ]);
  const publisher = firstNonEmpty(
    normalizeOrganization(jsonLd.publisher),
    field(text, ['Publisher', 'Издательство']),
  );
  const year = parseYear(firstNonEmpty(jsonLd.datePublished, field(text, ['Published', 'Publication Date', 'Год издания'])));
  const cover = absolutizeUrl(firstNonEmpty(jsonLd.image, extractMeta(html, 'og:image'), extractImage(html)), url);
  const description = cleanupDescription(firstNonEmpty(jsonLd.description, extractMeta(html, 'description'), extractMeta(html, 'og:description')));
  const isbn = normalizeIsbn(firstNonEmpty(jsonLd.isbn, field(text, ['ISBN-13', 'ISBN13', 'ISBN']), isbnHint));
  const dimensions = firstNonEmpty(field(text, ['Dimensions', 'Размеры', 'Размер']), findByRegex(text, /(?:Dimensions|Размер(?:ы)?)\s*:?\s*([^\n]+(?:inches|inch|cm|мм|mm)[^\n]*)/i));
  const weight = firstNonEmpty(field(text, ['Weight', 'Вес']), findByRegex(text, /(?:Weight|Вес)\s*:?\s*([^\n]+(?:pounds|lbs|ounces|oz|kg|г|кг)[^\n]*)/i));
  const pages = findPages(text);
  const tags = uniqueStrings([field(text, ['Subjects', 'Categories', 'Теги', 'Жанры'])].flatMap(splitList));

  return {
    isbn,
    title,
    authors,
    publisher,
    year,
    cover,
    description,
    tags,
    dimensions,
    weight,
    pages,
    sources: [SOURCE],
    links: [url],
    raw: { [SOURCE]: { url, title, text: text.slice(0, 4000) } },
  };
}

function extractJsonLdBooks(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.flatMap(([, raw]) => {
    try {
      const parsed = JSON.parse(decodeHtml(raw.trim()));
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
      return items.filter((item) => String(item?.['@type'] || '').toLowerCase().includes('book'));
    } catch {
      return [];
    }
  });
}

function field(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:?\\s*([^\\n]+)`, 'i'));
    if (match?.[1]) return cleanupValue(match[1]);
  }
  return '';
}

function normalizePeople(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
}

function normalizeOrganization(value) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.name || '';
}

function findByRegex(text, regex) {
  return cleanupValue(text.match(regex)?.[1] || '');
}

function findPages(text) {
  const value = text.match(/(?:Paperback|Hardcover|Print length|Pages|Страниц|стр\.)\s*:?\s*(\d{1,5})/i)?.[1] || text.match(/\b(\d{1,5})\s*(?:pages|стр\.)\b/i)?.[1] || '';
  return value ? Number(value) : undefined;
}

function splitList(value = '') {
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexes = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const regex of regexes) {
    const value = decodeHtml(regex.exec(html)?.[1] || '');
    if (value) return value;
  }
  return '';
}

function extractHeading(html) {
  return decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || '');
}

function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
}

function extractImage(html) {
  return decodeHtml(html.match(/<img[^>]+(?:id|class)=["'][^"']*(?:cover|book)[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1] || '');
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/?(?:p|div|li|tr|br|dt|dd|h\d|table|section|article)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{2,}/g, '\n'),
  ).trim();
}

function cleanupTitle(title = '') {
  return decodeHtml(title).replace(/\s*\|\s*ISBN Search.*$/i, '').replace(/\s*[-—]\s*ISBN Search.*$/i, '').trim();
}

function cleanupDescription(value = '') {
  return cleanupValue(value).replace(/^Description\s*:?\s*/i, '');
}

function cleanupValue(value = '') {
  return decodeHtml(String(value)).replace(/\s+/g, ' ').replace(/^[:\-–—]\s*/, '').trim();
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';
}

function absolutizeUrl(value = '', base = '') {
  if (!value) return '';
  try {
    return new URL(value, base || 'https://isbnsearch.org').toString();
  } catch {
    return value;
  }
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#039;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}