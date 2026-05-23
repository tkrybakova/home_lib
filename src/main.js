const STORAGE_KEY = 'home-lib:libraries';
const ACTIVE_KEY = 'home-lib:active-library';

const app = document.querySelector('#app');
let state = loadState();
let selectedCabinetId = '';
let filters = { query: '', cabinet: '', shelf: '', author: '', tag: '', year: '' };
let sort = { key: 'title', direction: 'asc' };
let editingBook = null;
let scannerStream = null;
let scannerTrack = null;
let scannerStatus = 'Можно сканировать камерой или ввести ISBN вручную.';
let scannedIsbn = '';
let lookupVariants = [];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

function id(prefix) {
  return `${prefix}-${crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function now() {
  return new Date().toISOString();
}

function createShelf(order = 0, name = `Полка ${order + 1}`) {
  return { id: id('shelf'), name, order, books: [] };
}

function createLibrary(name = 'Моя библиотека') {
  const createdAt = now();
  return {
    id: id('library'),
    name,
    description: '',
    createdAt,
    updatedAt: createdAt,
    cabinets: [{ id: id('cabinet'), name: 'Главный шкаф', location: 'Дом', shelves: [createShelf(0)] }],
  };
}

function loadState() {
  try {
    const libraries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const safeLibraries = Array.isArray(libraries) && libraries.length ? libraries : [createLibrary()];
    const savedActiveId = localStorage.getItem(ACTIVE_KEY);
    return {
      libraries: safeLibraries,
      activeLibraryId: safeLibraries.some((library) => library.id === savedActiveId) ? savedActiveId : safeLibraries[0].id,
    };
  } catch {
    const library = createLibrary();
    return { libraries: [library], activeLibraryId: library.id };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.libraries));
  localStorage.setItem(ACTIVE_KEY, state.activeLibraryId);
}

function activeLibrary() {
  return state.libraries.find((library) => library.id === state.activeLibraryId) || state.libraries[0];
}

function updateActive(updater) {
  state.libraries = state.libraries.map((library) =>
    library.id === state.activeLibraryId ? { ...updater(library), updatedAt: now() } : library,
  );
  persist();
  render();
}

function allBooks(library = activeLibrary()) {
  return library.cabinets.flatMap((cabinet) =>
    cabinet.shelves.flatMap((shelf) =>
      shelf.books.map((book) => ({ book, cabinetId: cabinet.id, cabinetName: cabinet.name, shelfId: shelf.id, shelfName: shelf.name })),
    ),
  );
}

function countBooks(cabinet) {
  return cabinet.shelves.reduce((sum, shelf) => sum + shelf.books.length, 0);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function list(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIsbnBarcode(rawValue = '') {
  const digits = String(rawValue).replace(/[^0-9Xx]/g, '').toUpperCase();
  if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) return digits;
  if (digits.length === 10) return digits;
  return digits.length >= 8 ? digits : '';
}

function parsePublishedYear(value = '') {
  return String(value).match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[0] || '';
}

function setLookupStatus(message, type = 'info') {
  const status = app.querySelector('[data-lookup-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
}

function setFormField(form, name, value, replace = false) {
  const field = form.elements[name];
  if (!field || value === undefined || value === null || value === '') return;
  if (replace || !String(field.value || '').trim()) {
    field.value = Array.isArray(value) ? value.join(', ') : value;
  }
}

function fillBookFormFromLookup(form, metadata, replace = false) {
  setFormField(form, 'title', metadata.title, replace);
  setFormField(form, 'authors', metadata.authors, replace);
  setFormField(form, 'publisher', metadata.publisher, replace);
  setFormField(form, 'publishedYear', metadata.publishedYear, replace);
  setFormField(form, 'coverUrl', metadata.coverUrl, replace);
  setFormField(form, 'description', metadata.description, replace);
  setFormField(form, 'tags', metadata.tags, replace);
}

function applyLookupVariant(index) {
  const form = app.querySelector('[data-book-form]');
  if (!form) return;
  const variant = lookupVariants[index];
  if (!variant) return;
  fillBookFormFromLookup(form, variant);
  setLookupStatus(`Применён вариант #${index + 1} из ${lookupVariants.length} (${variant.source}).`, 'success');
}

