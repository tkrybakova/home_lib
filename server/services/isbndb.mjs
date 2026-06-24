// Импорт утилит для работы с сетью и нормализации данных
import { fetchText } from '../utils/mergeResults.js';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

// Константа источника данных
const SOURCE = 'isbn_db';

/**
 * Основная функция для получения данных о книге из ISBNdb по ISBN
 * @param {string} isbn - ISBN книги
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут запроса в миллисекундах
 * @returns {Promise<Array>} - Массив с данными о книге или пустой массив
 * 
 * Алгоритм:
 * 1. Нормализует ISBN
 * 2. Формирует URL для запроса
 * 3. Загружает HTML-страницу
 * 4. Парсит страницу и извлекает данные о книге
 * 5. Возвращает результат, если найдено название
 */
export async function fetchIsbnDbByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  // Нормализуем ISBN (удаляем дефисы, приводим к единому формату)
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  
  // Формируем URL для запроса к ISBNdb
  const url = `https://isbndb.com/book/${encodeURIComponent(normalizedIsbn)}`;
  
  // Загружаем HTML-страницу
  const html = await fetchText(url, { timeoutMs });
  
  // Парсим страницу и извлекаем данные о книге
  const book = parseIsbnDbPage(html, url, normalizedIsbn);
  
  // Возвращаем результат только если есть название книги
  return book?.title ? [book] : [];
}

/**
 * Парсинг HTML-страницы ISBNdb для извлечения данных о книге
 * @param {string} html - HTML-код страницы
 * @param {string} url - URL страницы (для построения абсолютных ссылок)
 * @param {string} isbnHint - ISBN для подсказки, если не найден в других местах
 * @returns {Object} - Объект с данными о книге
 * 
 * Стратегия парсинга:
 * 1. Извлекает встроенные данные из JavaScript (__NEXT_DATA__, __INITIAL_STATE__)
 * 2. Извлекает JSON-LD разметку
 * 3. Парсит HTML-текст и мета-теги
 * 4. Комбинирует данные из всех источников с приоритетом
 */
export function parseIsbnDbPage(html = '', url = '', isbnHint = '') {
  // Извлекаем встроенные данные из JavaScript
  const embedded = extractEmbeddedBookData(html);
  // Извлекаем JSON-LD разметку
  const jsonLd = extractJsonLdBooks(html)[0] || {};
  // Преобразуем HTML в текст для поиска
  const text = htmlToText(html);

  // Извлекаем все поля с приоритетом (embedded > jsonLd > meta > текст)
  const title = cleanupTitle(firstNonEmpty(
    embedded.title, 
    jsonLd.name, 
    extractMeta(html, 'og:title'), 
    extractTitle(html)
  ));

  const authors = uniqueStrings([
    ...normalizePeople(embedded.authors || embedded.author),
    ...normalizePeople(jsonLd.author),
    field(text, ['Authors', 'Author', 'Авторы', 'Автор']),
  ]);

  const publisher = firstNonEmpty(
    embedded.publisher, 
    normalizeOrganization(jsonLd.publisher), 
    field(text, ['Publisher', 'Издательство'])
  );

  const year = parseYear(firstNonEmpty(
    embedded.date_published, 
    embedded.publish_date, 
    embedded.datePublished, 
    jsonLd.datePublished, 
    field(text, ['Published', 'Published Date', 'Год издания'])
  ));

  const cover = absolutizeUrl(firstNonEmpty(
    embedded.image, 
    embedded.image_url, 
    embedded.cover, 
    jsonLd.image, 
    extractMeta(html, 'og:image')
  ), url);

  const description = cleanupDescription(firstNonEmpty(
    embedded.synopsis, 
    embedded.description, 
    jsonLd.description, 
    extractMeta(html, 'description'), 
    extractMeta(html, 'og:description')
  ));

  const isbn = normalizeIsbn(firstNonEmpty(
    embedded.isbn13, 
    embedded.isbn, 
    embedded.isbn10, 
    jsonLd.isbn, 
    field(text, ['ISBN13', 'ISBN-13', 'ISBN']), 
    isbnHint
  ));

  const dimensions = cleanupValue(firstNonEmpty(
    embedded.dimensions, 
    embedded.physical_dimensions, 
    field(text, ['Dimensions', 'Размеры', 'Размер']), 
    findByRegex(text, /(?:Dimensions|Размер(?:ы)?)\s*:?\s*([^\n]+(?:inches|inch|cm|мм|mm)[^\n]*)/i)
  ));

  const weight = cleanupValue(firstNonEmpty(
    embedded.weight, 
    field(text, ['Weight', 'Вес']), 
    findByRegex(text, /(?:Weight|Вес)\s*:?\s*([^\n]+(?:pounds|lbs|ounces|oz|kg|г|кг)[^\n]*)/i)
  ));

  const pages = normalizeNumber(firstNonEmpty(
    embedded.pages, 
    embedded.num_pages, 
    field(text, ['Pages', 'Print length', 'Страниц'])
  ));

  const tags = uniqueStrings([
    ...(embedded.subjects || embedded.categories || []), 
    field(text, ['Subjects', 'Categories', 'Genres', 'Теги', 'Жанры'])
  ].flatMap(splitList));

  // Возвращаем сформированный объект с данными
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
    sources: [SOURCE],           // Источник данных
    links: [url],               // Ссылка на страницу
    raw: { [SOURCE]: { url, embedded, text: text.slice(0, 4000) } }, // Сырые данные для отладки
  };
}

