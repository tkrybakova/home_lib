import { parseYear, uniqueStrings } from '../utils/isbn.mjs';

// Идентификатор источника, используется в итоговом объекте
const SOURCE = 'isbn_search';

/**
 * Парсинг HTML-страницы isbnsearch.org и извлечение структурированных данных.
 * @param {string} html – полный HTML страницы
 * @param {string} url – URL страницы (для преобразования относительных ссылок)
 * @param {string} isbnHint – ISBN, переданный в запросе (запасной вариант)
 * @returns {Object} объект с полями: isbn, title, authors, publisher, year,
 *   cover, description, tags, dimensions, weight, pages, sources, links, raw
 *
 * Источники данных (по приоритету):
 *   - JSON-LD разметка (основной)
 *   - meta-теги (og:title, og:image, description)
 *   - заголовок H1 и title
 *   - текст страницы, разбираемый по меткам (Author, Publisher, …)
 */
export function parseIsbnSearchPage(html = '', url = '', isbnHint = '') {
  // 1. Извлекаем JSON-LD – главный структурированный источник
  const jsonLdBooks = extractJsonLdBooks(html);
  const jsonLd = jsonLdBooks[0] || {};

  // 2. Преобразуем HTML в читаемый текст (удаляем теги, скрипты)
  const text = htmlToText(html);

  // 3. Заполняем поля, комбинируя JSON-LD, meta и текст
  const title = cleanupTitle(
    jsonLd.name ||
    extractMeta(html, 'og:title') ||
    extractHeading(html) ||
    extractTitle(html)
  );

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
    extractImage(html)          // прямой поиск <img> с классом cover/book
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

  // Размеры и вес – ищем по меткам и регулярным выражениям
  const dimensions = firstNonEmpty(
    field(text, ['Dimensions', 'Размеры', 'Размер']),
    findByRegex(text, /(?:Dimensions|Размер(?:ы)?)\s*:?\s*([^\n]+(?:inches|inch|cm|мм|mm)[^\n]*)/i)
  );

  const weight = firstNonEmpty(
    field(text, ['Weight', 'Вес']),
    findByRegex(text, /(?:Weight|Вес)\s*:?\s*([^\n]+(?:pounds|lbs|ounces|oz|kg|г|кг)[^\n]*)/i)
  );

  const pages = findPages(text);

  // Тэги/категории – склеиваем список, убираем дубликаты
  const tags = uniqueStrings([
    field(text, ['Subjects', 'Categories', 'Теги', 'Жанры'])
  ].flatMap(splitList));

  // Собираем итоговый объект книги
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
    sources: [SOURCE],                     // откуда получены данные
    links: [url],                         // ссылка на страницу-источник
    raw: { [SOURCE]: { url, title, text: text.slice(0, 4000) } } // сырые данные для отладки
  };
}

// ---------- вспомогательные функции парсинга ----------

/**
 * Извлекает все JSON-LD блоки с типом Book.
 * @param {string} html
 * @returns {Array} массив объектов книг из JSON-LD
 */
function extractJsonLdBooks(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.flatMap(([, raw]) => {
    try {
      const parsed = JSON.parse(decodeHtml(raw.trim()));
      // Поддерживаем одиночный объект и массив @graph
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
      return items.filter((item) => String(item?.['@type'] || '').toLowerCase().includes('book'));
    } catch {
      return [];
    }
  });
}

/**
 * Ищет значение в тексте по набору меток (например, "Author: Толстой").
 * @param {string} text – текст страницы
 * @param {string[]} labels – возможные названия поля
 * @returns {string} значение после метки или пустая строка
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
 * Приводит авторов к плоскому массиву строк.
 * @param {*} value – строка, объект {name}, или массив
 * @returns {string[]}
 */
function normalizePeople(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
}

/**
 * Извлекает название организации (издателя) из строки или объекта.
 * @param {*} value
 * @returns {string}
 */
function normalizeOrganization(value) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.name || '';
}

/**
 * Ищет первое совпадение регулярного выражения в тексте.
 * @param {string} text
 * @param {RegExp} regex
 * @returns {string}
 */
function findByRegex(text, regex) {
  return cleanupValue(text.match(regex)?.[1] || '');
}

/**
 * Специализированный поиск количества страниц в тексте.
 * Поддерживает шаблоны: "Paperback: 123", "123 pages", "123 стр."
 * @param {string} text
 * @returns {number|undefined}
 */
function findPages(text) {
  const value =
    text.match(/(?:Paperback|Hardcover|Print length|Pages|Страниц|стр\.)\s*:?\s*(\d{1,5})/i)?.[1] ||
    text.match(/\b(\d{1,5})\s*(?:pages|стр\.)\b/i)?.[1] ||
    '';
  return value ? Number(value) : undefined;
}

/**
 * Разбивает строку по разделителям , ; | и очищает элементы.
 * @param {*} value – строка или массив
 * @returns {string[]}
 */
function splitList(value = '') {
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

/**
 * Извлекает значение атрибута content из meta-тега по name или property.
 * @param {string} html
 * @param {string} property – имя свойства (например 'og:title')
 * @returns {string}
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
 * Текст из первого заголовка H1.
 * @param {string} html
 * @returns {string}
 */
function extractHeading(html) {
  return decodeHtml(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || ''
  );
}

/**
 * Текст из <title> страницы.
 * @param {string} html
 * @returns {string}
 */
function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
}

/**
 * Прямой поиск URL обложки: ищет <img> с id/class, содержащим 'cover' или 'book'.
 * @param {string} html
 * @returns {string}
 */
function extractImage(html) {
  return decodeHtml(
    html.match(/<img[^>]+(?:id|class)=["'][^"']*(?:cover|book)[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1] || ''
  );
}

/**
 * Преобразует HTML в текстовое представление:
 * - удаляет скрипты и стили
 * - блочные теги заменяет на переносы строк
 * - убирает оставшиеся теги
 * - схлопывает пробелы
 * @param {string} html
 * @returns {string}
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
 * Удаляет из заголовка суффикс "| ISBN Search" или "— ISBN Search".
 * @param {string} title
 * @returns {string}
 */
function cleanupTitle(title = '') {
  return decodeHtml(title)
    .replace(/\s*\|\s*ISBN Search.*$/i, '')
    .replace(/\s*[-—]\s*ISBN Search.*$/i, '')
    .trim();
}

/**
 * Убирает префикс "Description:" в начале строки описания.
 * @param {string} value
 * @returns {string}
 */
function cleanupDescription(value = '') {
  return cleanupValue(value).replace(/^Description\s*:?\s*/i, '');
}

/**
 * Общая очистка значения: декодирование HTML-сущностей,
 * схлопывание пробелов, удаление начальных двоеточий и дефисов.
 * @param {string} value
 * @returns {string}
 */
function cleanupValue(value = '') {
  return decodeHtml(String(value)).replace(/\s+/g, ' ').replace(/^[:\-–—]\s*/, '').trim();
}

/**
 * Возвращает первый непустой аргумент.
 * @param  {...any} values
 * @returns {*}
 */
function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';
}

/**
 * Преобразует относительный URL в абсолютный, используя base.
 * @param {string} value – относительный URL
 * @param {string} base – базовый URL страницы
 * @returns {string}
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
 * Декодирует типовые HTML-сущности (&quot;, &amp;, &lt; и т.д.).
 * @param {string} value
 * @returns {string}
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

// Экспортируем нормализацию ISBN для переиспользования в парсере
import { normalizeIsbn } from '../utils/isbn.mjs';