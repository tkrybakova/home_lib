import { lib } from '../state.js';
import { esc } from '../utils.js';

/**
 * Отрисовывает список помещений текущей библиотеки.
 * Показывает сообщение, если библиотека не выбрана или помещений нет.
 */
export function renderRooms() {
  const library = lib();
  if (!library) return `<div class="empty-state"><p>Библиотека не выбрана</p></div>`;

  const rooms = library.rooms || [];
  if (!rooms.length) {
    return `
      <button class="add-btn" data-action="add-room">➕ Создать первое помещение</button>
      <div class="empty-state"><span class="emoji">🏚️</span><h3>Нет помещений</h3><p>Добавьте помещение в библиотеку «${esc(library.name)}»</p></div>
    `;
  }

  return `
    <button class="add-btn" data-action="add-room">➕ Новое помещение</button>
    <div class="grid">
      ${rooms.map(r => `
        <div class="card">
          <button data-action="open-room" data-id="${r.id}">
            <span class="icon">🚪</span>
            <span class="name">${esc(r.name)}</span>
            <span class="badge">${r.cabinets?.length || 0} шкафов</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}