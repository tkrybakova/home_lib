import { state, persist, lib, ui } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createLibrary } from '../factories.js';

/**
 * Добавление новой библиотеки.
 * Запрашивает название, создаёт библиотеку, делает её активной,
 * переходит на уровень комнат.
 */
export function addLibrary() {
  showModal('edit', {
    title: 'Новая библиотека',
    fields: [
      { key: 'name', label: 'Название библиотеки', type: 'text', placeholder: 'Моя библиотека', required: true }
    ],
    onSave: (data) => {
      const library = createLibrary(data.name);
      state.libraries.push(library);
      state.activeLibraryId = library.id;
      persist();
      // Переход на уровень комнат
      ui.step = 'rooms';
      ui.libraryId = library.id;
      render();
    }
  });
}