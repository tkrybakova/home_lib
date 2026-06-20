import { state, esc } from './state.js';

/**
 * Отрисовывает список библиотек.
 * Если библиотек нет — показывает приглашение создать первую.
 */
export function renderLibraries() {
  if (!state.libraries.length) {
    return `
      <button class="add-btn" data-action="add-library">📚 Создать первую библиотеку</button>
      <div class="empty-state"><span class="emoji">📚</span><h3>Нет библиотек</h3><p>Начните с создания своей первой библиотеки</p></div>
    `;
  }

  return `
    <button class="add-btn" data-action="add-library">➕ Новая библиотека</button>
    <div class="grid">
      ${state.libraries.map(l => `
        <div class="card">
          <button data-action="open-library" data-id="${l.id}">
            <span class="icon">🏛</span>
            <span class="name">${esc(l.name)}</span>
            <span class="badge">${l.rooms?.length || 0} помещений</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}