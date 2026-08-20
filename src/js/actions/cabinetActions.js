import { state, findRoom, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createCabinet } from '../factories.js';
import { showToast } from '../toast.js';

function findRoomById(roomId) {
  for (const library of state.libraries) {
    const room = (library.rooms || []).find(item => item.id === roomId);
    if (room) return room;
  }
  return null;
}

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
      const targetRoom = findRoomById(roomId);
      if (!targetRoom) return showToast('Помещение больше не существует', 'error');
      targetRoom.cabinets.push(createCabinet(data.name));
      persist();
      render();
    }
  });
}
