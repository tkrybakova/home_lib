// backend/api/resolver.mjs
// Импорт компонентов для работы с кэшем и источниками данных
import { BookCache } from '../../backend/cache/sqliteCache.mjs';
import { fetchLiveLibByIsbn, fetchLiveLibFromSearchResults } from './livelib.mjs';
import { fetchIsbnSearchByIsbn } from '../../backend/sources/isbnSearch.mjs';
import { fetchIsbnDbByIsbn } from './isbndb.mjs';
// Импорт нормализаторов для приведения данных к единому формату
import { normalizeBooks, toPublicBook } from '../backend/normalizer/index.mjs';
// Импорт утилит для работы с ISBN
import { looksLikeIsbn, normalizeIsbn } from '../../backend/utils/isbn.mjs';

// Таймаут по умолчанию для всех запросов к источникам
const DEFAULT_TIMEOUT_MS = Number(process.env.BOOK_SOURCE_TIMEOUT_MS || 3000);

/**
 * Основной сервис для поиска и получения информации о книгах
 * 
 * Архитектура:
 * - Кэширование результатов для ускорения повторных запросов
 * - Параллельный опрос всех источников данных
 * - Нормализация и слияние данных из разных источников
 * - Формирование единого ответа с вариантами
 * 
 * Паттерны:
 * - Dependency Injection (кэш, логгер)
 * - Circuit Breaker (safeSource для обработки ошибок)
 * - Strategy (разные источники данных)
 * - Repository (кэш как хранилище)
 */
export class BookResolverService {
  /**
   * Конструктор сервиса
   * @param {Object} options - Опции сервиса
   * @param {BookCache} options.cache - Инстанс кэша
   * @param {number} options.timeoutMs - Таймаут запросов
   * @param {Object} options.logger - Логгер (console по умолчанию)
   */
  constructor({ cache = new BookCache(), timeoutMs = DEFAULT_TIMEOUT_MS, logger = console } = {}) {
    this.cache = cache;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  /**
   * Поиск книги по ISBN с полным разрешением данных
   * @param {string} isbn - ISBN книги
   * @returns {Promise<Object>} - Ответ с данными книги или ошибкой
   * 
   * Алгоритм:
   * 1. Нормализация и валидация ISBN
   * 2. Проверка кэша (возврат если данные свежие)
   * 3. Параллельный опрос источников:
   *    - LiveLib (прямой поиск по ISBN)
   *    - LiveLib (через поиск по сохранённым ссылкам)
   *    - ISBN Search
   *    - ISBNdb
   * 4. Нормализация и слияние данных
   * 5. Выбор лучшего результата
   * 6. Сохранение в кэш
   * 7. Формирование ответа с вариантами
   * 
   * Важно: Все запросы выполняются параллельно для максимальной скорости
   */
  async resolveByIsbn(isbn) {
    // Нормализуем ISBN и проверяем его валидность
    const normalizedIsbn = normalizeIsbn(isbn);
    if (!looksLikeIsbn(normalizedIsbn)) {
      return { status: 400, body: { error: 'Invalid ISBN' } };
    }

    // Проверяем кэш - возможно данные уже есть
    const cached = this.cache.getFresh(normalizedIsbn);
    if (cached && isAllowedCachedBook(cached)) {
      const publicBook = toPublicBook(cached);
      return {
        status: 200,
        body: {
          ...publicBook,
          variants: [publicBook],
          cache: cached.cache,
        },
      };
    }

    // Запускаем все запросы параллельно (SERP исключён)
    const [livelibFromSearch, livelibByIsbn, isbnSearch, isbnDb] = await Promise.all([
      // LiveLib через сохранённые ссылки (ранее получаемые из SERP)
      this.safeSource('livelib', () =>
        fetchLiveLibFromSearchResults([], { timeoutMs: this.timeoutMs })
      ),
      // Прямой поиск LiveLib по ISBN
      this.safeSource('livelib', () =>
        fetchLiveLibByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })
      ),
      this.safeSource('isbn_search', () =>
        fetchIsbnSearchByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })
      ),
      this.safeSource('isbn_db', () =>
        fetchIsbnDbByIsbn(normalizedIsbn, { timeoutMs: this.timeoutMs })
      ),
    ]);

    // Объединяем все результаты в один массив (без SERP)
    const sourceCandidates = [
      ...livelibFromSearch,
      ...livelibByIsbn,
      ...isbnSearch,
      ...isbnDb,
    ];

    // Нормализуем и группируем результаты
    const normalized = normalizeBooks(sourceCandidates);

    // Выбираем лучший результат:
    // 1. Сначала ищем точное совпадение по ISBN
    // 2. Если нет - берем первый (отсортирован по достоверности)
    const best = normalized.find((book) => book.isbn === normalizedIsbn) || normalized[0];

    // Если ничего не найдено - возвращаем 404
    if (!best) {
      return { status: 404, body: { error: 'Book not found', isbn: normalizedIsbn } };
    }

    // Сохраняем в кэш (если есть ISBN)
    if (best.isbn) this.cache.upsert(best);

    // Формируем варианты для показа пользователю
    const variants = buildVariants(normalized, sourceCandidates);

    return {
      status: 200,
      body: {
        ...toPublicBook(best),
        variants,
        cache: { hit: false }, // Указываем, что это не из кэша
      },
    };
  }

  /**
   * Поиск книг по текстовому запросу
   * @param {string} query - Поисковый запрос
   * @returns {Promise<Object>} - Ответ с ошибкой (поиск без SERP не поддерживается)
   * 
   * Ранее использовал SERP для получения ссылок, без него текстовый поиск невозможен.
   */
  async search(query) {
    const q = String(query || '').trim();
    if (!q) return { status: 400, body: { error: 'Missing query parameter q' } };

    // Если запрос похож на ISBN - используем точный поиск
    if (looksLikeIsbn(q)) return this.resolveByIsbn(q);

    // Текстовый поиск отключён
    return {
      status: 501,
      body: { error: 'Text search is not available without SERP integration' },
    };
  }

  /**
   * Безопасный вызов источника данных с обработкой ошибок
   * @param {string} name - Имя источника (для логирования)
   * @param {Function} callback - Функция-источник
   * @returns {Promise<Array>} - Результат или пустой массив при ошибке
   * 
   * Паттерн Circuit Breaker (упрощенная версия):
   * - Перехватывает все ошибки
   * - Логирует их
   * - Возвращает пустой массив вместо выброса исключения
   * 
   * Это позволяет одному источнику не блокировать работу остальных
   */
  async safeSource(name, callback) {
    try {
      return await callback();
    } catch (error) {
      this.logger.warn?.(`[${name}] ${error.message}`);
      return [];
    }
  }
}

