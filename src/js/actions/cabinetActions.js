import { findRoom, persist, findCabinet } from './state.js';
import { showModal, showToast } from './modal.js';
import { render } from './render.js';
import { createCabinet } from './factories.js';

/**
 * Добавление нового шкафа в текущее помещение.
 */
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