import { state, ui, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createCabinet } from '../factories.js';
import { showToast } from '../toast.js';

function findRoomById(roomId, libraryId) {
  const library = state.libraries.find(item => item.id === libraryId);
  return library?.rooms?.find(item => item.id === roomId) || null;
}

export function addCabinet() {
  const libraryId = state.activeLibraryId;
  const roomId = ui.roomId;
  const library = state.libraries.find(item => item.id === libraryId);
  const room = library?.rooms?.find(item => item.id === roomId);
  if (!roomId || !room) return showToast('Сначала выберите помещение', 'error');

  showModal('edit', {
    title: 'Новый шкаф',
    fields: [
      { key: 'name', label: 'Название шкафа', type: 'text', placeholder: 'Книжный шкаф', required: true }
    ],
    onSave: (data) => {
      const targetRoom = findRoomById(roomId, libraryId);
      if (!targetRoom) {
        showToast('Помещение больше не существует в выбранной библиотеке', 'error');
        return false;
      }
      const name = String(data.name || '').trim();
      if (!name) {
        showToast('Введите название шкафа', 'error');
        return false;
      }
      targetRoom.cabinets.push(createCabinet(name));
      persist();
      render();
    }
  });
}