async function lookupBookByIsbn(isbn) {
  const normalizedIsbn = normalizeIsbnBarcode(isbn);
  if (!normalizedIsbn) throw new Error('Введите корректный ISBN или EAN-13.');

  const errors = [];
  for (const lookup of [lookupResolverApiByIsbn, lookupGoogleBookByIsbn, lookupOpenLibraryBookByIsbn]) {
    try {
      const metadata = await lookup(normalizedIsbn);
      if (metadata?.title) return metadata;
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(errors.at(-1) || 'Книга с таким ISBN не найдена в Book Resolver API, Google Books и Open Library.');
}

async function lookupResolverApiByIsbn(normalizedIsbn) {
  const response = await fetch(`/book/isbn/${encodeURIComponent(normalizedIsbn)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Book Resolver API временно недоступен.');

  const book = await response.json();
  if (!book?.title) throw new Error('Book Resolver API не нашёл книгу по ISBN.');

  return {
    title: book.title || '',
    authors: book.authors || [],
    publisher: '',
    publishedYear: book.year || '',
    coverUrl: book.cover || '',
    description: '',
    tags: book.sources || [],
    variants: (book.variants || []).map((variant) => ({
      title: variant.title || '',
      authors: variant.authors || [],
      publisher: variant.publisher || '',
      publishedYear: variant.year || '',
      coverUrl: variant.cover || '',
      description: variant.description || '',
      tags: variant.tags || [],
      source: `Book Resolver API (${(variant.sources || []).join(', ') || 'aggregated'})`,
    })),
    source: `Book Resolver API (${(book.sources || []).join(', ') || 'aggregated'})`,
  };
}

async function lookupGoogleBookByIsbn(normalizedIsbn) {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(normalizedIsbn)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Google Books временно недоступен.');

  const data = await response.json();
  const volume = data.items?.[0]?.volumeInfo;
  if (!volume) throw new Error('Книга с таким ISBN не найдена в Google Books.');

  return {
    title: [volume.title, volume.subtitle].filter(Boolean).join(': '),
    authors: volume.authors || [],
    publisher: volume.publisher || '',
    publishedYear: parsePublishedYear(volume.publishedDate),
    coverUrl: volume.imageLinks?.thumbnail?.replace('http://', 'https://') || volume.imageLinks?.smallThumbnail?.replace('http://', 'https://') || '',
    description: volume.description || '',
    tags: volume.categories || [],
    source: 'Google Books',
  };
}

async function lookupOpenLibraryBookByIsbn(normalizedIsbn) {
  const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(normalizedIsbn)}&jscmd=data&format=json`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Open Library временно недоступна.');

  const data = await response.json();
  const book = data[`ISBN:${normalizedIsbn}`];
  if (!book) throw new Error('Книга с таким ISBN не найдена в Open Library.');

  const authors = (book.authors || []).map((author) => author.name).filter(Boolean);
  const tags = (book.subjects || []).slice(0, 6).map((subject) => subject.name).filter(Boolean);
  const coverUrl = book.cover?.large || book.cover?.medium || book.cover?.small || `https://covers.openlibrary.org/b/isbn/${normalizedIsbn}-L.jpg`;
  const description = book.notes || book.excerpts?.[0]?.text || '';

  return {
    title: book.title || '',
    authors,
    publisher: book.publishers?.[0]?.name || '',
    publishedYear: parsePublishedYear(book.publish_date),
    coverUrl,
    description,
    tags,
    source: 'Open Library',
  };
}

async function lookupIntoCurrentBookForm(isbn) {
  const form = app.querySelector('[data-book-form]');
  if (!form) return;

  try {
    setLookupStatus('Ищем книгу по ISBN через Book Resolver API, затем Google Books и Open Library...', 'loading');
    const metadata = await lookupBookByIsbn(isbn);
    lookupVariants = metadata.variants || [];
    fillBookFormFromLookup(form, metadata);
    if (lookupVariants.length > 1) {
      render();
      const renderedForm = app.querySelector('[data-book-form]');
      if (renderedForm) fillBookFormFromLookup(renderedForm, metadata, true);
    }
    setLookupStatus(`Данные книги загружены из ${metadata.source}. ${lookupVariants.length > 1 ? 'Ниже доступны другие варианты.' : ''}`, 'success');
  } catch (error) {
    lookupVariants = [];
    setLookupStatus(error.message || 'Не удалось загрузить данные по ISBN.', 'error');
  }
}

function updateScannerStatus(message) {
  scannerStatus = message;
  const status = app.querySelector('[data-scanner-status]');
  if (status) status.textContent = message;
}

function stopScanner(message = 'Сканирование остановлено. Можно ввести ISBN вручную.') {
  scannerStream?.getTracks().forEach((track) => track.stop());
  scannerStream = null;
  scannerTrack = null;
  updateScannerStatus(message);
  const button = app.querySelector('[data-action="scan-toggle"]');
  if (button) button.textContent = 'Сканировать';
}

function findBook(bookId) {
  return allBooks().find(({ book }) => book.id === bookId);
}

function removeBook(library, bookId) {
  return {
    ...library,
    cabinets: library.cabinets.map((cabinet) => ({
      ...cabinet,
      shelves: cabinet.shelves.map((shelf) => ({ ...shelf, books: shelf.books.filter((book) => book.id !== bookId) })),
    })),
  };
}

function moveBook(library, bookId, cabinetId, shelfId) {
  let moved;
  const cleaned = removeBook(library, bookId);
  const source = findBook(bookId);
  moved = source?.book;
  if (!moved) return library;

  return {
    ...cleaned,
    cabinets: cleaned.cabinets.map((cabinet) =>
      cabinet.id === cabinetId
        ? { ...cabinet, shelves: cabinet.shelves.map((shelf) => (shelf.id === shelfId ? { ...shelf, books: [...shelf.books, moved] } : shelf)) }
        : cabinet,
    ),
  };
}

function getFilteredBooks() {
  const needle = filters.query.trim().toLowerCase();
  const author = filters.author.trim().toLowerCase();
  const tag = filters.tag.trim().toLowerCase();
  const year = filters.year.trim();

  return allBooks()
    .filter(({ book, cabinetId, shelfId }) => {
      const haystack = [book.title, book.isbn, ...(book.authors || []), ...(book.tags || [])].join(' ').toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (!filters.cabinet || cabinetId === filters.cabinet) &&
        (!filters.shelf || shelfId === filters.shelf) &&
        (!author || (book.authors || []).some((item) => item.toLowerCase().includes(author))) &&
        (!tag || (book.tags || []).some((item) => item.toLowerCase().includes(tag))) &&
        (!year || String(book.publishedYear || '').includes(year))
      );
    })
    .sort((left, right) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      const a = sortValue(left.book);
      const b = sortValue(right.book);
      return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' }) * direction;
    });
}

function sortValue(book) {
  if (sort.key === 'author') return book.authors?.[0] || '';
  if (sort.key === 'publishedYear') return book.publishedYear || 0;
  if (sort.key === 'createdAt') return Date.parse(book.createdAt || 0);
  return book.title || '';
}

function render() {
  const library = activeLibrary();
  if (!selectedCabinetId || !library.cabinets.some((cabinet) => cabinet.id === selectedCabinetId)) {
    selectedCabinetId = library.cabinets[0]?.id || '';
  }
  const books = getFilteredBooks();
  const shelves = library.cabinets.flatMap((cabinet) => cabinet.shelves.map((shelf) => ({ ...shelf, cabinetName: cabinet.name })));

  app.innerHTML = `
    <main>
      <header class="hero">
        <div>
          <p class="eyebrow">Минимодель</p>
          <h1>Домашняя библиотека</h1>
          <p>Локальное приложение для нескольких библиотек, шкафов, полок, сканирования ISBN, фильтрации и сортировки книг.</p>
        </div>
        <div class="hero-stats">
          <span>${library.cabinets.length} шкафов</span>
          <span>${library.cabinets.reduce((sum, cabinet) => sum + cabinet.shelves.length, 0)} полок</span>
          <span>${allBooks(library).length} книг</span>
        </div>
      </header>

      <section class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">Коллекции</p><h2>Библиотеки</h2></div>
          <button class="button primary" data-action="library-add">+ Библиотека</button>
        </div>
        <div class="library-list">
          ${state.libraries
            .map(
              (item) => `
              <article class="library-pill ${item.id === state.activeLibraryId ? 'active' : ''}">
                <button data-action="library-select" data-id="${item.id}"><strong>${escapeHtml(item.name)}</strong><span>${item.cabinets.length} шкаф.</span></button>
                <div class="inline-actions">
                  <button class="ghost" data-action="library-rename" data-id="${item.id}">✎</button>
                  <button class="ghost danger" data-action="library-delete" data-id="${item.id}">×</button>
                </div>
              </article>`,
            )
            .join('')}
        </div>
      </section>

      <div class="layout">
        <section class="panel">
          <div class="section-heading">
            <div><p class="eyebrow">Пространство</p><h2>Шкафы и полки</h2></div>
            <button class="button primary" data-action="cabinet-add">+ Шкаф</button>
          </div>
          <div class="cabinet-grid">
            ${library.cabinets
              .map(
                (cabinet) => `
                <article class="cabinet-card ${cabinet.id === selectedCabinetId ? 'active' : ''}">
                  <button class="card-select" data-action="cabinet-select" data-id="${cabinet.id}">
                    <span class="card-title">${escapeHtml(cabinet.name)}</span>
                    <span class="muted">${escapeHtml(cabinet.location || 'Место не указано')}</span>
                    <span class="badge-row"><span>${cabinet.shelves.length} полок</span><span>${countBooks(cabinet)} книг</span></span>
                  </button>
                  <div class="card-actions">
                    <button class="ghost" data-action="cabinet-edit" data-id="${cabinet.id}">Изменить</button>
                    <button class="ghost danger" data-action="cabinet-delete" data-id="${cabinet.id}">Удалить</button>
                  </div>
                  <div class="shelf-list">
                    ${[...cabinet.shelves]
                      .sort((a, b) => a.order - b.order)
                      .map(
                        (shelf) => `
                        <div class="shelf-row">
                          <button data-action="cabinet-select" data-id="${cabinet.id}"><span>${escapeHtml(shelf.name)}</span><small>${shelf.books.length} книг</small></button>
                          <button class="ghost" data-action="shelf-edit" data-cabinet="${cabinet.id}" data-id="${shelf.id}">✎</button>
                          <button class="ghost danger" data-action="shelf-delete" data-cabinet="${cabinet.id}" data-id="${shelf.id}">×</button>
                        </div>`,
                      )
                      .join('')}
                    <button class="add-shelf" data-action="shelf-add" data-id="${cabinet.id}">+ Добавить полку</button>
                  </div>
                </article>`,
              )
              .join('')}
          </div>
        </section>

        <section class="panel books-panel">
          <div class="section-heading">
            <div><p class="eyebrow">Каталог</p><h2>Книги</h2></div>
            <button class="button primary" data-action="book-add">+ Книга</button>
          </div>
          ${renderScanner()}
          ${editingBook ? renderBookForm() : ''}
          <section class="filters">
            <input data-filter="query" value="${escapeHtml(filters.query)}" placeholder="Поиск: название, автор, ISBN, тег" />
            <select data-filter="cabinet"><option value="">Все шкафы</option>${library.cabinets.map((cabinet) => `<option value="${cabinet.id}" ${filters.cabinet === cabinet.id ? 'selected' : ''}>${escapeHtml(cabinet.name)}</option>`).join('')}</select>
            <select data-filter="shelf"><option value="">Все полки</option>${shelves.map((shelf) => `<option value="${shelf.id}" ${filters.shelf === shelf.id ? 'selected' : ''}>${escapeHtml(shelf.cabinetName)} / ${escapeHtml(shelf.name)}</option>`).join('')}</select>
            <input data-filter="author" value="${escapeHtml(filters.author)}" placeholder="Автор" />
            <input data-filter="tag" value="${escapeHtml(filters.tag)}" placeholder="Тег" />
            <input data-filter="year" value="${escapeHtml(filters.year)}" placeholder="Год" />
            <select data-sort="key">
              <option value="title" ${sort.key === 'title' ? 'selected' : ''}>Сортировать: название</option>
              <option value="author" ${sort.key === 'author' ? 'selected' : ''}>Сортировать: автор</option>
              <option value="publishedYear" ${sort.key === 'publishedYear' ? 'selected' : ''}>Сортировать: год</option>
              <option value="createdAt" ${sort.key === 'createdAt' ? 'selected' : ''}>Сортировать: дата добавления</option>
            </select>
            <select data-sort="direction"><option value="asc" ${sort.direction === 'asc' ? 'selected' : ''}>По возрастанию</option><option value="desc" ${sort.direction === 'desc' ? 'selected' : ''}>По убыванию</option></select>
          </section>
          <div class="book-list">${books.length ? books.map(renderBook).join('') : '<div class="empty-state">Книг пока нет или они скрыты фильтрами. Добавьте первую книгу.</div>'}</div>
        </section>
      </div>
    </main>`;
}

function renderScanner() {
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  return `
    <section class="scanner-box">
      <div class="section-heading compact">
        <div><p class="eyebrow">Сканирование</p><h3>Добавить книгу по штрих-коду</h3></div>
        <button class="button secondary" data-action="scan-toggle">${scannerStream ? 'Остановить' : 'Сканировать'}</button>
      </div>
      <div class="scanner-frame">
        <video class="scanner-video" muted playsinline autoplay></video>
        <div class="scanner-target" aria-hidden="true"></div>
      </div>
      <p class="muted" data-scanner-status>${escapeHtml(scannerStatus)}</p>
      ${canScan ? '<p class="scanner-hint">На Android используйте Chrome/системный WebView и держите штрих-код ISBN внутри рамки.</p>' : '<p class="scanner-hint warning">Автосканирование недоступно в этом браузере. Для Android установите PWA или откройте в Chrome; ISBN можно ввести вручную.</p>'}
      <div class="manual-isbn">
        <input data-manual-isbn inputmode="numeric" autocomplete="off" value="${escapeHtml(scannedIsbn)}" placeholder="Введите ISBN или EAN-13 вручную" />
        <button class="button primary" data-action="isbn-use">Использовать ISBN</button>
      </div>
    </section>`;
}

function renderBookForm() {
  const found = editingBook.id ? findBook(editingBook.id) : null;
  const book = found?.book || { title: '', authors: [], tags: [], isbn: scannedIsbn };
  const location = found || { cabinetId: selectedCabinetId, shelfId: activeLibrary().cabinets.find((cabinet) => cabinet.id === selectedCabinetId)?.shelves[0]?.id || '' };
  const library = activeLibrary();

  return `
    <form class="book-form" data-book-form>
      ${
        lookupVariants.length > 1
          ? `<label>Найдено вариантов: ${lookupVariants.length}
              <select data-action="lookup-variant">
                ${lookupVariants
                  .map(
                    (item, index) =>
                      `<option value="${index}">#${index + 1}: ${escapeHtml(item.title || 'Без названия')} — ${escapeHtml((item.authors || []).join(', ') || 'автор неизвестен')}</option>`,
                  )
                  .join('')}
              </select>
            </label>`
          : ''
      }
      <div class="form-grid">
        <label>Название книги *<input name="title" required value="${escapeHtml(book.title)}" placeholder="Например, Мастер и Маргарита" /></label>
        <label>Авторы<input name="authors" value="${escapeHtml((book.authors || []).join(', '))}" placeholder="Через запятую" /></label>
        <label>ISBN
          <span class="isbn-lookup-row">
            <input name="isbn" inputmode="numeric" value="${escapeHtml(book.isbn || '')}" placeholder="978..." />
            <button class="button secondary" type="button" data-action="isbn-lookup">Загрузить</button>
          </span>
          <small class="lookup-status" data-lookup-status>Введите или отсканируйте ISBN, затем загрузите данные из Open Library.</small>
        </label>
        <label>Издательство<input name="publisher" value="${escapeHtml(book.publisher || '')}" /></label>
        <label>Год<input name="publishedYear" type="number" min="0" value="${escapeHtml(book.publishedYear || '')}" /></label>
        <label>Теги<input name="tags" value="${escapeHtml((book.tags || []).join(', '))}" placeholder="фантастика, избранное" /></label>
        <label>Обложка URL<input name="coverUrl" value="${escapeHtml(book.coverUrl || '')}" placeholder="https://..." /></label>
        <label>Шкаф<select name="cabinetId">${library.cabinets.map((cabinet) => `<option value="${cabinet.id}" ${location.cabinetId === cabinet.id ? 'selected' : ''}>${escapeHtml(cabinet.name)}</option>`).join('')}</select></label>
        <label>Полка<select name="shelfId">${library.cabinets.flatMap((cabinet) => cabinet.shelves.map((shelf) => `<option value="${shelf.id}" data-cabinet="${cabinet.id}" ${location.shelfId === shelf.id ? 'selected' : ''}>${escapeHtml(cabinet.name)} / ${escapeHtml(shelf.name)}</option>`)).join('')}</select></label>
      </div>
      <label>Описание<textarea name="description" rows="3">${escapeHtml(book.description || '')}</textarea></label>
      <div class="form-actions"><button class="button primary">Сохранить книгу</button><button class="button secondary" type="button" data-action="book-cancel">Отмена</button></div>
    </form>`;
}

function renderBook({ book, cabinetName, shelfName, cabinetId, shelfId }) {
  const library = activeLibrary();
  return `
    <article class="book-card">
      ${book.coverUrl ? `<img class="cover" src="${escapeHtml(book.coverUrl)}" alt="" />` : '<div class="cover placeholder">📚</div>'}
      <div class="book-content">
        <div class="book-main"><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml((book.authors || []).join(', ') || 'Автор не указан')}</p><small>${escapeHtml(cabinetName)} · ${escapeHtml(shelfName)}${book.publishedYear ? ` · ${book.publishedYear}` : ''}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ''}</small></div>
        ${book.description ? `<p class="description">${escapeHtml(book.description)}</p>` : ''}
        <div class="tag-row">${(book.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
        <div class="book-actions">
          <select data-action="book-move" data-id="${book.id}">${library.cabinets.flatMap((cabinet) => cabinet.shelves.map((shelf) => `<option value="${cabinet.id}|${shelf.id}" ${cabinet.id === cabinetId && shelf.id === shelfId ? 'selected' : ''}>${escapeHtml(cabinet.name)} / ${escapeHtml(shelf.name)}</option>`)).join('')}</select>
          <button class="ghost" data-action="book-edit" data-id="${book.id}">Изменить</button>
          <button class="ghost danger" data-action="book-delete" data-id="${book.id}">Удалить</button>
        </div>
      </div>
    </article>`;
}

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const { action, id: itemId, cabinet } = button.dataset;
  if (!action) return;

  if (action === 'library-add') {
    const name = prompt('Название новой библиотеки', 'Новая библиотека')?.trim();
    if (!name) return;
    const library = createLibrary(name);
    state.libraries.push(library);
    state.activeLibraryId = library.id;
    filters = { query: '', cabinet: '', shelf: '', author: '', tag: '', year: '' };
    persist();
    render();
  }
  if (action === 'library-select') {
    state.activeLibraryId = itemId;
    filters = { query: '', cabinet: '', shelf: '', author: '', tag: '', year: '' };
    persist();
    render();
  }
  if (action === 'library-rename') {
    const library = state.libraries.find((item) => item.id === itemId);
    const name = prompt('Новое название библиотеки', library?.name)?.trim();
    if (!name) return;
    library.name = name;
    library.updatedAt = now();
    persist();
    render();
  }
  if (action === 'library-delete') {
    if (state.libraries.length === 1) return alert('Нельзя удалить последнюю библиотеку.');
    if (!confirm('Удалить библиотеку вместе со всеми шкафами и книгами?')) return;
    state.libraries = state.libraries.filter((library) => library.id !== itemId);
    state.activeLibraryId = state.libraries[0].id;
    persist();
    render();
  }
  if (action === 'cabinet-select') {
    selectedCabinetId = itemId;
    render();
  }
  if (action === 'cabinet-add') {
    const name = prompt('Название шкафа', 'Новый шкаф')?.trim();
    if (!name) return;
    const location = prompt('Где находится шкаф?', '')?.trim();
    updateActive((library) => ({ ...library, cabinets: [...library.cabinets, { id: id('cabinet'), name, location, shelves: [createShelf(0)] }] }));
  }
  if (action === 'cabinet-edit') {
    const current = activeLibrary().cabinets.find((item) => item.id === itemId);
    const name = prompt('Название шкафа', current?.name)?.trim();
    if (!name) return;
    const location = prompt('Расположение шкафа', current?.location || '')?.trim();
    updateActive((library) => ({ ...library, cabinets: library.cabinets.map((item) => (item.id === itemId ? { ...item, name, location } : item)) }));
  }
  if (action === 'cabinet-delete') {
    if (activeLibrary().cabinets.length === 1) return alert('Нельзя удалить последний шкаф библиотеки.');
    if (!confirm('Удалить шкаф вместе с полками и книгами?')) return;
    updateActive((library) => ({ ...library, cabinets: library.cabinets.filter((item) => item.id !== itemId) }));
  }
  if (action === 'shelf-add') {
    const cabinetData = activeLibrary().cabinets.find((item) => item.id === itemId);
    const name = prompt('Название полки', `Полка ${(cabinetData?.shelves.length || 0) + 1}`)?.trim();
    if (!name) return;
    updateActive((library) => ({ ...library, cabinets: library.cabinets.map((item) => (item.id === itemId ? { ...item, shelves: [...item.shelves, createShelf(item.shelves.length, name)] } : item)) }));
  }
  if (action === 'shelf-edit') {
    const shelf = activeLibrary().cabinets.find((item) => item.id === cabinet)?.shelves.find((item) => item.id === itemId);
    const name = prompt('Название полки', shelf?.name)?.trim();
    if (!name) return;
    updateActive((library) => ({ ...library, cabinets: library.cabinets.map((item) => (item.id === cabinet ? { ...item, shelves: item.shelves.map((shelfItem) => (shelfItem.id === itemId ? { ...shelfItem, name } : shelfItem)) } : item)) }));
  }
  if (action === 'shelf-delete') {
    const cabinetData = activeLibrary().cabinets.find((item) => item.id === cabinet);
    if (!cabinetData || cabinetData.shelves.length === 1) return alert('Нельзя удалить последнюю полку шкафа.');
    if (!confirm('Удалить полку вместе с книгами?')) return;
    updateActive((library) => ({ ...library, cabinets: library.cabinets.map((item) => (item.id === cabinet ? { ...item, shelves: item.shelves.filter((shelf) => shelf.id !== itemId) } : item)) }));
  }
  if (action === 'book-add') {
    editingBook = { id: null };
    scannedIsbn = '';
    lookupVariants = [];
    render();
  }
  if (action === 'book-cancel') {
    editingBook = null;
    scannedIsbn = '';
    lookupVariants = [];
    render();
  }
  if (action === 'book-edit') {
    editingBook = { id: itemId };
    render();
  }
  if (action === 'book-delete') {
    if (!confirm('Удалить книгу?')) return;
    updateActive((library) => removeBook(library, itemId));
  }
  if (action === 'isbn-use') {
    const value = normalizeIsbnBarcode(app.querySelector('[data-manual-isbn]')?.value.trim());
    if (!value) return alert('Введите корректный ISBN или EAN-13 штрих-код.');
    stopScanner('ISBN перенесён в форму книги.');
    scannedIsbn = value;
    editingBook = { id: null };
    render();
    await lookupIntoCurrentBookForm(value);
  }
  if (action === 'isbn-lookup') {
    const form = button.closest('[data-book-form]');
    const value = normalizeIsbnBarcode(form?.elements.isbn?.value);
    if (!value) return setLookupStatus('Введите корректный ISBN или EAN-13.', 'error');
    form.elements.isbn.value = value;
    await lookupIntoCurrentBookForm(value);
  }
  if (action === 'scan-toggle') {
    if (scannerStream) {
      stopScanner();
    } else {
      await startScanner();
    }
  }
});

