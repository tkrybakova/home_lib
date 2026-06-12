# Домашняя библиотека

Мини-приложение для ведения домашней библиотеки прямо в браузере. Данные сохраняются локально в `localStorage`, поэтому проект можно запускать без сервера и базы данных.

## Возможности

- несколько независимых библиотек;
- добавление, переименование и удаление шкафов;
- добавление, переименование и удаление полок внутри шкафов;
- добавление, редактирование, удаление и перемещение книг между полками;
- ввод ISBN вручную и сканирование штрихкода через браузерный `BarcodeDetector`, если он доступен;
- автозаполнение названия, авторов, издателя, года, обложки, описания, тегов, размеров, веса и числа страниц по ISBN через LiveLib, ISBN Search и ISBNdb;- фильтрация книг по названию, автору, ISBN, тегу, шкафу, полке и году;
- сортировка по названию, автору, году издания и дате добавления.

## Запуск

```bash
npm run start
```

Команда запускает и frontend (`http://localhost:5173`), и локальный Book Resolver API (`http://localhost:8787`). Если нужен только статический интерфейс без API, используйте `npm run dev`. Камера работает на `localhost`; при публикации для Android нужен HTTPS. Скрипты запуска используют Node.js и работают в Windows PowerShell, macOS и Linux без Python.

## Проверка

```bash
npm run build
```

Команда проверяет синтаксис основного JavaScript-файла, service worker, локального статического сервера и валидирует `manifest.webmanifest` средствами Node.js. Перед синтаксической проверкой запускается `scripts/check-conflicts.mjs`, который находит незавершённые Git merge-конфликты (`<<<<<<<`, `=======`, `>>>>>>>`) и показывает точный файл/строку вместо неочевидной ошибки `Unexpected token '<<'`.

## ISBN и автозаполнение

В форме книги нажмите «Загрузить» рядом с ISBN. Интерфейс обращается только к локальному Book Resolver API, а backend параллельно использует открытые HTML-источники: LiveLib, `https://isbnsearch.org/isbn/<ISBN>` и parser страницы `https://isbndb.com/book/<ISBN>`. Google Books и Open Library больше не используются. Заполняются доступные поля: название, авторы, издательство, год, обложка, описание, теги, размеры, вес и число страниц. После сканирования штрихкода ISBN форма открывается автоматически и сразу пытается загрузить метаданные. Если источники вернули несколько карточек, форма показывает выпадающий список вариантов, и выбранный вариант полностью перезаписывает поля формы.

## Примечания по сканеру

Сканирование штрихкода работает в браузерах, где доступен Web API `BarcodeDetector`, и требует разрешения на камеру. На Android это обычно Chrome или актуальный системный WebView. Если API недоступен, ISBN можно ввести вручную в блоке сканирования.

## Как отгрузить на телефон

### Вариант 1: установить как PWA

1. Опубликуйте папку проекта на HTTPS-хостинге: Netlify, Vercel, GitHub Pages, Firebase Hosting или любом статическом сервере.
2. Откройте сайт на Android в Chrome.
3. В меню Chrome выберите «Добавить на главный экран» или «Установить приложение».
4. После установки PWA будет открываться как отдельное приложение. Камера для сканера работает только на HTTPS или `localhost`.

### Вариант 2: собрать Android APK через Capacitor

1. Установите Android Studio и Node.js.
2. В корне проекта выполните `npm install @capacitor/core @capacitor/cli @capacitor/android --save-dev`.
3. Выполните `npx cap init home-lib ru.home.library --web-dir .`.
4. Выполните `npx cap add android`.
5. Выполните `npx cap open android` и соберите APK/AAB в Android Studio.
6. Для доступа к камере проверьте разрешение `android.permission.CAMERA` в Android-проекте и тестируйте на реальном устройстве.

### Вариант 3: Trusted Web Activity

Если приложение уже опубликовано как HTTPS PWA, его можно упаковать в Google Play через Trusted Web Activity/Bubblewrap. Этот вариант оставляет веб-приложение на сервере, а Android-приложение открывает его в полноэкранном Chrome-контейнере.

## Подготовка к Android

Приложение подготовлено как installable PWA:

- добавлен `manifest.webmanifest` с standalone-режимом, portrait-ориентацией, цветом темы и иконкой;
- добавлен service worker `sw.js`, который кэширует оболочку приложения для офлайн-открытия;
- интерфейс адаптирован под touch-экраны, safe-area и портретный режим;
- для камеры на Android публикуйте приложение по HTTPS или упаковывайте PWA через Trusted Web Activity/Capacitor.

Для упаковки в Android можно использовать этот статический проект как web assets: `index.html`, `src/`, `manifest.webmanifest`, `sw.js`.

## Book Resolver API

В проект добавлен backend-сервис для агрегации данных о книгах по ISBN и текстовому запросу.

### Запуск API

```bash
npm run api
```

По умолчанию сервис доступен на `http://localhost:8787`.

### REST endpoints

```bash
GET /book/isbn/:isbn
GET /book/search?q=текстовый+запрос
GET /health
```

Примеры:

```bash
curl http://localhost:8787/book/isbn/9785171776534
curl "http://localhost:8787/book/search?q=мастер%20и%20маргарита"
```

Ответ для найденной книги:

```json
{
  "isbn": "9785171776534",
  "title": "Название книги",
  "authors": ["Автор"],
  "publisher": "Издательство",
  "year": 2024,
  "cover": "https://...",
  "description": "Описание",
  "tags": ["роман"],
  "dimensions": "20 x 13 cm",
  "weight": "450 г",
  "pages": 416,
  "sources": ["livelib", "isbn_db"],
  "confidence_score": 0.85,
  "cache": { "hit": false }
}
```

### Источники и нормализация

Сервис запускает источники параллельно и не ломает весь ответ, если один источник упал:

1. `backend/sources/livelib.mjs` — HTML parser страниц LiveLib, найденных через SERP и прямой ISBN-поиск.
2. `backend/sources/isbnSearch.mjs` — parser страницы `https://isbnsearch.org/isbn/<ISBN>`.
3. `backend/sources/isbnDb.mjs` — parser страницы `https://isbndb.com/book/<ISBN>`; дополнительно вытаскивает размеры, вес и страницы из HTML/embedded JSON, если они есть.
4. `backend/sources/serp.mjs` — поисковый слой для нахождения книжных страниц, в первую очередь LiveLib; для тестов можно передать `SERP_MOCK_RESULTS` JSON.

`backend/normalizer/index.mjs` объединяет одинаковые книги, удаляет дубликаты авторов, выбирает поля по приоритету `LiveLib > ISBNdb > ISBN Search > SERP` и рассчитывает `confidence_score`.

### SQLite cache

Кэш хранится в SQLite-файле `data/book-cache.sqlite` и таблице `books`:

```sql
books (
  isbn PRIMARY KEY,
  title,
  authors,
  year,
  cover,
  raw_json,
  updated_at
)
```

Настройки окружения:

- `BOOK_CACHE_DB` — путь к SQLite-файлу;
- `BOOK_CACHE_TTL_DAYS` — TTL кэша, по умолчанию 14 дней;
- `BOOK_SOURCE_TIMEOUT_MS` — таймаут источника, по умолчанию 3000 мс;
- `BOOK_RESOLVER_PORT` — порт API, по умолчанию 8787;
- `SERP_MOCK_RESULTS` — JSON-массив mock SERP результатов для локального тестирования.
