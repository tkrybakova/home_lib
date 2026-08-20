import { state, lib, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createRoom } from '../factories.js';
import { showToast } from '../toast.js';

export function addRoom() {
  const libraryId = state.activeLibraryId;
  const library = state.libraries.find(item => item.id === libraryId);
  if (!library) return showToast('Сначала создайте библиотеку', 'error');

  showModal('edit', {
    title: 'Новое помещение',
    fields: [
      { key: 'name', label: 'Название помещения', type: 'text', placeholder: 'Гостиная', required: true }
    ],
    onSave: (data) => {
      const targetLibrary = state.libraries.find(item => item.id === libraryId);
      if (!targetLibrary) return showToast('Библиотека больше не существует', 'error');
      targetLibrary.rooms.push(createRoom(data.name));
      persist();
      render();
    }
  });
}
