// Импорт утилит для сетевых запросов и нормализации ISBN
import { fetchText } from '../utils/fetchJson.mjs';
import { normalizeIsbn } from '../utils/isbn.mjs';
// Парсер страницы вынесен в отдельный модуль
import { parseIsbnSearchPage } from './isbnSearchParser.mjs';

/**
 * Основная точка входа – получить данные книги по ISBN через isbnsearch.org.
 * @param {string} isbn - ISBN книги (любой формат)
 * @param {Object} [options] - дополнительные настройки
 * @param {number} [options.timeoutMs=3000] - таймаут запроса
 * @returns {Promise<Array>} массив с одним объектом книги или пустой массив
 *
 * Алгоритм:
 * 1. Нормализовать ISBN (убрать дефисы, пробелы).
 * 2. Сформировать URL к странице книги на isbnsearch.org.
 * 3. Загрузить HTML страницы.
 * 4. Отдать HTML парсеру parseIsbnSearchPage.
 * 5. Если парсер вернул название книги – обернуть в массив, иначе пусто.
 */
export async function fetchIsbnSearchByIsbn(isbn, { timeoutMs = 3000 } = {}) {
  // Нормализуем ISBN – без дефисов, только цифры и 'X'
  const normalizedIsbn = normalizeIsbn(isbn);
  if (!normalizedIsbn) return [];

  // Составляем URL (isbnsearch.org ожидает чистый ISBN в пути)
  const url = `https://isbnsearch.org/isbn/${encodeURIComponent(normalizedIsbn)}`;

  // Загружаем HTML-страницу с таймаутом
  const html = await fetchText(url, { timeoutMs });

  // Парсим HTML и получаем объект книги
  const book = parseIsbnSearchPage(html, url, normalizedIsbn);

  // Возвращаем только если удалось извлечь название
  return book?.title ? [book] : [];
}