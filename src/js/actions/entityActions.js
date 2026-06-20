import { state, ui, persist, lib, findRoom, findCabinet } from './state.js';
import { showModal, showToast } from './modal.js';
import { render } from './render.js';
import { now } from './utils.js';

/**
 * Универсальное редактирование сущности (книги, полки, библиотеки, комнаты, шкафа).
 * Отображает модальное окно с полями, соответствующими типу.
 * @param {object} entity – объект сущности
 * @param {string} type   – 'book' | 'shelf' | 'library' | 'room' | 'cabinet'
 */
export function editEntity(entity, type) {
  const fields = [];
  let title = 'Редактировать';

  // Формируем поля в зависимости от типа
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
    // fallback для неизвестного типа
    fields.push({ key: 'name', label: 'Название', type: 'text', value: entity.name || entity.title, required: true });
  }

  showModal('edit', {
    title,
    fields,
    onSave: (data) => {
      // Обновляем свойства сущности
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

/**
 * Удаление сущности с подтверждением.
 * В зависимости от типа корректирует навигацию (ui.step) и удаляет из родительского массива.
 * @param {object} entity – удаляемый объект
 * @param {string} type   – 'library' | 'room' | 'cabinet' | 'shelf' | 'book'
 */
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
          ui.step = 'libraries';
          ui.roomId = null;
          ui.cabinetId = null;
          ui.shelfId = null;
          removed = true;
        }
      } else if (type === 'room') {
        const library = lib();
        if (library) {
          const idx = library.rooms.findIndex(r => r.id === entity.id);
          if (idx !== -1) {
            library.rooms.splice(idx, 1);
            ui.step = 'rooms';
            ui.roomId = null;
            ui.cabinetId = null;
            ui.shelfId = null;
            removed = true;
          }
        }
      } else if (type === 'cabinet') {
        const room = findRoom();
        if (room) {
          const idx = room.cabinets.findIndex(c => c.id === entity.id);
          if (idx !== -1) {
            room.cabinets.splice(idx, 1);
            ui.step = 'cabinets';
            ui.cabinetId = null;
            ui.shelfId = null;
            removed = true;
          }
        }
      } else if (type === 'shelf') {
        const cabinet = findCabinet();
        if (cabinet) {
          const idx = cabinet.shelves.findIndex(s => s.id === entity.id);
          if (idx !== -1) {
            cabinet.shelves.splice(idx, 1);
            ui.step = 'shelves';
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