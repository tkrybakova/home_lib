/**
 * Утилиты для выполнения HTTP-запросов с поддержкой таймаутов
 * 
 * Назначение:
 * - Единый интерфейс для fetch-запросов
 * - Автоматическая обработка таймаутов через AbortController
 * - Специализированные функции для JSON и текстовых ответов
 * - Единая обработка ошибок HTTP
 * 
 * Используется во всех модулях-источниках данных:
 * - SERP (поисковик)
 * - LiveLib
 * - ISBN Search
 * - ISBNdb
 */

/**
 * Выполнение GET-запроса с ожиданием JSON-ответа
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут в миллисекундах (по умолчанию 3000)
 * @param {Object} options.headers - Дополнительные заголовки
 * @returns {Promise<Object>} - Распарсенный JSON-ответ
 * @throws {Error} - При HTTP ошибке или таймауте
 * 
 * Особенности:
 * - Автоматически устанавливает заголовок Accept: application/json
 * - Использует AbortSignal.timeout() для отмены запроса
 * - Бросает ошибку при статусе ответа не 2xx
 * 
 * Пример использования:
 * const data = await fetchJson('https://api.example.com/books/123');
 */
export async function fetchJson(url, { timeoutMs = 3000, headers = {} } = {}) {
  // Выполняем fetch с автоматическим таймаутом
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs), // Отмена запроса по истечении таймаута
    headers: { 
      accept: 'application/json', // Ожидаем JSON ответ
      ...headers // Пользовательские заголовки переопределяют стандартные
    },
  });

  // Проверяем статус ответа
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  // Парсим и возвращаем JSON
  return response.json();
}

/**
 * Выполнение GET-запроса с ожиданием текстового ответа (обычно HTML)
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции запроса
 * @param {number} options.timeoutMs - Таймаут в миллисекундах (по умолчанию 3000)
 * @param {Object} options.headers - Дополнительные заголовки
 * @returns {Promise<string>} - Текст ответа
 * @throws {Error} - При HTTP ошибке или таймауте
 * 
 * Особенности:
 * - Устанавливает заголовки для получения HTML
 * - Добавляет User-Agent для имитации браузера
 * - Используется для парсинга веб-страниц
 * 
 * Заголовки:
 * - accept: предпочитаем HTML, затем XHTML, XML, и любые другие форматы
 * - user-agent: идентифицирует бота (BookResolverBot)
 * 
 * Пример использования:
 * const html = await fetchText('https://example.com/book/123');
 */
export async function fetchText(url, { timeoutMs = 3000, headers = {} } = {}) {
  // Выполняем fetch с автоматическим таймаутом
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs), // Отмена запроса по истечении таймаута
    headers: {
      // Заголовки для получения HTML-страниц
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      // Идентификация бота (важно для соблюдения правил robots.txt)
      'user-agent': 'BookResolverBot/0.1 (+local development)',
      ...headers // Пользовательские заголовки переопределяют стандартные
    },
  });

  // Проверяем статус ответа
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  // Возвращаем тело ответа как текст
  return response.text();
}