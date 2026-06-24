// Импорт утилит для нормализации ISBN и удаления дубликатов
import { normalizeIsbn, uniqueStrings } from '../utils/isbn.mjs';

// Приоритет источников данных (от наиболее надежного к наименее)
const PRIORITY = ['livelib', 'isbn_db', 'isbn_search', 'serp'];

/**
 * Основная функция нормализации результатов поиска книг
 * @param {Array} results - Массив результатов поиска
 * @returns {Array} - Отсортированный массив сгруппированных книг
 * 
 * Алгоритм работы:
 * 1. Группирует книги по ISBN или нормализованному названию
 * 2. Для каждой группы применяет слияние данных
 * 3. Сортирует по уровню достоверности (от высокого к низкому)
 */
export function normalizeBooks(results = []) {
  // Карта для группировки книг по уникальному ключу
  const groups = new Map();
  
  // Фильтруем пустые результаты и группируем
  for (const result of results.filter(Boolean)) {
    // Ключом может быть ISBN или нормализованное название
    const key = normalizeIsbn(result.isbn) || normalizeTitleKey(result.title);
    if (!key) continue; // Пропускаем записи без ключа
    
    // Добавляем результат в соответствующую группу
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }

  // Преобразуем группы в массив, сливаем каждую группу и сортируем по достоверности
  return [...groups.values()].map(mergeBookGroup).sort((a, b) => b.confidence_score - a.confidence_score);
}

/**
 * Слияние группы книг в одну запись с приоритетом источников
 * @param {Array} group - Массив книг с одинаковым ISBN/названием
 * @returns {Object} - Объединенная книга с метаданными и оценкой достоверности
 * 
 * Стратегия слияния:
 * - Выбираем значения из наиболее приоритетного источника
 * - Объединяем списки (авторы, теги, ссылки, источники)
 * - Вычисляем оценку достоверности
 */
export function mergeBookGroup(group = []) {
  // Сортируем книги по приоритету источника (от наиболее надежного)
  const byPriority = [...group].sort((a, b) => sourceRank(a) - sourceRank(b));
  
  // Собираем все уникальные источники данных
  const sources = uniqueStrings(byPriority.flatMap((book) => book.sources || []));
  
  // Извлекаем основные поля (берем первое непустое значение)
  const isbn = normalizeIsbn(firstValue(byPriority, 'isbn'));
  const title = firstValue(byPriority, 'title');
  const authors = uniqueStrings(byPriority.flatMap((book) => book.authors || []));
  const publisher = firstValue(byPriority, 'publisher');
  const year = firstValue(byPriority, 'year');
  const cover = firstValue(byPriority, 'cover');
  const description = firstValue(byPriority, 'description');
  const tags = uniqueStrings(byPriority.flatMap((book) => book.tags || []));
  const dimensions = firstValue(byPriority, 'dimensions');
  const weight = firstValue(byPriority, 'weight');
  const pages = firstValue(byPriority, 'pages');
  
  // Объединяем сырые данные и ссылки из всех источников
  const raw = Object.assign({}, ...byPriority.map((book) => book.raw || {}));
  const links = uniqueStrings(byPriority.flatMap((book) => book.links || []));

  // Создаем объект книги
  const book = { 
    isbn, title, authors, publisher, year, cover, description, tags, 
    dimensions, weight, pages, sources, raw, links 
  };

  // Возвращаем обогащенный объект с оценкой достоверности
  return {
    isbn: book.isbn,
    title: book.title,
    authors: book.authors,
    publisher: book.publisher,
    year: book.year,
    cover: book.cover,
    description: book.description,
    tags: book.tags,
    dimensions: book.dimensions,
    weight: book.weight,
    pages: book.pages,
    sources: book.sources,
    confidence_score: calculateConfidence(book), // Вычисляем оценку достоверности
    raw, // Сырые данные (для отладки)
    links, // Ссылки на источники
  };
}

/**
 * Преобразование книги к публичному формату (без сырых данных)
 * @param {Object} book - Внутренний объект книги
 * @returns {Object} - Очищенный объект для внешнего использования
 * 
 * Используется для API-ответов или передачи в UI
 */
export function toPublicBook(book) {
  return {
    isbn: book.isbn || '',
    title: book.title || '',
    authors: book.authors || [],
    publisher: book.publisher || '',
    year: book.year || undefined,
    cover: book.cover || '',
    description: book.description || '',
    tags: book.tags || [],
    dimensions: book.dimensions || '',
    weight: book.weight || '',
    pages: book.pages || undefined,
    sources: book.sources || [],
    confidence_score: book.confidence_score || 0,
  };
}

/**
 * Получение первого непустого значения поля из массива книг
 * @param {Array} books - Массив книг
 * @param {string} field - Название поля
 * @returns {*} - Значение поля из первой книги, где оно есть
 * 
 * Используется при слиянии: берем значение из самого приоритетного источника
 */
function firstValue(books, field) {
  return books.find((book) => book[field])?.[field] || '';
}

/**
 * Определение ранга источника данных
 * @param {Object} book - Объект книги
 * @returns {number} - Числовой ранг (чем меньше, тем выше приоритет)
 * 
 * Ранг определяется по первому источнику в массиве sources
 * Если источник не найден в PRIORITY, получает самый низкий приоритет
 */
function sourceRank(book) {
  const source = (book.sources || [])[0];
  const rank = PRIORITY.indexOf(source);
  return rank === -1 ? PRIORITY.length : rank;
}

/**
 * Вычисление оценки достоверности книги
 * @param {Object} book - Объект книги
 * @returns {number} - Оценка от 0 до 1
 * 
 * Критерии оценки:
 * - Базовый вес: 0.15
 * - Каждый источник: +0.16 (макс. 4 источника)
 * - Наличие ISBN: +0.12
 * - Наличие названия: +0.12
 * - Наличие авторов: +0.10
 * - Наличие года: +0.06
 * - Наличие обложки: +0.06
 * - Наличие издательства: +0.04
 * - Наличие описания: +0.04
 * 
 * Итоговая оценка ограничивается 1.0 и округляется до 2 знаков
 */
function calculateConfidence(book) {
  let score = 0.15; // Базовая оценка
  
  // Каждый уникальный источник добавляет достоверности
  score += Math.min((book.sources || []).length, 4) * 0.16;
  
  // Наличие конкретных полей повышает достоверность
  if (book.isbn) score += 0.12;
  if (book.title) score += 0.12;
  if ((book.authors || []).length > 0) score += 0.1;
  if (book.year) score += 0.06;
  if (book.cover) score += 0.06;
  if (book.publisher) score += 0.04;
  if (book.description) score += 0.04;
  
  // Ограничиваем и округляем
  return Math.min(1, Number(score.toFixed(2)));
}

/**
 * Нормализация названия книги для использования в качестве ключа группировки
 * @param {string} title - Исходное название
 * @returns {string} - Нормализованное название
 * 
 * Преобразования:
 * - Приведение к строке
 * - Обрезка пробелов
 * - Приведение к нижнему регистру (русская локаль)
 * - Замена множественных пробелов на один
 * 
 * Используется как fallback, когда ISBN недоступен
 */
function normalizeTitleKey(title = '') {
  return String(title).trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}