app.addEventListener('change', (event) => {
  const input = event.target;
  if (input.dataset.filter) {
    filters[input.dataset.filter] = input.value;
    if (input.dataset.filter === 'cabinet') filters.shelf = '';
    render();
  }
  if (input.dataset.sort) {
    sort[input.dataset.sort] = input.value;
    render();
  }
  if (input.dataset.action === 'book-move') {
    const [cabinetId, shelfId] = input.value.split('|');
    updateActive((library) => moveBook(library, input.dataset.id, cabinetId, shelfId));
  }
  if (input.dataset.action === 'lookup-variant') {
    applyLookupVariant(Number(input.value || 0));
  }
});

app.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.filter) {
    filters[input.dataset.filter] = input.value;
    render();
  }
});

app.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-book-form]');
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const book = {
    id: editingBook?.id || id('book'),
    title: data.title.trim(),
    authors: list(data.authors || ''),
    isbn: data.isbn.trim(),
    publisher: data.publisher.trim(),
    publishedYear: data.publishedYear ? Number(data.publishedYear) : '',
    coverUrl: data.coverUrl.trim(),
    description: data.description.trim(),
    tags: list(data.tags || ''),
    createdAt: editingBook?.id ? findBook(editingBook.id)?.book.createdAt : now(),
    updatedAt: now(),
  };

  updateActive((library) => {
    const withoutCurrent = removeBook(library, book.id);
    return {
      ...withoutCurrent,
      cabinets: withoutCurrent.cabinets.map((cabinet) =>
        cabinet.id === data.cabinetId
          ? { ...cabinet, shelves: cabinet.shelves.map((shelf) => (shelf.id === data.shelfId ? { ...shelf, books: [...shelf.books, book] } : shelf)) }
          : cabinet,
      ),
    };
  });
  editingBook = null;
  scannedIsbn = '';
  lookupVariants = [];
});

