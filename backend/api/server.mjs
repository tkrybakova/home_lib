// Импорт модуля для создания HTTP-сервера из Node.js
import { createServer } from 'node:http';
// Импорт основного сервиса для поиска книг
import { BookResolverService } from './resolver.mjs';

// Определение порта для сервера:
// 1. Из переменной окружения BOOK_RESOLVER_PORT
// 2. Из аргументов командной строки (process.argv[2])
// 3. По умолчанию 8787
const port = Number(process.env.BOOK_RESOLVER_PORT || process.argv[2] || 8787);

// Создаем экземпляр сервиса для поиска книг
// Использует кэш, таймауты и логгер по умолчанию
const resolver = new BookResolverService();

/**
 * Создание HTTP-сервера
 * 
 * Эндпоинты API:
 * 
 * 1. GET /book/isbn/{isbn} - Получить книгу по ISBN
 *    Пример: GET /book/isbn/978-5-17-123456-7
 *    Ответ: { title, authors, variants, ... }
 * 
 * 2. GET /book/search?q={query} - Поиск книг по тексту
 *    Пример: GET /book/search?q=Война%20и%20мир
 *    Ответ: { query, results: [...] }
 * 
 * 3. GET /health - Проверка работоспособности
 *    Ответ: { ok: true, service: 'book-resolver-api' }
 * 
 * Особенности:
 * - Только GET-запросы (для простоты)
 * - CORS заголовки для доступа из браузера
 * - JSON ответы с единым форматированием
 * - Обработка ошибок с соответствующими HTTP статусами
 */
const server = createServer(async (request, response) => {
  try {
    // Парсим URL запроса
    // Используем хост из заголовков или localhost для корректного парсинга
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    // Проверяем метод запроса - поддерживаем только GET
    if (request.method !== 'GET') {
      return sendJson(response, 405, { error: 'Method not allowed' });
    }

    // --- Эндпоинт: Получение книги по ISBN ---
    // URL: /book/isbn/{isbn}
    // Декодируем ISBN из URL (поддерживает спецсимволы)
    if (url.pathname.startsWith('/book/isbn/')) {
      const isbn = decodeURIComponent(url.pathname.slice('/book/isbn/'.length));
      // Вызываем сервис для поиска по ISBN
      const result = await resolver.resolveByIsbn(isbn);
      // Возвращаем результат с соответствующим HTTP статусом
      return sendJson(response, result.status, result.body);
    }

    // --- Эндпоинт: Поиск книг по тексту ---
    // URL: /book/search?q={query}
    // Извлекаем параметр q из query string
    if (url.pathname === '/book/search') {
      const result = await resolver.search(url.searchParams.get('q'));
      return sendJson(response, result.status, result.body);
    }

    // --- Эндпоинт: Проверка здоровья сервиса ---
    // URL: /health
    // Используется для мониторинга и проверки доступности
    if (url.pathname === '/health') {
      return sendJson(response, 200, { ok: true, service: 'book-resolver-api' });
    }

    // --- Обработка неизвестных маршрутов ---
    // Если ни один эндпоинт не подошел - возвращаем 404
    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    // Обработка неожиданных ошибок
    console.error(error);
    // Возвращаем 500 Internal Server Error
    return sendJson(response, 500, { error: 'Internal server error' });
  }
});

/**
 * Запуск сервера
 * Слушаем на всех интерфейсах (0.0.0.0) для доступности извне
 * Выводим информацию о запуске в консоль
 */
server.listen(port, '0.0.0.0', () => {
  console.log(`Book Resolver API listening at http://localhost:${port}`);
});

/**
 * Вспомогательная функция для отправки JSON-ответа
 * @param {Object} response - Объект HTTP-ответа
 * @param {number} status - HTTP статус-код
 * @param {Object} body - Тело ответа (будет преобразовано в JSON)
 * 
 * Заголовки ответа:
 * - Content-Type: application/json; charset=utf-8
 * - Access-Control-Allow-Origin: * (CORS для доступа из браузера)
 * 
 * Форматирование JSON с отступами для удобочитаемости (2 пробела)
 */
function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*', // Разрешаем CORS запросы из любых источников
  });
  response.end(JSON.stringify(body, null, 2));
}