/**
 * Извлечение встроенных данных о книге из JavaScript на странице
 * @param {string} html - HTML-код страницы
 * @returns {Object} - Объект с данными о книге
 * 
 * Ищет:
 * - __NEXT_DATA__ (Next.js)
 * - __INITIAL_STATE__ (React/Redux)
 * - __NUXT__ (Nuxt.js)
 * - book/bookData (пользовательские переменные)
 */
function extractEmbeddedBookData(html) {
  const candidates = [];
  
  // Ищем __NEXT_DATA__ (используется в Next.js приложениях)
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (nextData) candidates.push(parseJson(nextData));

  // Ищем другие возможные встроенные данные
  for (const match of html.matchAll(/<script[^>]*>\s*(?:window\.)?(?:__INITIAL_STATE__|__NUXT__|book|bookData)\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/gi)) {
    candidates.push(parseJson(match[1]));
  }

  // Ищем объект с данными книги в каждом кандидате
  for (const candidate of candidates.filter(Boolean)) {
    const found = findBookLikeObject(candidate);
    if (found) return found;
  }
  
  return {};
}

/**
 * Рекурсивный поиск объекта, похожего на книгу
 * @param {*} value - Объект для проверки
 * @param {number} depth - Глубина рекурсии для предотвращения бесконечного цикла
 * @returns {Object|null} - Найденный объект книги или null
 * 
 * Проверяет наличие ключей: title/name + isbn/isbn13/isbn10/author
 */
function findBookLikeObject(value, depth = 0) {
  if (!value || depth > 7) return null;
  
  // Если массив, проверяем каждый элемент
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBookLikeObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  
  // Если не объект, пропускаем
  if (typeof value !== 'object') return null;
  
  // Проверяем, похож ли объект на книгу
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hasBookShape = (keys.includes('title') || keys.includes('name')) && 
    keys.some((key) => ['isbn', 'isbn13', 'isbn10'].includes(key) || key.includes('author'));
  
  if (hasBookShape) return value;
  
  // Рекурсивно проверяем дочерние объекты
  for (const child of Object.values(value)) {
    const found = findBookLikeObject(child, depth + 1);
    if (found) return found;
  }
  
  return null;
}

/**
 * Извлечение JSON-LD разметки о книгах
 * @param {string} html - HTML-код страницы
 * @returns {Array} - Массив объектов книг из JSON-LD
 */
function extractJsonLdBooks(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  
  return blocks.flatMap(([, raw]) => {
    try {
      const parsed = JSON.parse(decodeHtml(raw.trim()));
      // Поддерживаем как одиночный объект, так и массив с @graph
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
      // Фильтруем только элементы с типом Book
      return items.filter((item) => String(item?.['@type'] || '').toLowerCase().includes('book'));
    } catch {
      return [];
    }
  });
}

/**
 * Парсинг JSON с обработкой ошибок
 * @param {string} raw - Строка JSON
 * @returns {Object|null} - Распарсенный объект или null
 */
function parseJson(raw) {
  try {
    return JSON.parse(decodeHtml(raw));
  } catch {
    return null;
  }
}

