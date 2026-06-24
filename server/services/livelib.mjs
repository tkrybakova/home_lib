// Импорт утилит для работы с сетью и нормализации данных
import { fetchText } from '../../backend/utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../../backend/utils/isbn.mjs';

// Константа источника данных
const SOURCE = 'livelib';

/**
 * Получение данных о книге из результатов поиска (например, из Google Books API)
 * @param {Array} searchResults - Массив результатов поиска
 * @param {Object} options - Опции запроса
 * @returns {Promise<Array>} - Массив с данными о книге
 * 
 * Алгоритм:
 * 1. Извлекает все ссылки на LiveLib из результатов поиска
 * 2. Удаляет дубликаты и ограничивает количество (макс. 2)
 * 3. Парсит каждую страницу параллельно
 * 4. Возвращает только успешные результаты
 * 
 * Используется, когда у нас уже есть ссылки на LiveLib из другого источника
 */
export async function fetchLiveLibFromSearchResults(searchResults = [], options = {}) {
  // Извлекаем все ссылки на LiveLib из результатов
  const liveLibUrls = searchResults
    .flatMap((result) => result.links || [])
    .filter((url) => url.includes('livelib.ru'));
  
  // Удаляем дубликаты и ограничиваем количество (не более 2 страниц)
  const uniqueUrls = [...new Set(liveLibUrls)].slice(0, 2);
  
  // Парсим страницы параллельно с обработкой ошибок
  const settled = await Promise.allSettled(
    uniqueUrls.map((url) => parseLiveLibBookPage(url, options))
  );
  
  // Возвращаем только успешные результаты
  return settled.flatMap((result) => 
    (result.status === 'fulfilled' && result.value ? [result.value] : [])
  );
}

/**
 * Основная функция поиска книги в LiveLib по ISBN
 * @param {string} isbn - ISBN книги
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут запроса в миллисекундах
 * @returns {Promise<Array>} - Массив с данными о книге или пустой массив
 * 
 * Алгоритм:
 * 1. Нормализует ISBN
 * 2. Ищет страницы LiveLib через DuckDuckGo (site:livelib.ru ISBN)
 * 3. Извлекает URL страниц книг из результатов поиска
 * 4. Парсит найденные страницы (макс. 2)
 * 5. Возвращает результаты
 * 
 * Почему DuckDuckGo?:
 * - LiveLib не имеет публичного API
 * - DuckDuckGo не блокирует парсинг (в отличие от Google)
 * - Можно делать поиск без API ключей
 */
export async function fetchLiveLibByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  // Нормализуем ISBN
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  
  // Формируем поисковый запрос к DuckDuckGo
  const queryUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:livelib.ru ${normalizedIsbn}`)}`;
  
  // Загружаем страницу с результатами поиска
  const html = await fetchText(queryUrl, { timeoutMs });
  
  // Извлекаем URL страниц книг из результатов поиска DuckDuckGo
  const urls = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => /livelib\.ru\/book\//i.test(url));
  
  // Удаляем дубликаты и ограничиваем количество (не более 2 страниц)
  const uniqueUrls = [...new Set(urls)].slice(0, 2);
  
  // Парсим страницы параллельно
  const settled = await Promise.allSettled(
    uniqueUrls.map((url) => parseLiveLibBookPage(url, { timeoutMs }))
  );
  
  // Возвращаем только успешные результаты
  return settled.flatMap((result) => 
    (result.status === 'fulfilled' && result.value ? [result.value] : [])
  );
}

/**
 * Парсинг страницы книги на LiveLib
 * @param {string} url - URL страницы книги
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут запроса
 * @returns {Promise<Object>} - Объект с данными о книге
 * 
 * Особенности парсинга LiveLib:
 * - Много данных в meta-тегах (og:title, og:image, og:description)
 * - Есть JSON-LD с авторами
 * - Основные данные извлекаются из текста страницы
 * - ISBN нужно искать по шаблону, так как нет отдельного meta-тега
 */
