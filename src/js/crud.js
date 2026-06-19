import { state, ui, persist, lib, findRoom, findCabinet, findShelf, findShelfById, getParentEntity } from './state.js';
import { showModal, closeModal } from './modal.js';
import { showToast } from './render.js';
import { createLibrary, createRoom, createCabinet, createShelf, createBook } from './factories.js';
import { fetchBookByIsbn } from './booksApi.js';
import { now } from './utils.js';

// Добавление библиотеки
export function addLibrary() {
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
      // Переход на комнаты
      ui.step = 'rooms';
      ui.libraryId = l.id;
      render();
    }
  });
}

export function addRoom() {
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

export function addCabinet() {
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

export function addShelf() {
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

export function addBook(shelfId) {
  let shelf;
  if (shelfId) {
    shelf = findShelfById(shelfId);
  } else {
    shelf = findShelf();
  }
  if (!shelf) return showToast('Полка не найдена', 'error');
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

export async function addBookByIsbn(shelfId) {
  let shelf;
  if (shelfId) {
    shelf = findShelfById(shelfId);
  } else {
    shelf = findShelf();
  }
  if (!shelf) return showToast('Полка не найдена', 'error');
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

export function editEntity(entity, type) {
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

export function deleteEntityWithConfirm(entity, type) {
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
        const cabinet = findCabinet();
        if (cabinet) {
          for (const shelf of cabinet.shelves) {
            const idx = shelf.books.findIndex(b => b.id === entity.id);
            if (idx !== -1) {
              shelf.books.splice(idx, 1);
              removed = true;
              break;
            }
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

// Импорт render и updateUI для перерисовки
import { render } from './render.js';