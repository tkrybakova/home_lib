import { state, ui, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createShelf } from '../factories.js';
import { showToast } from '../toast.js';

function findCabinetById(cabinetId, libraryId, roomId) {
  const library = state.libraries.find(item => item.id === libraryId);
  const room = library?.rooms?.find(item => item.id === roomId);
  return room?.cabinets?.find(item => item.id === cabinetId) || null;
}

export function addShelf() {
  const libraryId = state.activeLibraryId;
  const roomId = ui.roomId;
  const cabinetId = ui.cabinetId;
  const cabinet = findCabinetById(cabinetId, libraryId, roomId);
  if (!cabinetId || !cabinet) return showToast('Сначала выберите шкаф', 'error');

  showModal('edit', {
    title: 'Новая полка',
    fields: [
      { key: 'name', label: 'Название полки', type: 'text', placeholder: 'Верхняя полка', required: true },
      { key: 'lengthCm', label: 'Длина (см)', type: 'number', placeholder: '100', value: '100', required: true },
      { key: 'heightCm', label: 'Высота (см)', type: 'number', placeholder: '30', value: '30', required: true },
      { key: 'depthCm', label: 'Глубина (см)', type: 'number', placeholder: '40', value: '40', required: true }
    ],
    onSave: (data) => {
      const targetCabinet = findCabinetById(cabinetId, libraryId, roomId);
      if (!targetCabinet) {
        showToast('Шкаф больше не существует в выбранном контексте', 'error');
        return false;
      }
      const name = String(data.name || '').trim();
      const values = [Number(data.lengthCm), Number(data.heightCm), Number(data.depthCm)];
      if (!name) {
        showToast('Введите название полки', 'error');
        return false;
      }
      if (!values.every(value => Number.isFinite(value) && value > 0)) {
        showToast('Размеры полки должны быть больше нуля', 'error');
        return false;
      }
      targetCabinet.shelves.push(createShelf(name, ...values));
      persist();
      render();
    }
  });
}
