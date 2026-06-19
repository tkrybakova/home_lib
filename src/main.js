// Ключи для хранения данных в localStorage
const STORAGE_KEY = 'home-lib:libraries';
const ACTIVE_KEY = 'home-lib:active-library';

// Корневой элемент приложения
const app = document.querySelector('#app');

// Загружаем начальное состояние из localStorage
let state = loadState();

// UI состояние
let ui = {
  step: 'libraries',     // libraries → rooms → cabinets → shelves → books
  libraryId: state.activeLibraryId,
  roomId: null,
  cabinetId: null,
  shelfId: null
};

// Состояние модального окна
let modal = {
  isOpen: false,
  type: null,
  data: null,
  onSave: null,
  onClose: null
};

/* ---------- Утилиты ---------- */

function id(p) {
  return `${p}-${crypto?.randomUUID?.() ?? Date.now()}`;
}

function now() {
  return new Date().toISOString();
}

function esc(v = '') {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/* ---------- Фабрики данных ---------- */

function createBook(title = 'Книга', isbn = '', author = '', description = '') {
  return {
    id: id('book'),
    title,
    isbn: isbn || '',
    author: author || '',
    description: description || '',
    createdAt: now(),
    updatedAt: now()
  };
}

// Новая структура полки: без capacity, с height и depth
function createShelf(name = 'Полка', lengthCm = 100, heightCm = 30, depthCm = 40) {
  return {
    id: id('shelf'),
    name,
    lengthCm: Number(lengthCm) || 100,
    heightCm: Number(heightCm) || 30,
    depthCm: Number(depthCm) || 40,
    books: [],
    createdAt: now(),
    updatedAt: now()
  };
}

function createCabinet(name = 'Шкаф') {
  return {
    id: id('cabinet'),
    name,
    shelves: [],
    createdAt: now(),
    updatedAt: now()
  };
}

function createRoom(name = 'Помещение') {
  return {
    id: id('room'),
    name,
    cabinets: [],
    createdAt: now(),
    updatedAt: now()
  };
}

function createLibrary(name = 'Библиотека') {
  return {
    id: id('library'),
    name,
    rooms: [],
    createdAt: now(),
    updatedAt: now()
  };
}

/* ---------- Миграция старых данных ---------- */
function migrateState(state) {
  console.log('🔄 Миграция началась');
  if (!Array.isArray(state.libraries)) state.libraries = [];
  state.libraries = state.libraries.map(lib => {
    lib.rooms = (lib.rooms || []).map(room => {
      room.cabinets = (room.cabinets || []).map(cab => {
        if (cab.books && !cab.shelves) {
          // Старый формат: книги прямо в шкафу → создаём одну полку
          const shelf = createShelf('Основная полка', 100, 30, 40);
          shelf.books = cab.books;
          cab.shelves = [shelf];
          delete cab.books;
        } else if (!cab.shelves) {
          cab.shelves = [createShelf('Основная полка', 100, 30, 40)];
        }
        // Если у полок есть capacity — удаляем
        cab.shelves = cab.shelves.map(s => {
          if (s.capacity !== undefined) {
            delete s.capacity;
          }
          if (s.heightCm === undefined) s.heightCm = 30;
          if (s.depthCm === undefined) s.depthCm = 40;
          return s;
        });
        return cab;
      });
      return room;
    });
    return lib;
  });
  console.log('🔄 Миграция завершена');
  return state;
}

/* ---------- Работа с хранилищем ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    console.log('📂 Читаем из localStorage:', raw);
    const data = JSON.parse(raw || '[]');
    if (!data.length) {
      console.log('📂 Данных нет, возвращаем пустое состояние');
      return { libraries: [], activeLibraryId: null };
    }
    const libs = data;
    const active = localStorage.getItem(ACTIVE_KEY);
    const activeId = libs.find(l => l.id === active)?.id || null;
    const migrated = migrateState({ libraries: libs, activeLibraryId: activeId });
    if (migrated.libraries !== libs) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated.libraries));
      console.log('🔄 Миграция сохранена в localStorage');
    }
    return migrated;
  } catch (e) {
    console.error('❌ Ошибка загрузки состояния:', e);
    return { libraries: [], activeLibraryId: null };
  }
}

function persist() {
  console.log('💾 Сохраняем:', state.libraries);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.libraries));
  if (state.activeLibraryId) {
    localStorage.setItem(ACTIVE_KEY, state.activeLibraryId);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

function lib() {
  return state.libraries.find(l => l.id === state.activeLibraryId) || null;
}

/* ---------- Навигация ---------- */

function go(step, payload = {}) {
  ui = { ...ui, step, ...payload };
  render();
}

/* ---------- Вспомогательные функции ---------- */

function getParentEntity() {
  if (ui.step === 'rooms') return lib();
  if (ui.step === 'cabinets') return findRoom();
  if (ui.step === 'shelves') return findCabinet();
  if (ui.step === 'books') return findShelf();
  return null;
}

function findRoom() {
  const library = lib();
  if (!library) return null;
  return library.rooms?.find(r => r.id === ui.roomId) || null;
}

function findCabinet() {
  const room = findRoom();
  if (!room) return null;
  return room.cabinets?.find(c => c.id === ui.cabinetId) || null;
}

function findShelf() {
  const cabinet = findCabinet();
  if (!cabinet) return null;
  return cabinet.shelves?.find(s => s.id === ui.shelfId) || null;
}

/* ---------- CRUD операции ---------- */

function addLibrary() {
  showModal('edit', {
    title: 'Новая библиотека',
    fields: [
      { key: 'name', label: 'Название библиотеки', type: 'text', placeholder: 'Моя библиотека', required: true }
    ],
    onSave: (data) => {
      const l = createLibrary(data.name);
      state.libraries.push(l);
      state.activeLibraryId = l.id;
      persist();
      go('rooms', { libraryId: l.id });
    }
  });
}

function addRoom() {
  const library = lib();
  if (!library) return showToast('Сначала создайте библиотеку', 'error');
  showModal('edit', {
    title: 'Новое помещение',
    fields: [
      { key: 'name', label: 'Название помещения', type: 'text', placeholder: 'Гостиная', required: true }
    ],
    onSave: (data) => {
      library.rooms.push(createRoom(data.name));
      persist();
      render();
    }
  });
}

function addCabinet() {
  const room = findRoom();
  if (!room) return showToast('Сначала выберите помещение', 'error');
  showModal('edit', {
    title: 'Новый шкаф',
    fields: [
      { key: 'name', label: 'Название шкафа', type: 'text', placeholder: 'Книжный шкаф', required: true }
    ],
    onSave: (data) => {
      room.cabinets.push(createCabinet(data.name));
      persist();
      render();
    }
  });
}

function addShelf() {
  const cabinet = findCabinet();
  if (!cabinet) return showToast('Сначала выберите шкаф', 'error');
  showModal('edit', {
    title: 'Новая полка',
    fields: [
      { key: 'name', label: 'Название полки', type: 'text', placeholder: 'Верхняя полка', required: true },
      { key: 'lengthCm', label: 'Длина (см)', type: 'number', placeholder: '100', value: '100', required: true },
      { key: 'heightCm', label: 'Высота (см)', type: 'number', placeholder: '30', value: '30', required: true },
      { key: 'depthCm', label: 'Глубина (см)', type: 'number', placeholder: '40', value: '40', required: true }
    ],
    onSave: (data) => {
      cabinet.shelves.push(createShelf(data.name, data.lengthCm, data.heightCm, data.depthCm));
      persist();
      render();
    }
  });
}

function addBook() {
  const shelf = findShelf();
  if (!shelf) return showToast('Сначала выберите полку', 'error');
  // Проверка вместимости убрана
  showModal('edit', {
    title: 'Новая книга',
    fields: [
      { key: 'title', label: 'Название книги', type: 'text', placeholder: 'Война и мир', required: true },
      { key: 'author', label: 'Автор', type: 'text', placeholder: 'Лев Толстой' },
      { key: 'isbn', label: 'ISBN (опционально)', type: 'text', placeholder: '978-5-17-123456-7' },
      { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Краткое описание книги...' }
    ],
    onSave: (data) => {
      shelf.books.push(createBook(data.title, data.isbn, data.author, data.description));
      persist();
      render();
    }
  });
}

async function addBookByIsbn() {
  const shelf = findShelf();
  if (!shelf) return showToast('Сначала выберите полку', 'error');
  showModal('add-book-isbn', {
    title: 'Добавить книгу по ISBN',
    fields: [
      { key: 'isbn', label: 'ISBN', type: 'text', placeholder: '978-5-17-123456-7', required: true }
    ],
    onSave: async (data) => {
      const isbn = data.isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
      try {
        const bookData = await fetchBookByIsbn(isbn);
        if (bookData) {
          shelf.books.push(createBook(bookData.title, bookData.isbn, bookData.author, bookData.description));
          persist();
          render();
          showToast(`Книга "${bookData.title}" добавлена!`, 'success');
        } else {
          showModal('edit', {
            title: 'Книга не найдена. Введите данные вручную',
            fields: [
              { key: 'title', label: 'Название книги', type: 'text', placeholder: 'Название', required: true },
              { key: 'author', label: 'Автор', type: 'text', placeholder: 'Автор' },
              { key: 'isbn', label: 'ISBN', type: 'text', value: isbn },
              { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Описание' }
            ],
            onSave: (manualData) => {
              shelf.books.push(createBook(manualData.title, manualData.isbn, manualData.author, manualData.description));
              persist();
              render();
              showToast('Книга добавлена вручную', 'success');
            }
          });
        }
      } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
      }
    }
  });
}

async function fetchBookByIsbn(isbn) {
  const apiUrl = process.env.BOOK_API_URL || 'http://localhost:8787/book/isbn/';
  const response = await fetch(`${apiUrl}${encodeURIComponent(isbn)}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return {
    title: data.title || '',
    author: (data.authors || []).join(', '),
    isbn: data.isbn || isbn,
    description: data.description || ''
  };
}

function editEntity(entity, type) {
  const fields = [];
  let title = 'Редактировать';
  if (type === 'book') {
    title = 'Редактировать книгу';
    fields.push(
      { key: 'title', label: 'Название', type: 'text', value: entity.title, required: true },
      { key: 'author', label: 'Автор', type: 'text', value: entity.author || '' },
      { key: 'isbn', label: 'ISBN', type: 'text', value: entity.isbn || '' },
      { key: 'description', label: 'Описание', type: 'textarea', value: entity.description || '' }
    );
  } else if (type === 'shelf') {
    title = 'Редактировать полку';
    fields.push(
      { key: 'name', label: 'Название', type: 'text', value: entity.name, required: true },
      { key: 'lengthCm', label: 'Длина (см)', type: 'number', value: entity.lengthCm, required: true },
      { key: 'heightCm', label: 'Высота (см)', type: 'number', value: entity.heightCm, required: true },
      { key: 'depthCm', label: 'Глубина (см)', type: 'number', value: entity.depthCm, required: true }
    );
  } else if (type === 'library') {
    title = 'Редактировать библиотеку';
    fields.push({ key: 'name', label: 'Название', type: 'text', value: entity.name, required: true });
  } else if (type === 'room') {
    title = 'Редактировать помещение';
    fields.push({ key: 'name', label: 'Название', type: 'text', value: entity.name, required: true });
  } else if (type === 'cabinet') {
    title = 'Редактировать шкаф';
    fields.push({ key: 'name', label: 'Название', type: 'text', value: entity.name, required: true });
  } else {
    fields.push({ key: 'name', label: 'Название', type: 'text', value: entity.name || entity.title, required: true });
  }
  showModal('edit', {
    title,
    fields,
    onSave: (data) => {
      if (type === 'book') {
        entity.title = data.title;
        entity.author = data.author || '';
        entity.isbn = data.isbn || '';
        entity.description = data.description || '';
      } else if (type === 'shelf') {
        entity.name = data.name;
        entity.lengthCm = Number(data.lengthCm) || 100;
        entity.heightCm = Number(data.heightCm) || 30;
        entity.depthCm = Number(data.depthCm) || 40;
      } else {
        entity.name = data.name;
      }
      entity.updatedAt = now();
      persist();
      render();
      showToast('Сохранено', 'success');
    }
  });
}

function deleteEntityWithConfirm(entity, type) {
  const name = entity.name || entity.title || 'элемент';
  showModal('confirm', {
    title: 'Подтверждение удаления',
    message: `Удалить «${name}»?`,
    onConfirm: () => {
      let removed = false;
      if (type === 'library') {
        const idx = state.libraries.findIndex(l => l.id === entity.id);
        if (idx !== -1) {
          state.libraries.splice(idx, 1);
          if (state.activeLibraryId === entity.id) state.activeLibraryId = null;
          removed = true;
        }
      } else if (type === 'room') {
        const library = lib();
        if (library) {
          const idx = library.rooms.findIndex(r => r.id === entity.id);
          if (idx !== -1) {
            library.rooms.splice(idx, 1);
            ui.roomId = null;
            removed = true;
          }
        }
      } else if (type === 'cabinet') {
        const room = findRoom();
        if (room) {
          const idx = room.cabinets.findIndex(c => c.id === entity.id);
          if (idx !== -1) {
            room.cabinets.splice(idx, 1);
            ui.cabinetId = null;
            removed = true;
          }
        }
      } else if (type === 'shelf') {
        const cabinet = findCabinet();
        if (cabinet) {
          const idx = cabinet.shelves.findIndex(s => s.id === entity.id);
          if (idx !== -1) {
            cabinet.shelves.splice(idx, 1);
            ui.shelfId = null;
            removed = true;
          }
        }
      } else if (type === 'book') {
        const shelf = findShelf();
        if (shelf) {
          const idx = shelf.books.findIndex(b => b.id === entity.id);
          if (idx !== -1) {
            shelf.books.splice(idx, 1);
            removed = true;
          }
        }
      }
      if (removed) {
        persist();
        render();
        showToast('Удалено', 'info');
      }
    }
  });
}

/* ---------- Модальное окно ---------- */

function showModal(type, config) {
  modal = { isOpen: true, type, ...config };
  renderModal();
}

function closeModal() {
  modal.isOpen = false;
  if (modal.onClose) modal.onClose();
  document.querySelector('.modal-overlay')?.remove();
}

function renderModal() {
  document.querySelector('.modal-overlay')?.remove();
  if (!modal.isOpen) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const modalEl = document.createElement('div');
  modalEl.className = 'modal';

  if (modal.type === 'confirm') {
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${modal.title}</h2>
      <p style="margin-bottom:20px;color:var(--text-secondary);">${modal.message || ''}</p>
      <div class="modal-actions">
        <button class="btn-secondary" data-close>Отмена</button>
        <button class="btn-danger" data-confirm>Удалить</button>
      </div>
    `;
  } else if (modal.type === 'edit' || modal.type === 'add-book-isbn') {
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${modal.title}</h2>
      <form data-form>
        ${modal.fields?.map(f => `
          <label for="field-${f.key}">${f.label}${f.required ? ' *' : ''}</label>
          ${f.type === 'textarea' ? `
            <textarea 
              id="field-${f.key}" 
              name="field-${f.key}"
              placeholder="${f.placeholder || ''}" 
              ${f.required ? 'required' : ''}
            >${f.value || ''}</textarea>
          ` : `
            <input 
              id="field-${f.key}" 
              name="field-${f.key}"
              type="${f.type || 'text'}" 
              placeholder="${f.placeholder || ''}" 
              value="${f.value || ''}" 
              ${f.required ? 'required' : ''}
            />
          `}
        `).join('')}
        ${modal.type === 'add-book-isbn' ? `
          <div style="margin-top:8px;padding:12px;background:var(--bg-primary);border-radius:8px;font-size:13px;color:var(--text-secondary);">
            💡 Если книга не будет найдена, вы сможете ввести данные вручную.
          </div>
        ` : ''}
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-close>Отмена</button>
          <button type="submit" class="btn-primary">Сохранить</button>
        </div>
      </form>
    `;
    modalEl.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {};
      modal.fields.forEach(f => {
        data[f.key] = formData.get(`field-${f.key}`) || '';
      });
      if (modal.onSave) {
        try {
          const result = await modal.onSave(data);
          if (result !== false) closeModal();
        } catch (err) {
          showToast('Ошибка: ' + err.message, 'error');
        }
      }
    });
  } else if (modal.type === 'book-details') {
    const book = modal.book;
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${esc(book.title)}</h2>
      <div style="margin:16px 0;">
        ${book.author ? `<p><strong>Автор:</strong> ${esc(book.author)}</p>` : ''}
        ${book.isbn ? `<p><strong>ISBN:</strong> ${esc(book.isbn)}</p>` : ''}
        ${book.description ? `<p><strong>Описание:</strong></p><p style="color:var(--text-secondary);">${esc(book.description)}</p>` : ''}
        <p style="color:var(--text-secondary);font-size:13px;margin-top:12px;">Добавлена: ${formatDate(book.createdAt)}</p>
        ${book.updatedAt !== book.createdAt ? `<p style="color:var(--text-secondary);font-size:13px;">Обновлена: ${formatDate(book.updatedAt)}</p>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" data-close>Закрыть</button>
        <button class="btn-primary" data-action="edit-book" data-id="${book.id}">✏️ Редактировать</button>
      </div>
    `;
  } else {
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${modal.title || 'Ошибка'}</h2>
      <p style="color:var(--text-secondary);">${modal.message || ''}</p>
      <div class="modal-actions">
        <button class="btn-primary" data-close>OK</button>
      </div>
    `;
  }

  overlay.appendChild(modalEl);
  document.body.appendChild(overlay);

  modalEl.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  modalEl.querySelector('[data-confirm]')?.addEventListener('click', () => {
    if (modal.onConfirm) {
      modal.onConfirm();
      closeModal();
    }
  });

  modalEl.querySelector('[data-action="edit-book"]')?.addEventListener('click', () => {
    closeModal();
  });

  setTimeout(() => {
    modalEl.querySelector('input:not([type="hidden"]), textarea')?.focus();
  }, 100);
}

/* ---------- Toast ---------- */

function showToast(message, type = 'info') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--text-primary)'};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.transition = '0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ---------- Рендеринг ---------- */

function render() {
  app.innerHTML = `
    <main>
      <div class="topbar">
        ${ui.step !== 'libraries' ? `<button class="back-btn" data-action="back">← Назад</button>` : ''}
        <h1>${title()}</h1>
        <div class="topbar-actions">
          ${renderContextActions()}
        </div>
      </div>
      ${view()}
    </main>
  `;
}

function renderContextActions() {
  const actions = [];
  const parent = getParentEntity();
  if (parent) {
    let type = '';
    if (ui.step === 'rooms') type = 'library';
    else if (ui.step === 'cabinets') type = 'room';
    else if (ui.step === 'shelves') type = 'cabinet';
    else if (ui.step === 'books') type = 'shelf';
    if (type) {
      actions.push(`
        <button data-action="edit-parent" data-type="${type}">✏️</button>
        <button class="danger" data-action="delete-parent" data-type="${type}">🗑️</button>
      `);
    }
  }
  if (ui.step === 'books') {
    actions.push(`<button data-action="add-book-isbn" style="background:rgba(255,255,255,0.15);">📡 По ISBN</button>
      <button data-action="add-book">➕ Книга</button>`);
  }
  if (ui.step === 'shelves') {
    actions.push(`<button data-action="add-shelf">➕ Полка</button>`);
  }
  if (ui.step === 'rooms' && lib()) actions.push(`<button data-action="add-room">➕ Помещение</button>`);
  if (ui.step === 'cabinets' && findRoom()) actions.push(`<button data-action="add-cabinet">➕ Шкаф</button>`);
  return actions.join('');
}

function title() {
  const map = {
    libraries: 'Мои библиотеки',
    rooms: 'Помещения',
    cabinets: 'Шкафы',
    shelves: 'Полки',
    books: 'Книги'
  };
  return map[ui.step] || '';
}

function view() {
  if (ui.step === 'libraries') return renderLibraries();
  if (ui.step === 'rooms') return renderRooms();
  if (ui.step === 'cabinets') return renderCabinets();
  if (ui.step === 'shelves') return renderShelves();
  if (ui.step === 'books') return renderBooks();
  return '';
}

/* ---------- Представления ---------- */

function renderLibraries() {
  if (!state.libraries.length) {
    return `
      <button class="add-btn" data-action="add-library">📚 Создать первую библиотеку</button>
      <div class="empty-state"><span class="emoji">📚</span><h3>Нет библиотек</h3><p>Начните с создания своей первой библиотеки</p></div>
    `;
  }
  return `
    <button class="add-btn" data-action="add-library">➕ Новая библиотека</button>
    <div class="grid">
      ${state.libraries.map(l => `
        <div class="card">
          <button data-action="open-library" data-id="${l.id}">
            <span class="icon">🏛</span>
            <span class="name">${esc(l.name)}</span>
            <span class="badge">${l.rooms?.length || 0} помещений</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRooms() {
  const library = lib();
  if (!library) return `<div class="empty-state"><p>Библиотека не выбрана</p></div>`;
  const rooms = library.rooms || [];
  if (!rooms.length) {
    return `
      <button class="add-btn" data-action="add-room">➕ Создать первое помещение</button>
      <div class="empty-state"><span class="emoji">🏚️</span><h3>Нет помещений</h3><p>Добавьте помещение в библиотеку «${esc(library.name)}»</p></div>
    `;
  }
  return `
    <button class="add-btn" data-action="add-room">➕ Новое помещение</button>
    <div class="grid">
      ${rooms.map(r => `
        <div class="card">
          <button data-action="open-room" data-id="${r.id}">
            <span class="icon">🚪</span>
            <span class="name">${esc(r.name)}</span>
            <span class="badge">${r.cabinets?.length || 0} шкафов</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCabinets() {
  const room = findRoom();
  if (!room) return `<div class="empty-state"><p>Помещение не выбрано</p></div>`;
  const cabinets = room.cabinets || [];
  if (!cabinets.length) {
    return `
      <button class="add-btn" data-action="add-cabinet">➕ Создать первый шкаф</button>
      <div class="empty-state"><span class="emoji">🗄️</span><h3>Нет шкафов</h3><p>Добавьте шкаф в помещение «${esc(room.name)}»</p></div>
    `;
  }
  return `
    <button class="add-btn" data-action="add-cabinet">➕ Новый шкаф</button>
    <div class="grid">
      ${cabinets.map(c => `
        <div class="card">
          <button data-action="open-cabinet" data-id="${c.id}">
            <span class="icon">🗄</span>
            <span class="name">${esc(c.name)}</span>
            <span class="badge">${c.shelves?.length || 0} полок</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderShelves() {
  const cabinet = findCabinet();
  if (!cabinet) return `<div class="empty-state"><p>Шкаф не выбран</p></div>`;
  const shelves = cabinet.shelves || [];

  // Если полок нет — показываем кнопку добавления
  if (!shelves.length) {
    return `
      <button class="add-btn" data-action="add-shelf">➕ Создать первую полку</button>
      <div class="empty-state"><span class="emoji">📦</span><h3>Нет полок</h3><p>Добавьте полку в шкаф «${esc(cabinet.name)}»</p></div>
    `;
  }

  // Рендерим каждую полку как книжную полку
  return `
    <button class="add-btn" data-action="add-shelf">➕ Новая полка</button>
    ${shelves.map(s => {
      const books = s.books || [];
      return `
        <div class="shelf-container">
          <div class="shelf-header">
            <div>
              <span class="shelf-name">📚 ${esc(s.name)}</span>
              <span class="shelf-meta">
                <span>📏 ${s.lengthCm} см</span>
                <span>📐 ${s.heightCm}×${s.depthCm} см</span>
                <span>📖 ${books.length} книг</span>
              </span>
            </div>
            <div class="shelf-actions">
              <button data-action="open-shelf" data-id="${s.id}">📂 Открыть</button>
              <button data-action="edit-shelf" data-id="${s.id}">✏️</button>
              <button class="danger" data-action="delete-shelf" data-id="${s.id}">🗑️</button>
            </div>
          </div>
          <div class="shelf-books">
            ${books.length ? books.map(b => `
              <div class="book-tile" data-book-id="${b.id}">
                <div class="book-title">${esc(b.title)}</div>
                ${b.author ? `<div class="book-author">${esc(b.author)}</div>` : ''}
                ${b.isbn ? `<div class="book-isbn">${esc(b.isbn)}</div>` : ''}
                <div class="book-actions">
                  <button data-action="edit-book" data-id="${b.id}">✏️</button>
                  <button class="danger" data-action="delete-book" data-id="${b.id}">🗑️</button>
                </div>
              </div>
            `).join('') : `<div class="empty-shelf">📭 На этой полке пока нет книг</div>`}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function renderBooks() {
  const shelf = findShelf();
  if (!shelf) return `<div class="empty-state"><p>Полка не выбрана</p></div>`;
  const books = shelf.books || [];
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
      <button class="add-btn" style="flex:1;min-width:150px;" data-action="add-book">➕ Новая книга</button>
      <button class="add-btn secondary" style="flex:1;min-width:150px;" data-action="add-book-isbn">📡 По ISBN</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px 0;">
      ${books.map(b => `
        <div class="book-tile" data-book-id="${b.id}" style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;cursor:pointer;transition:var(--transition);border-left:4px solid var(--accent);width:160px;min-height:80px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <div style="font-weight:600;font-size:14px;line-height:1.3;word-break:break-word;">${esc(b.title)}</div>
          ${b.author ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${esc(b.author)}</div>` : ''}
          ${b.isbn ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;opacity:0.6;">${esc(b.isbn)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button data-action="edit-book" data-id="${b.id}" style="padding:2px 8px;font-size:11px;border:none;border-radius:4px;background:var(--bg-card);cursor:pointer;">✏️</button>
            <button data-action="delete-book" data-id="${b.id}" style="padding:2px 8px;font-size:11px;border:none;border-radius:4px;background:var(--danger);color:white;cursor:pointer;">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
    ${!books.length ? `<div class="empty-state" style="padding:40px 20px;"><span class="emoji">📖</span><h3>Нет книг</h3><p>Добавьте книгу на полку «${esc(shelf.name)}»</p></div>` : ''}
  `;
}

/* ---------- Обработчики событий ---------- */

app.addEventListener('click', async e => {
  const tile = e.target.closest('.book-tile');
  if (tile && !e.target.closest('button')) {
    const bookId = tile.dataset.bookId;
    // Определяем, на каком уровне мы находимся: на странице полок или книг
    let shelf;
    if (ui.step === 'shelves') {
      // Ищем полку, которой принадлежит книга
      const cabinet = findCabinet();
      if (cabinet) {
        for (const s of cabinet.shelves) {
          const book = s.books.find(b => b.id === bookId);
          if (book) {
            shelf = s;
            break;
          }
        }
      }
    } else if (ui.step === 'books') {
      shelf = findShelf();
    }
    if (shelf) {
      const book = shelf.books.find(b => b.id === bookId);
      if (book) showModal('book-details', { book });
    }
    return;
  }

  const b = e.target.closest('button');
  if (!b) return;

  const { action, id, type } = b.dataset;

  switch (action) {
    case 'back':
      if (ui.step === 'books') return go('shelves');
      if (ui.step === 'shelves') return go('cabinets');
      if (ui.step === 'cabinets') return go('rooms');
      if (ui.step === 'rooms') return go('libraries');
      break;

    case 'add-library': addLibrary(); break;
    case 'add-room': addRoom(); break;
    case 'add-cabinet': addCabinet(); break;
    case 'add-shelf': addShelf(); break;
    case 'add-book': addBook(); break;
    case 'add-book-isbn': addBookByIsbn(); break;

    case 'open-library':
      state.activeLibraryId = id;
      persist();
      go('rooms');
      break;
    case 'open-room': go('cabinets', { roomId: id }); break;
    case 'open-cabinet': go('shelves', { cabinetId: id }); break;
    case 'open-shelf': go('books', { shelfId: id }); break;

    case 'edit-parent': {
      const parent = getParentEntity();
      if (parent) editEntity(parent, type || 'library');
      break;
    }
    case 'delete-parent': {
      const parent = getParentEntity();
      if (parent) deleteEntityWithConfirm(parent, type || 'library');
      break;
    }

    case 'edit-shelf': {
      const cabinet = findCabinet();
      if (cabinet) {
        const shelf = cabinet.shelves.find(s => s.id === id);
        if (shelf) editEntity(shelf, 'shelf');
      }
      break;
    }
    case 'edit-book': {
      // Ищем книгу в зависимости от текущего шага
      let shelf;
      if (ui.step === 'shelves') {
        const cabinet = findCabinet();
        if (cabinet) {
          for (const s of cabinet.shelves) {
            const book = s.books.find(b => b.id === id);
            if (book) { shelf = s; break; }
          }
        }
      } else if (ui.step === 'books') {
        shelf = findShelf();
      }
      if (shelf) {
        const book = shelf.books.find(b => b.id === id);
        if (book) {
          closeModal();
          editEntity(book, 'book');
        }
      }
      break;
    }

    case 'delete-shelf': {
      const cabinet = findCabinet();
      if (cabinet) {
        const shelf = cabinet.shelves.find(s => s.id === id);
        if (shelf) deleteEntityWithConfirm(shelf, 'shelf');
      }
      break;
    }
    case 'delete-book': {
      let shelf;
      if (ui.step === 'shelves') {
        const cabinet = findCabinet();
        if (cabinet) {
          for (const s of cabinet.shelves) {
            const book = s.books.find(b => b.id === id);
            if (book) { shelf = s; break; }
          }
        }
      } else if (ui.step === 'books') {
        shelf = findShelf();
      }
      if (shelf) {
        const book = shelf.books.find(b => b.id === id);
        if (book) deleteEntityWithConfirm(book, 'book');
      }
      break;
    }

    default: break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Инициализация
render();