export async function parseLiveLibBookPage(url, { timeoutMs = 3000 } = {}) {
  // Загружаем HTML-страницу
  const html = await fetchText(url, { timeoutMs });
  
  // Извлекаем базовые данные из meta-тегов
  const title = extractMeta(html, 'og:title') || extractTitle(html);
  const cover = extractMeta(html, 'og:image');
  const description = extractMeta(html, 'og:description') || '';
  
  // Поиск ISBN - сложный, так как формат может быть разным
  const isbn = normalizeIsbn(
    html.match(/ISBN(?:-1[03])?[^0-9Xx]{0,20}([0-9Xx\-\s]{10,20})/i)?.[1] || ''
  );
  
  // Преобразуем HTML в текст для дальнейшего поиска
  const text = htmlToText(html);
  
  // Извлекаем год издания из текста или описания
  const year = parseYear(
    field(text, ['Год издания', 'Дата выхода', 'yearPublished', 'datePublished']) || 
    description
  );
  
  // Сбор авторов из разных источников
  const authorCandidates = [
    extractMeta(html, 'book:author'),           // Специальный meta-тег
    extractJsonLdAuthors(html),                 // JSON-LD разметка
    html.match(/"author"\s*:\s*"([^"]+)"/)?.[1], // JavaScript объекты
    field(text, ['Автор', 'Авторы']),           // Текст страницы
  ].flat().filter(Boolean);
  
  // Извлекаем физические характеристики
  const dimensions = field(text, ['Размер', 'Размеры']);
  const weight = field(text, ['Вес']);
  const pages = parsePages(text);
  
  const publisher = field(text, ['Издательство', 'Издатель']);
  const tags = uniqueStrings([
    field(text, ['Жанры', 'Теги', 'Раздел'])
  ].flatMap(splitList));

  // Возвращаем сформированный объект
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
    raw: { [SOURCE]: { url, title, cover, description } }, // Данные для отладки
  };
}

/**
 * Поиск поля в тексте по меткам
 * @param {string} text - Текст для поиска
 * @param {Array} labels - Массив возможных меток поля
 * @returns {string} - Найденное значение или пустая строка
 * 
 * Пример: field(text, ['Автор', 'Авторы']) найдет "Автор: Толстой"
 */
function field(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:?\\s*([^\\n]+)`, 'i'));
    if (match?.[1]) return cleanupValue(match[1]);
  }
  return '';
}

/**
 * Парсинг количества страниц
 * @param {string} text - Текст для поиска
 * @returns {number|undefined} - Количество страниц или undefined
 * 
 * Ищет по шаблонам:
 * - "Страниц: 123"
 * - "Объем: 123"
 * - "Кол-во страниц: 123"
 * - "123 стр."
 */
function parsePages(text) {
  const match = text.match(/(?:^|\n)\s*(?:Страниц|Объем|Кол-во страниц)\s*:?\s*(\d{1,5})/i) || 
                text.match(/\b(\d{1,5})\s*стр\.?\b/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

/**
 * Разбиение строки с разделителями на список значений
 * @param {*} value - Строка или массив для разбиения
 * @returns {Array} - Массив значений
 * 
 * Поддерживает разделители: , ; |
 */
function splitList(value = '') {
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

/**
 * Преобразование HTML в текст с сохранением структуры
 * @param {string} html - HTML-код страницы
 * @returns {string} - Очищенный текст
 */
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

/**
 * Общая очистка строкового значения
 * @param {string} value - Исходная строка
 * @returns {string} - Очищенная строка
 */
function cleanupValue(value = '') {
  return decodeHtml(String(value)).replace(/\s+/g, ' ').replace(/^[:\-–—]\s*/, '').trim();
}

/**
 * Извлечение значения из meta-тега
 * @param {string} html - HTML-код страницы
 * @param {string} property - Имя свойства (name или property)
 * @returns {string} - Значение content атрибута
 * 
 * Поддерживает оба формата:
 * <meta name="og:title" content="...">
 * <meta property="og:title" content="...">
 * 
 * Специально для LiveLib:
 * - book:author - мета-тег с автором
 * - og:title - заголовок книги
 * - og:image - обложка
 */
function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  return decodeHtml(regex.exec(html)?.[1] || '');
}

/**
 * Извлечение заголовка страницы
 * @param {string} html - HTML-код страницы
 * @returns {string} - Заголовок страницы
 */
function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
}

/**
 * Извлечение авторов из JSON-LD разметки
 * @param {string} html - HTML-код страницы
 * @returns {Array} - Массив имен авторов
 * 
 * LiveLib использует JSON-LD для структурированных данных,
 * где авторы могут быть как строкой, так и объектом с полем name
 */
function extractJsonLdAuthors(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  
  for (const [, rawJson] of blocks) {
    try {
      const data = JSON.parse(rawJson.trim());
      const author = Array.isArray(data) ? data.flatMap((item) => item.author || []) : data.author;
      if (!author) continue;
      
      // Преобразуем в массив и извлекаем имена
      return (Array.isArray(author) ? author : [author])
        .map((item) => (typeof item === 'string' ? item : item.name));
    } catch {
      // Игнорируем невалидный JSON-LD
    }
  }
  return [];
}

/**
 * Очистка заголовка от суффиксов LiveLib
 * @param {string} title - Исходный заголовок
 * @returns {string} - Очищенный заголовок
 * 
 * Удаляет: " - LiveLib", " | LiveLib", " — LiveLib"
 */
function cleanupTitle(title = '') {
  return title.replace(/\s*[-—|].*LiveLib.*$/i, '').trim();
}

/**
 * Декодирование HTML-сущностей
 * @param {string} value - Строка с HTML-сущностями
 * @returns {string} - Декодированная строка
 */
function decodeHtml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}