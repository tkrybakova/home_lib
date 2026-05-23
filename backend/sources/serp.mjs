import { fetchJson } from '../utils/fetchJson.mjs';
import { normalizeIsbn } from '../utils/isbn.mjs';

const SOURCE = 'serp';
const BOOK_DOMAINS = [
  'ozon.ru',
  'livelib.ru',
  'litres.ru',
  'book24.ru',
  'labirint.ru',
  'chitai-gorod.ru',
  'alpina.ru',
  'my-shop.ru',
  'ast.ru',
  'eksmo.ru',
  'respublica.ru',
];

export async function fetchSearchResults(query, { timeoutMs = 3000 } = {}) {
  if (process.env.SERP_MOCK_RESULTS) {
    return normalizeSerpItems(JSON.parse(process.env.SERP_MOCK_RESULTS), query);
  }

  if (process.env.SERP_API_URL) {
    const endpoint = new URL(process.env.SERP_API_URL);

    endpoint.searchParams.set('q', query);

    const data = await fetchJson(endpoint.toString(), { timeoutMs });

    const items =
      data.items ||
      data.organic_results ||
      data.results ||
      [];

    return normalizeSerpItems(items, query);
  }

  return fetchDuckDuckGoSerp(query, { timeoutMs });
}

export function normalizeSerpItems(items = [], query = '') {
  return items
    .map((item) => ({
      title: item.title || item.name || '',
      url: item.link || item.url || '',
      snippet: item.snippet || item.description || '',
    }))
    .filter((item) => item.url && BOOK_DOMAINS.some((domain) => item.url.includes(domain)))
    .map((item) => ({
      isbn: normalizeIsbn(query),
      title: item.title,
      authors: [],
      publisher: '',
      year: undefined,
      cover: '',
      description: item.snippet,
      tags: [],
      sources: [SOURCE],
      links: [item.url],
      raw: { [SOURCE]: item },
    }));
}

async function fetchDuckDuckGoSerp(query, { timeoutMs = 3000 } = {}) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(`${query} книга`)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; HomeLibBookResolver/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo HTTP ${response.status}`);
  }

  const html = await response.text();
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const items = matches.slice(0, 20).map((match) => ({
    link: decodeHtml(match[1]),
    title: stripTags(decodeHtml(match[2])),
    snippet: '',
  }));

  return normalizeSerpItems(items, query);
}

function stripTags(value = '') {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}