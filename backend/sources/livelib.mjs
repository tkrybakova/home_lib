import { fetchText } from '../utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

const SOURCE = 'livelib';

export async function fetchLiveLibFromSearchResults(searchResults = [], options = {}) {
  const liveLibUrls = searchResults.flatMap((result) => result.links || []).filter((url) => url.includes('livelib.ru'));
  const uniqueUrls = [...new Set(liveLibUrls)].slice(0, 2);
  const settled = await Promise.allSettled(uniqueUrls.map((url) => parseLiveLibBookPage(url, options)));
  return settled.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
}

export async function parseLiveLibBookPage(url, { timeoutMs = 3000 } = {}) {
  const html = await fetchText(url, { timeoutMs });
  const title = extractMeta(html, 'og:title') || extractTitle(html);
  const cover = extractMeta(html, 'og:image');
  const description = extractMeta(html, 'og:description') || '';
  const isbn = normalizeIsbn(html.match(/ISBN(?:-1[03])?[^0-9Xx]{0,20}([0-9Xx\-\s]{10,20})/i)?.[1] || '');
  const year = parseYear(html.match(/(?:Год издания|yearPublished|datePublished)[^0-9]{0,30}(\d{4})/i)?.[1] || description);
  const authorCandidates = [
    extractMeta(html, 'book:author'),
    extractJsonLdAuthors(html),
    html.match(/"author"\s*:\s*"([^"]+)"/)?.[1],
  ].flat().filter(Boolean);

  return {
    isbn,
    title: cleanupTitle(title),
    authors: uniqueStrings(authorCandidates),
    year,
    cover,
    sources: [SOURCE],
    links: [url],
    raw: { [SOURCE]: { url, title, cover, description } },
  };
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
