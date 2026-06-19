// Импорт утилит для работы с сетью и нормализации данных
import { fetchText } from '../utils/fetchJson.mjs';
import { normalizeIsbn, parseYear, uniqueStrings } from '../utils/isbn.mjs';

// Константа источника данных
const SOURCE = 'isbn_search';

/**
 * Основная функция для получения данных о книге из ISBN Search по ISBN
 * @param {string} isbn - ISBN книги
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут запроса в миллисекундах
 * @returns {Promise<Array>} - Массив с данными о книге или пустой массив
 * 
 * Алгоритм:
 * 1. Нормализует ISBN
 * 2. Формирует URL для запроса к isbnsearch.org
 * 3. Загружает HTML-страницу
 * 4. Парсит страницу и извлекает данные о книге
 * 5. Возвращает результат, если найдено название
 * 
 * Отличие от ISBNdb: isbnsearch.org имеет более простую структуру,
 * но меньше встроенных данных
 */
export async function fetchIsbnSearchByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  // Нормализуем ISBN (удаляем дефисы, приводим к единому формату)
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];
  
  // Формируем URL для запроса к ISBN Search
  const url = `https://isbnsearch.org/isbn/${encodeURIComponent(normalizedIsbn)}`;
  
  // Загружаем HTML-страницу
  const html = await fetchText(url, { timeoutMs });
  
  // Парсим страницу и извлекаем данные о книге
  const book = parseIsbnSearchPage(html, url, normalizedIsbn);
  
  // Возвращаем результат только если есть название книги
  return book?.title ? [book] : [];
}

/**
 * Парсинг HTML-страницы ISBN Search для извлечения данных о книге
 * @param {string} html - HTML-код страницы
 * @param {string} url - URL страницы (для построения абсолютных ссылок)
 * @param {string} isbnHint - ISBN для подсказки, если не найден в других местах
 * @returns {Object} - Объект с данными о книге
 * 
 * Особенности парсинга ISBN Search:
 * - Основной источник данных - JSON-LD разметка
 * - Меньше встроенных данных по сравнению с ISBNdb
 * - Больше полей приходится извлекать из текста страницы
 */
export function parseIsbnSearchPage(html = '', url = '', isbnHint = '') {
  // Извлекаем JSON-LD разметку (основной источник данных)
  const jsonLdBooks = extractJsonLdBooks(html);
  const jsonLd = jsonLdBooks[0] || {};
  
  // Преобразуем HTML в текст для поиска
  const text = htmlToText(html);

  // Извлекаем поля с приоритетом (jsonLd > meta > текст)
  const title = cleanupTitle(
    jsonLd.name || 
    extractMeta(html, 'og:title') || 
    extractHeading(html) || 
    extractTitle(html)
  );

  // Авторы: комбинируем из JSON-LD и текста
  const authors = uniqueStrings([
    ...normalizePeople(jsonLd.author),
    field(text, ['Author', 'Authors', 'Автор', 'Авторы']),
  ]);

  const publisher = firstNonEmpty(
    normalizeOrganization(jsonLd.publisher),
    field(text, ['Publisher', 'Издательство']),
  );

  const year = parseYear(firstNonEmpty(
    jsonLd.datePublished, 
    field(text, ['Published', 'Publication Date', 'Год издания'])
  ));

  const cover = absolutizeUrl(firstNonEmpty(
    jsonLd.image, 
    extractMeta(html, 'og:image'), 
    extractImage(html)  // Прямой поиск изображения
  ), url);

  const description = cleanupDescription(firstNonEmpty(
    jsonLd.description, 
    extractMeta(html, 'description'), 
    extractMeta(html, 'og:description')
  ));

  const isbn = normalizeIsbn(firstNonEmpty(
    jsonLd.isbn, 
    field(text, ['ISBN-13', 'ISBN13', 'ISBN']), 
    isbnHint
  ));

  const dimensions = firstNonEmpty(
    field(text, ['Dimensions', 'Размеры', 'Размер']), 
    findByRegex(text, /(?:Dimensions|Размер(?:ы)?)\s*:?\s*([^\n]+(?:inches|inch|cm|мм|mm)[^\n]*)/i)
  );

  const weight = firstNonEmpty(
    field(text, ['Weight', 'Вес']), 
    findByRegex(text, /(?:Weight|Вес)\s*:?\s*([^\n]+(?:pounds|lbs|ounces|oz|kg|г|кг)[^\n]*)/i)
  );

  // Специализированная функция поиска количества страниц
  const pages = findPages(text);
  
  const tags = uniqueStrings([
    field(text, ['Subjects', 'Categories', 'Теги', 'Жанры'])
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
    raw: { [SOURCE]: { url, title, text: text.slice(0, 4000) } }, // Сырые данные для отладки
  };
}

/**
 * Извлечение JSON-LD разметки о книгах
 * @param {string} html - HTML-код страницы
 * @returns {Array} - Массив объектов книг из JSON-LD
 * 
 * В ISBN Search используется JSON-LD для структурированных данных,
 * что является основным источником информации
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
  return items.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
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
 * Поиск значения по регулярному выражению
 * @param {string} text - Текст для поиска
 * @param {RegExp} regex - Регулярное выражение
 * @returns {string} - Найденное значение или пустая строка
 */
function findByRegex(text, regex) {
  return cleanupValue(text.match(regex)?.[1] || '');
}

/**
 * Специализированная функция поиска количества страниц
 * @param {string} text - Текст для поиска
 * @returns {number|undefined} - Количество страниц или undefined
 * 
 * Ищет по шаблонам:
 * - "Paperback: 123"
 * - "Pages: 123"
 * - "123 pages"
 * - "123 стр."
 */
function findPages(text) {
  const value = text.match(
    /(?:Paperback|Hardcover|Print length|Pages|Страниц|стр\.)\s*:?\s*(\d{1,5})/i
  )?.[1] || 
  text.match(/\b(\d{1,5})\s*(?:pages|стр\.)\b/i)?.[1] || 
  '';
  
  return value ? Number(value) : undefined;
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
 * Извлечение заголовка из H1
 * @param {string} html - HTML-код страницы
 * @returns {string} - Текст заголовка H1
 * 
 * В ISBN Search название книги часто находится в H1
 */
function extractHeading(html) {
  return decodeHtml(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || ''
  );
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
 * Прямой поиск изображения обложки в HTML
 * @param {string} html - HTML-код страницы
 * @returns {string} - URL изображения или пустая строка
 * 
 * Ищет img с id/class содержащими 'cover' или 'book'
 */
function extractImage(html) {
  return decodeHtml(
    html.match(/<img[^>]+(?:id|class)=["'][^"']*(?:cover|book)[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1] || ''
  );
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
 * Очистка заголовка от суффиксов ISBN Search
 * @param {string} title - Исходный заголовок
 * @returns {string} - Очищенный заголовок
 */
function cleanupTitle(title = '') {
  return decodeHtml(title)
    .replace(/\s*\|\s*ISBN Search.*$/i, '')
    .replace(/\s*[-—]\s*ISBN Search.*$/i, '')
    .trim();
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
    return new URL(value, base || 'https://isbnsearch.org').toString();
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