import { state, ui, persist, lib } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { now, normalizeIsbn, isValidIsbn } from '../utils.js';
import { showToast } from '../toast.js';

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function findRoomById(roomId) {
  for (const library of state.libraries) {
    const room = (library.rooms || []).find(item => item.id === roomId);
    if (room) return room;
  }
  return null;
}

function findCabinetById(cabinetId) {
  for (const library of state.libraries) {
    for (const room of library.rooms || []) {
      const cabinet = (room.cabinets || []).find(item => item.id === cabinetId);
      if (cabinet) return cabinet;
    }
  }
  return null;
}

function findShelfByIdGlobal(shelfId) {
  for (const library of state.libraries) {
    for (const room of library.rooms || []) {
      for (const cabinet of room.cabinets || []) {
        const shelf = (cabinet.shelves || []).find(item => item.id === shelfId);
        if (shelf) return { cabinet, shelf };
      }
    }
  }
  return null;
}

function findBookByIdGlobal(bookId) {
  for (const library of state.libraries) {
    for (const room of library.rooms || []) {
      for (const cabinet of room.cabinets || []) {
        for (const shelf of cabinet.shelves || []) {
          const book = (shelf.books || []).find(item => item.id === bookId);
          if (book) return { shelf, book };
        }
      }
    }
  }
  return null;
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

  const entityId = entity.id;
  showModal('edit', {
    title,
    fields,
    onSave: (data) => {
      if (type === 'book') {
        const found = findBookByIdGlobal(entityId);
        if (!found) return showToast('Книга больше не существует', 'error');
        const isbn = normalizeIsbn(data.isbn);
        if (isbn && !isValidIsbn(isbn)) return showToast('Некорректный ISBN', 'error');
        found.book.title = String(data.title).trim();
        found.book.author = String(data.author || '').trim();
        found.book.isbn = isbn;
        found.book.description = String(data.description || '').trim();
        found.book.updatedAt = now();
      } else if (type === 'shelf') {
        const found = findShelfByIdGlobal(entityId);
        if (!found) return showToast('Полка больше не существует', 'error');
        const lengthCm = positiveNumber(data.lengthCm, NaN);
        const heightCm = positiveNumber(data.heightCm, NaN);
        const depthCm = positiveNumber(data.depthCm, NaN);
        if (![lengthCm, heightCm, depthCm].every(Number.isFinite)) {
          return showToast('Размеры полки должны быть больше нуля', 'error');
        }
        found.shelf.name = String(data.name).trim();
        found.shelf.lengthCm = lengthCm;
        found.shelf.heightCm = heightCm;
        found.shelf.depthCm = depthCm;
        found.shelf.updatedAt = now();
      } else {
        let current = null;
        if (type === 'library') current = state.libraries.find(item => item.id === entityId);
        if (type === 'room') current = findRoomById(entityId);
        if (type === 'cabinet') current = findCabinetById(entityId);
        if (!current) return showToast('Элемент больше не существует', 'error');
        current.name = String(data.name).trim();
        current.updatedAt = now();
      }
      persist();
      render();
      showToast('Сохранено', 'success');
    }
  });
}

export function deleteEntityWithConfirm(entity, type) {
  const name = entity.name || entity.title || 'элемент';
  const entityId = entity.id;
  showModal('confirm', {
    title: 'Подтверждение удаления',
    message: `Удалить «${name}»?`,
    onConfirm: () => {
      let removed = false;

      if (type === 'library') {
        const idx = state.libraries.findIndex(library => library.id === entityId);
        if (idx !== -1) {
          state.libraries.splice(idx, 1);
          if (state.activeLibraryId === entityId) state.activeLibraryId = null;
          ui.step = 'libraries';
          ui.libraryId = state.activeLibraryId;
          ui.roomId = null;
          ui.cabinetId = null;
          ui.shelfId = null;
          removed = true;
        }
      } else if (type === 'room') {
        for (const library of state.libraries) {
          const idx = (library.rooms || []).findIndex(room => room.id === entityId);
          if (idx !== -1) {
            library.rooms.splice(idx, 1);
            ui.step = 'rooms';
            ui.roomId = null;
            ui.cabinetId = null;
            ui.shelfId = null;
            removed = true;
            break;
          }
        }
      } else if (type === 'cabinet') {
        const room = findRoomByIdForEntity(entityId);
        if (room) {
          const idx = room.cabinets.findIndex(cabinet => cabinet.id === entityId);
          if (idx !== -1) {
            room.cabinets.splice(idx, 1);
            ui.step = 'cabinets';
            ui.cabinetId = null;
            ui.shelfId = null;
            removed = true;
          }
        }
      } else if (type === 'shelf') {
        const found = findShelfByIdGlobal(entityId);
        if (found) {
          const idx = found.cabinet.shelves.findIndex(shelf => shelf.id === entityId);
          if (idx !== -1) {
            found.cabinet.shelves.splice(idx, 1);
            ui.step = 'shelves';
            ui.shelfId = null;
            removed = true;
          }
        }
      } else if (type === 'book') {
        const found = findBookByIdGlobal(entityId);
        if (found) {
          const idx = found.shelf.books.findIndex(book => book.id === entityId);
          if (idx !== -1) {
            found.shelf.books.splice(idx, 1);
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

function findRoomByIdForEntity(entityId) {
  for (const library of state.libraries) {
    const room = (library.rooms || []).find(item => (item.cabinets || []).some(cabinet => cabinet.id === entityId));
    if (room) return room;
  }
  return null;
}