async function startScanner() {
  if (!window.isSecureContext) {
    updateScannerStatus('Камера работает только на HTTPS или localhost. Для Android установите PWA с HTTPS-домена.');
    return;
  }
  if (!('BarcodeDetector' in window)) {
    updateScannerStatus('В этом браузере нет BarcodeDetector. Введите ISBN вручную или откройте приложение в Android Chrome.');
    return;
  }
  try {
    stopScanner('Запрашиваем доступ к камере...');
    scannerStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    scannerTrack = scannerStream.getVideoTracks()[0] || null;
    const video = app.querySelector('.scanner-video');
    const button = app.querySelector('[data-action="scan-toggle"]');
    if (button) button.textContent = 'Остановить';
    video.srcObject = scannerStream;
    await video.play();

    const supportedFormats = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : [];
    const preferredFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter((format) => supportedFormats.length === 0 || supportedFormats.includes(format));
    const detector = new BarcodeDetector({ formats: preferredFormats });
    updateScannerStatus('Наведите камеру на ISBN/EAN штрих-код книги.');

    const tick = async () => {
      if (!scannerStream) return;
      try {
        const codes = await detector.detect(video);
        const isbn = normalizeIsbnBarcode(codes[0]?.rawValue);
        if (isbn) {
          scannedIsbn = isbn;
          stopScanner(`Штрих-код найден: ${isbn}`);
          editingBook = { id: null };
          render();
          await lookupIntoCurrentBookForm(isbn);
          return;
        }
        updateScannerStatus('Сканируем... держите штрих-код ровно внутри рамки.');
      } catch {
        updateScannerStatus('Не удалось распознать кадр. Попробуйте улучшить освещение или ввести ISBN вручную.');
      }
      setTimeout(tick, 450);
    };
    tick();
  } catch {
    stopScanner('Не удалось открыть камеру. Проверьте разрешения Android/браузера или введите ISBN вручную.');
  }
}

render();
