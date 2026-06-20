import { findRoom, esc } from './state.js';

/**
 * Отрисовывает список шкафов в текущем помещении.
 */
export function renderCabinets() {
  const room = findRoom();
  if (!room) return `<div class="empty-state"><p>Помещение не выбрано</p></div>`;

  const cabinets = room.cabinets || [];
  if (!cabinets.length) {
    return `
      <button class="add-btn" data-action="add-cabinet">➕ Создать первый шкаф</button>
      <div class="empty-state"><span class="emoji">🗄️</span><h3>Нет шкафов</h3><p>Добавьте шкаф в помещение «${esc(room.name)}»</p></div>
    `;
  }

  return `
    <button class="add-btn" data-action="add-cabinet">➕ Новый шкаф</button>
    <div class="grid">
      ${cabinets.map(c => `
        <div class="card">
          <button data-action="open-cabinet" data-id="${c.id}">
            <span class="icon">🗄</span>
            <span class="name">${esc(c.name)}</span>
            <span class="badge">${c.shelves?.length || 0} полок</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}