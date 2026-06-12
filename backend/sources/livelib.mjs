import { fetchText } from '../utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

const SOURCE = 'livelib';

export async function fetchLiveLibFromSearchResults(searchResults = [], options = {}) {
  const liveLibUrls = searchResults.flatMap((result) => result.links || []).filter((url) => url.includes('livelib.ru'));
  const uniqueUrls = [...new Set(liveLibUrls)].slice(0, 2);
  const settled = await Promise.allSettled(uniqueUrls.map((url) => parseLiveLibBookPage(url, options)));
  return settled.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
}

export async function fetchLiveLibByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  const queryUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:livelib.ru ${normalizedIsbn}`)}`;
  const html = await fetchText(queryUrl, { timeoutMs });
  const urls = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => /livelib\.ru\/book\//i.test(url));
  const uniqueUrls = [...new Set(urls)].slice(0, 2);
  const settled = await Promise.allSettled(uniqueUrls.map((url) => parseLiveLibBookPage(url, { timeoutMs })));
  return settled.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
}

export async function parseLiveLibBookPage(url, { timeoutMs = 3000 } = {}) {
  const html = await fetchText(url, { timeoutMs });
  const title = extractMeta(html, 'og:title') || extractTitle(html);
  const cover = extractMeta(html, 'og:image');
  const description = extractMeta(html, 'og:description') || '';
  const isbn = normalizeIsbn(html.match(/ISBN(?:-1[03])?[^0-9Xx]{0,20}([0-9Xx\-\s]{10,20})/i)?.[1] || '');
  const text = htmlToText(html);
  const year = parseYear(field(text, ['Год издания', 'Дата выхода', 'yearPublished', 'datePublished']) || description);
  const authorCandidates = [
    extractMeta(html, 'book:author'),
    extractJsonLdAuthors(html),
    html.match(/"author"\s*:\s*"([^"]+)"/)?.[1],
    field(text, ['Автор', 'Авторы']),
  ].flat().filter(Boolean);
  const dimensions = field(text, ['Размер', 'Размеры']);
  const weight = field(text, ['Вес']);
  const pages = parsePages(text);
  const publisher = field(text, ['Издательство', 'Издатель']);
  const tags = uniqueStrings([field(text, ['Жанры', 'Теги', 'Раздел'])].flatMap(splitList));

  return {
    isbn,
    title: cleanupTitle(title),
    authors: uniqueStrings(authorCandidates),
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
    raw: { [SOURCE]: { url, title, cover, description } },
  };
}

function field(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:?\\s*([^\\n]+)`, 'i'));
    if (match?.[1]) return cleanupValue(match[1]);
  }
  return '';
}

function parsePages(text) {
  const match = text.match(/(?:^|\n)\s*(?:Страниц|Объем|Кол-во страниц)\s*:?\s*(\d{1,5})/i) || text.match(/\b(\d{1,5})\s*стр\.?\b/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function splitList(value = '') {
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
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

function cleanupValue(value = '') {
  return decodeHtml(String(value)).replace(/\s+/g, ' ').replace(/^[:\-–—]\s*/, '').trim();
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return decodeHtml(regex.exec(html)?.[1] || '');
}

function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
}

function extractJsonLdAuthors(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, rawJson] of blocks) {
    try {
      const data = JSON.parse(rawJson.trim());
      const author = Array.isArray(data) ? data.flatMap((item) => item.author || []) : data.author;
      if (!author) continue;
      return (Array.isArray(author) ? author : [author]).map((item) => (typeof item === 'string' ? item : item.name));
    } catch {
      // Ignore invalid JSON-LD from scraped pages.
    }
  }
  return [];
}

function cleanupTitle(title = '') {
  return title.replace(/\s*[-—|].*LiveLib.*$/i, '').trim();
}

function decodeHtml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