/**
 * Поиск поля в тексте по меткам
 * @param {string} text - Текст для поиска
 * @param {Array} labels - Массив возможных меток поля
 * @returns {string} - Найденное значение или пустая строка
 * 
 * Пример: field(text, ['Author', 'Автор']) найдет "Author: Толстой"
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
 * Нормализация списка авторов
 * @param {*} value - Массив или строка с авторами
 * @returns {Array} - Массив имен авторов
 */
function normalizePeople(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => (typeof item === 'string' ? item : item?.name || item?.title)).filter(Boolean);
}

/**
 * Нормализация названия организации/издательства
 * @param {*} value - Строка или объект с названием
 * @returns {string} - Название организации
 */
function normalizeOrganization(value) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.name || '';
}

/**
 * Разбиение строки с разделителями на список значений
 * @param {*} value - Строка или массив для разбиения
 * @returns {Array} - Массив уникальных значений
 * 
 * Поддерживает разделители: , ; |
 */
function splitList(value = '') {
  if (Array.isArray(value)) return value.flatMap(splitList);
  return String(value).split(/[,;|]/).map((item) => cleanupValue(item)).filter(Boolean);
}

/**
 * Извлечение числа из строки
 * @param {*} value - Строка с числом
 * @returns {number|undefined} - Извлеченное число или undefined
 */
function normalizeNumber(value) {
  const match = String(value || '').match(/\d{1,5}/);
  return match ? Number(match[0]) : undefined;
}

/**
 * Поиск значения по регулярному выражению
 * @param {string} text - Текст для поиска
 * @param {RegExp} regex - Регулярное выражение
 * @returns {string} - Найденное значение или пустая строка
 */
function findByRegex(text, regex) {
  return cleanupValue(text.match(regex)?.[1] || '');
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
 */
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

/**
 * Извлечение заголовка страницы
 * @param {string} html - HTML-код страницы
 * @returns {string} - Заголовок страницы
 */
function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
}

/**
 * Преобразование HTML в текст с сохранением структуры
 * @param {string} html - HTML-код страницы
 * @returns {string} - Очищенный текст
 * 
 * Преобразования:
 * - Удаляет скрипты и стили
 * - Заменяет блочные теги на переносы строк
 * - Удаляет HTML-теги
 * - Нормализует пробелы
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
 * Очистка заголовка от суффиксов ISBNdb
 * @param {string} title - Исходный заголовок
 * @returns {string} - Очищенный заголовок
 */
function cleanupTitle(title = '') {
  return cleanupValue(title)
    .replace(/\s*\|\s*ISBNdb.*$/i, '')
    .replace(/\s*[-—]\s*ISBNdb.*$/i, '')
    .replace(/^Book details\s*:?\s*/i, '');
}

/**
 * Очистка описания от префиксов
 * @param {string} value - Исходное описание
 * @returns {string} - Очищенное описание
 */
function cleanupDescription(value = '') {
  return cleanupValue(value).replace(/^Description\s*:?\s*/i, '');
}

/**
 * Общая очистка строкового значения
 * @param {string} value - Исходная строка
 * @returns {string} - Очищенная строка
 * 
 * Преобразования:
 * - Декодирование HTML-сущностей
 * - Удаление лишних пробелов
 * - Удаление начальных разделителей
 */
function cleanupValue(value = '') {
  return decodeHtml(String(value)).replace(/\s+/g, ' ').replace(/^[:\-–—]\s*/, '').trim();
}

/**
 * Получение первого непустого значения
 * @param {...*} values - Значения для проверки
 * @returns {*} - Первое непустое значение
 */
function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';
}

/**
 * Преобразование относительного URL в абсолютный
 * @param {string} value - Относительный URL
 * @param {string} base - Базовый URL
 * @returns {string} - Абсолютный URL
 */
function absolutizeUrl(value = '', base = '') {
  if (!value) return '';
  try {
    return new URL(value, base || 'https://isbndb.com').toString();
  } catch {
    return value;
  }
}

/**
 * Декодирование HTML-сущностей
 * @param {string} value - Строка с HTML-сущностями
 * @returns {string} - Декодированная строка
 * 
 * Поддерживаемые сущности: &quot;, &#x27;, &amp;, &lt;, &gt;, &nbsp;
 */
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