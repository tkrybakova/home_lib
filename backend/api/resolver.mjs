// Импорт компонентов для работы с кэшем и источниками данных
import { BookCache } from '../cache/sqliteCache.mjs';
import { fetchSearchResults } from '../sources/serp.mjs';
import { fetchLiveLibByIsbn, fetchLiveLibFromSearchResults } from '../sources/livelib.mjs';
import { fetchIsbnSearchByIsbn } from '../sources/isbnSearch.mjs';
import { fetchIsbnDbByIsbn } from '../sources/isbnDb.mjs';
// Импорт нормализаторов для приведения данных к единому формату
import { normalizeBooks, toPublicBook } from '../normalizer/index.mjs';
// Импорт утилит для работы с ISBN
import { looksLikeIsbn, normalizeIsbn } from '../utils/isbn.mjs';

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
   * 3. Параллельный опрос всех источников:
   *    - SERP (поисковик)
   *    - LiveLib (через SERP)
   *    - LiveLib (прямой поиск по ISBN)
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

    // Формируем промисы для параллельного запроса всех источников
    // SERP - поиск в интернете
    const serpResultsPromise = this.safeSource('serp', () => 
      fetchSearchResults(normalizedIsbn, { timeoutMs: this.timeoutMs })
    );

    // LiveLib через результаты SERP (цепочка зависимостей)
    const livelibFromSerpPromise = serpResultsPromise.then((serpResults) =>
      this.safeSource('livelib', () => 
        fetchLiveLibFromSearchResults(serpResults, { timeoutMs: this.timeoutMs })
      )
    );

    // Запускаем все запросы параллельно
    const [serpResults, livelibFromSearch, livelibByIsbn, isbnSearch, isbnDb] = await Promise.all([
      serpResultsPromise,
      livelibFromSerpPromise,
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

    // Объединяем все результаты в один массив
    const sourceCandidates = [
      ...livelibFromSearch, 
      ...livelibByIsbn, 
      ...isbnSearch, 
      ...isbnDb, 
      ...serpResults
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
        cache: { hit: false } // Указываем, что это не из кэша
      },
    };
  }

  /**
   * Поиск книг по текстовому запросу
   * @param {string} query - Поисковый запрос
   * @returns {Promise<Object>} - Ответ со списком книг или ошибкой
   * 
   * Особенности:
   * - Если запрос похож на ISBN - перенаправляет в resolveByIsbn
   * - Иначе выполняет поиск через SERP и LiveLib
   * - Возвращает до 10 результатов
   * - Сохраняет все найденные книги в кэш
   * 
   * Отличие от resolveByIsbn: 
   * - Меньше источников (только SERP + LiveLib)
   * - Возвращает список, а не одну книгу
   * - Не проверяет кэш перед запросом
   */
  async search(query) {
    const q = String(query || '').trim();
    if (!q) return { status: 400, body: { error: 'Missing query parameter q' } };

    // Если запрос похож на ISBN - используем точный поиск
    if (looksLikeIsbn(q)) return this.resolveByIsbn(q);

    // Иначе выполняем поиск по тексту
    // SERP - поиск в интернете
    const serpResultsPromise = this.safeSource('serp', () => 
      fetchSearchResults(q, { timeoutMs: this.timeoutMs })
    );

    // LiveLib через результаты SERP
    const livelibPromise = serpResultsPromise.then((serpResults) =>
      this.safeSource('livelib', () => 
        fetchLiveLibFromSearchResults(serpResults, { timeoutMs: this.timeoutMs })
      )
    );

    // Запускаем запросы параллельно
    const [serpResults, livelib] = await Promise.all([serpResultsPromise, livelibPromise]);

    // Нормализуем и объединяем результаты (максимум 10)
    const normalized = normalizeBooks([...livelib, ...serpResults]).slice(0, 10);

    // Сохраняем все найденные книги в кэш
    for (const book of normalized) {
      if (book.isbn) this.cache.upsert(book);
    }

    return {
      status: 200,
      body: {
        query: q,
        results: normalized.map((book) => ({ 
          ...toPublicBook(book), 
          cache: { hit: false } 
        })),
      },
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
 * Фильтрует только книги из основных источников:
 * - livelib - социальная сеть книголюбов
 * - isbn_search - база ISBN
 * - isbn_db - база ISBNdb
 * - serp - поисковик (только для первичных данных)
 * 
 * Книги из других источников не кэшируются
 */
function isAllowedCachedBook(book) {
  const allowed = new Set(['livelib', 'isbn_search', 'isbn_db', 'serp']);
  return (book.sources || []).every((source) => allowed.has(source));
}

/**
 * Построение списка вариантов книг для пользователя
 * @param {Array} normalizedBooks - Нормализованные книги
 * @param {Array} sourceCandidates - Сырые кандидаты из источников
 * @returns {Array} - Список уникальных вариантов книг (макс. 8)
 * 
 * Алгоритм построения вариантов:
 * 1. Сначала идут нормализованные книги (с высоким confidence)
 * 2. Затем добавляются сырые результаты из источников
 * 3. Исключаются дубликаты по ISBN+название+авторы+источники
 * 4. SERP-результаты добавляются только если нет других вариантов
 * 5. Ограничение - максимум 8 вариантов
 * 
 * Это позволяет пользователю выбрать наиболее подходящий вариант,
 * если автоматический выбор оказался неверным
 */
function buildVariants(normalizedBooks, sourceCandidates) {
  const variants = [];
  const seen = new Set();

  // Проходим по всем книгам: сначала нормализованные, потом сырые
  for (const book of [...normalizedBooks, ...sourceCandidates]) {
    const publicBook = { ...toPublicBook(book), cache: { hit: false } };
    
    // Пропускаем книги без названия
    if (!publicBook.title) continue;

    // Пропускаем SERP-результаты, если есть другие варианты
    if (variants.length > 0 && publicBook.sources.length === 1 && publicBook.sources[0] === 'serp') continue;

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