/**
 * Проверка, допустимо ли использование кэшированной книги
 * @param {Object} book - Объект книги из кэша
 * @returns {boolean} - true если книга из доверенных источников
 * 
 * Доверенные источники: livelib, isbn_search, isbn_db.
 * SERP исключён, так как больше не используется.
 */
function isAllowedCachedBook(book) {
  const allowed = new Set(['livelib', 'isbn_search', 'isbn_db']);
  return (book.sources || []).every((source) => allowed.has(source));
}

/**
 * Построение списка вариантов книг для пользователя
 * @param {Array} normalizedBooks - Нормализованные книги
 * @param {Array} sourceCandidates - Сырые кандидаты из источников
 * @returns {Array} - Список уникальных вариантов книг (макс. 8)
 * 
 * Алгоритм построения вариантов:
 * 1. Сначала идут нормализованные книги
 * 2. Затем добавляются сырые результаты из источников
 * 3. Исключаются дубликаты по ISBN+название+авторы+источники
 * 4. Ограничение - максимум 8 вариантов
 */
function buildVariants(normalizedBooks, sourceCandidates) {
  const variants = [];
  const seen = new Set();

  // Проходим по всем книгам: сначала нормализованные, потом сырые
  for (const book of [...normalizedBooks, ...sourceCandidates]) {
    const publicBook = { ...toPublicBook(book), cache: { hit: false } };
    
    // Пропускаем книги без названия
    if (!publicBook.title) continue;

    // Формируем ключ для проверки дубликатов
    const key = [
      publicBook.isbn,
      publicBook.title,
      publicBook.authors.join(','),
      publicBook.sources.join(',')
    ].join('|').toLocaleLowerCase('ru-RU');

    // Пропускаем дубликаты
    if (seen.has(key)) continue;
    seen.add(key);

    // Добавляем вариант
    variants.push(publicBook);

    // Ограничиваем количество вариантов
    if (variants.length >= 8) break;
  }

  return variants;
}