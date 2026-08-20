import { findRoom, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createCabinet } from '../factories.js';
import { showToast } from '../toast.js';

export function addCabinet() {
  const room = findRoom();
  const roomId = room?.id;
  if (!roomId) return showToast('Сначала выберите помещение', 'error');

  showModal('edit', {
    title: 'Новый шкаф',
    fields: [
      { key: 'name', label: 'Название шкафа', type: 'text', placeholder: 'Книжный шкаф', required: true }
    ],
    onSave: (data) => {
      const libraryRoom = findRoomById(roomId);
      if (!libraryRoom) return showToast('Помещение больше не существует', 'error');
      libraryRoom.cabinets.push(createCabinet(data.name));
      persist();
      render();
    }
  });
}

function findRoomById(roomId) {
  const libraryRoom = findRoom();
  if (libraryRoom?.id === roomId) return libraryRoom;
  return null;
}
