import { lib, persist, findRoom } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createRoom } from '../factories.js';
import { showToast } from '../toast.js';

/**
 * Добавление нового помещения в текущую библиотеку.
 */
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