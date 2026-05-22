import { fetchJson } from '../utils/fetchJson.mjs';
import { normalizeIsbn } from '../utils/isbn.mjs';

const SOURCE = 'serp';
const BOOK_DOMAINS = ['ozon.ru', 'livelib.ru', 'litres.ru'];

export async function fetchSearchResults(query, { timeoutMs = 3000 } = {}) {
  if (process.env.SERP_MOCK_RESULTS) {
    return normalizeSerpItems(JSON.parse(process.env.SERP_MOCK_RESULTS), query);
  }

  if (!process.env.SERP_API_URL) {
    return [];
  }

  const endpoint = new URL(process.env.SERP_API_URL);
  endpoint.searchParams.set('q', query);
  const data = await fetchJson(endpoint.toString(), { timeoutMs });
  const items = data.items || data.organic_results || data.results || [];
  return normalizeSerpItems(items, query);
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
      year: undefined,
      cover: '',
      sources: [SOURCE],
      links: [item.url],
      raw: { [SOURCE]: item },
    }));
}
