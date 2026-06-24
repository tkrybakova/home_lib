import { ui } from './state.js';
import { render } from './renderMain.js';

/**
 * Переход на указанный шаг интерфейса.
 * Сбрасывает дочерние ID и применяет переданные параметры.
 *
 * @param {string} step    – название шага: 'libraries', 'rooms', 'cabinets', 'shelves', 'books'
 * @param {object} payload – дополнительные данные (roomId, cabinetId, shelfId)
 */
export function go(step, payload = {}) {
  // Сброс всех вложенных идентификаторов
  Object.assign(ui, {
    step,
    roomId: null,
    cabinetId: null,
    shelfId: null,
    ...payload     // переданные ID перезаписывают значения по умолчанию
  });

  // Перерисовка интерфейса для отображения нового шага
  render();
}