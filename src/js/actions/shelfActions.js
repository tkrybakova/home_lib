import { state, findCabinet, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createShelf } from '../factories.js';
import { showToast } from '../toast.js';

function findCabinetById(cabinetId) {
  for (const library of state.libraries) {
    for (const room of library.rooms || []) {
      const cabinet = (room.cabinets || []).find(item => item.id === cabinetId);
      if (cabinet) return cabinet;
    }
  }
  return null;
}

export function addShelf() {
  const cabinet = findCabinet();
  const cabinetId = cabinet?.id;
  if (!cabinetId) return showToast('Сначала выберите шкаф', 'error');

  showModal('edit', {
    title: 'Новая полка',
    fields: [
      { key: 'name', label: 'Название полки', type: 'text', placeholder: 'Верхняя полка', required: true },
      { key: 'lengthCm', label: 'Длина (см)', type: 'number', placeholder: '100', value: '100', required: true },
      { key: 'heightCm', label: 'Высота (см)', type: 'number', placeholder: '30', value: '30', required: true },
      { key: 'depthCm', label: 'Глубина (см)', type: 'number', placeholder: '40', value: '40', required: true }
    ],
    onSave: (data) => {
      const targetCabinet = findCabinetById(cabinetId);
      if (!targetCabinet) return showToast('Шкаф больше не существует', 'error');
      const values = [Number(data.lengthCm), Number(data.heightCm), Number(data.depthCm)];
      if (!values.every(value => Number.isFinite(value) && value > 0)) {
        return showToast('Размеры полки должны быть больше нуля', 'error');
      }
      targetCabinet.shelves.push(createShelf(data.name, ...values));
      persist();
      render();
    }
  });
}
