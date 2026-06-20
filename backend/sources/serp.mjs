//backend/sources/serp.mjs
// Импорт утилит для работы с сетью и нормализации данных
import { fetchJson } from '../utils/fetchJson.mjs';
import { normalizeIsbn } from '../utils/isbn.mjs';

// Константа источника данных
const SOURCE = 'serp';

// Список доверенных книжных доменов для фильтрации результатов
// Используется для исключения мусорных сайтов из результатов поиска
const BOOK_DOMAINS = [
  'livelib.ru',       // Социальная сеть книголюбов
  'litres.ru',        // Крупнейший книжный сервис
  'chitai-gorod.ru',  // Книжный магазин
  'my-shop.ru',       // Книжный магазин
  'ast.ru',           // Издательство АСТ
  'eksmo.ru',         // Издательство Эксмо
];

/**
 * Основная функция поиска книг через поисковые системы
 * @param {string} query - Поисковый запрос (название книги или ISBN)
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут запроса в миллисекундах
 * @returns {Promise<Array>} - Массив с данными о найденных книгах
 * 
 * Стратегия работы:
 * 1. Если задан SERP_MOCK_RESULTS - используем мок-данные (для тестов)
 * 2. Если задан SERP_API_URL - используем внешний API (например, SerpAPI)
 * 3. Иначе - парсим DuckDuckGo напрямую
 * 
 * Такой подход позволяет гибко настраивать источник данных
 */
export async function fetchSearchResults(query, { timeoutMs = 3000 } = {}) {
  // Режим тестирования с мок-данными
  if (process.env.SERP_MOCK_RESULTS) {
    return normalizeSerpItems(JSON.parse(process.env.SERP_MOCK_RESULTS), query);
  }

  // Использование внешнего SERP API (например, SerpAPI, Google Custom Search)
  if (process.env.SERP_API_URL) {
    const endpoint = new URL(process.env.SERP_API_URL);
    endpoint.searchParams.set('q', query);

    const data = await fetchJson(endpoint.toString(), { timeoutMs });

    // Поддержка различных форматов ответов от разных API
    const items =
      data.items ||
      data.organic_results ||
      data.results ||
      [];

    return normalizeSerpItems(items, query);
  }

  // Fallback - прямой парсинг DuckDuckGo
  return fetchDuckDuckGoSerp(query, { timeoutMs });
}

/**
 * Нормализация результатов поиска
 * @param {Array} items - Массив элементов из поисковой выдачи
 * @param {string} query - Исходный поисковый запрос
 * @returns {Array} - Нормализованный массив объектов книг
 * 
 * Этапы нормализации:
 * 1. Приведение полей к единому формату (title, url, snippet)
 * 2. Фильтрация по доверенным доменам книжных магазинов
 * 3. Преобразование в формат книги с минимальным набором полей
 * 4. Добавление ISBN из поискового запроса (если он там был)
 * 
 * Важно: Здесь мы не парсим страницы, только сохраняем ссылки
 * для дальнейшего детального парсинга другими модулями
 */
export function normalizeSerpItems(items = [], query = '') {
  return items
    // Приводим к единому формату
    .map((item) => ({
      title: item.title || item.name || '',
      url: item.link || item.url || '',
      snippet: item.snippet || item.description || '',
    }))
    // Фильтруем только ссылки на книжные сайты
    .filter((item) => item.url && BOOK_DOMAINS.some((domain) => item.url.includes(domain)))
    // Преобразуем в формат книги
    .map((item) => ({
      isbn: normalizeIsbn(query),  // Пытаемся извлечь ISBN из запроса
      title: item.title,
      authors: [],
      publisher: '',
      year: undefined,
      cover: '',
      description: item.snippet,
      tags: [],
      sources: [SOURCE],
      links: [item.url],            // Сохраняем ссылку для дальнейшего парсинга
      raw: { [SOURCE]: item },      // Сырые данные для отладки
    }));
}

/**
 * Прямой парсинг DuckDuckGo
 * @param {string} query - Поисковый запрос
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут запроса
 * @returns {Promise<Array>} - Нормализованные результаты поиска
 * 
 * Почему DuckDuckGo:
 * - Не требует API ключа
 * - Меньше ограничений на частоту запросов
 * - Простая структура HTML для парсинга
 * 
 * Особенности:
 * - Добавляем слово "книга" к запросу для уточнения
 * - Используем User-Agent для имитации браузера
 * - Извлекаем только первые 20 результатов
 * - Обрабатываем только заголовки и ссылки (без описаний)
 */
async function fetchDuckDuckGoSerp(query, { timeoutMs = 3000 } = {}) {
  // Формируем URL с добавлением слова "книга" для уточнения поиска
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(`${query} книга`)}`;
  
  // Выполняем запрос к DuckDuckGo
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; HomeLibBookResolver/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(timeoutMs), // Таймаут через AbortController
  });

  // Проверяем успешность запроса
  if (!response.ok) {
    throw new Error(`DuckDuckGo HTTP ${response.status}`);
  }

  // Получаем HTML страницы
  const html = await response.text();
  
  // Извлекаем ссылки и заголовки из результатов поиска
  // Используем CSS класс .result__a, который используется DuckDuckGo
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  
  // Преобразуем в единый формат (максимум 20 результатов)
  const items = matches.slice(0, 20).map((match) => ({
    link: decodeHtml(match[1]),
    title: stripTags(decodeHtml(match[2])),
    snippet: '', // DuckDuckGo не дает описание без дополнительного парсинга
  }));

  // Нормализуем результаты
  return normalizeSerpItems(items, query);
}

/**
 * Удаление HTML-тегов из строки
 * @param {string} value - Исходная строка с HTML
 * @returns {string} - Очищенная строка
 * 
 * Используется для очистки заголовков из DuckDuckGo
 */
function stripTags(value = '') {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Декодирование HTML-сущностей
 * @param {string} value - Строка с HTML-сущностями
 * @returns {string} - Декодированная строка
 * 
 * Поддерживает основные сущности: &amp;, &quot;, &#39;, &lt;, &gt;
 */
function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}