import { findCabinet, persist, findShelfById, findShelf } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createShelf } from '../factories.js';
import { showToast } from '../toast.js';

/**
 * Добавление новой полки в текущий шкаф.
 */
export function addShelf() {
  const cabinet = findCabinet();
  if (!cabinet) return showToast('Сначала выберите шкаф', 'error');

  showModal('edit', {
    title: 'Новая полка',
    fields: [
      { key: 'name', label: 'Название полки', type: 'text', placeholder: 'Верхняя полка', required: true },
      { key: 'lengthCm', label: 'Длина (см)', type: 'number', placeholder: '100', value: '100', required: true },
      { key: 'heightCm', label: 'Высота (см)', type: 'number', placeholder: '30', value: '30', required: true },
      { key: 'depthCm', label: 'Глубина (см)', type: 'number', placeholder: '40', value: '40', required: true }
    ],
    onSave: (data) => {
      cabinet.shelves.push(createShelf(data.name, data.lengthCm, data.heightCm, data.depthCm));
      persist();
      render();
    }
  });
}