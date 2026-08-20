import { state } from '../state.js';
import { esc } from '../utils.js';

export function renderLibraries() {
  if (!state.libraries.length) {
    return `
      <button class="add-btn" data-action="add-library">📚 Создать первую библиотеку</button>
      <div class="empty-state"><span class="emoji">📚</span><h3>Нет библиотек</h3><p>Начните с создания своей первой библиотеки</p></div>
    `;
  }

  const libraryNodes = state.libraries.map(l => `
    <div class="library-node" data-id="${esc(l.id)}">
      <button class="library-card" data-action="open-library" data-id="${esc(l.id)}">
        <div class="library-image-placeholder">
          <img src="/library.png" alt="${esc(l.name)}" class="library-image" />
        </div>
        <div class="library-name">${esc(l.name)}</div>
        <div class="library-badge">${l.rooms?.length || 0} помещений</div>
      </button>
    </div>
  `).join('');

  const newLibraryNode = `
    <div class="library-node new-library">
      <button class="library-card add-card" data-action="add-library">
        <div class="library-image-placeholder add-placeholder">
          <span class="plus-icon">+</span>
        </div>
        <div class="library-name">Новая библиотека</div>
      </button>
    </div>
  `;

  return `
    <div class="schema-container">
      ${libraryNodes}
      ${newLibraryNode}
      <svg class="svg-lines">
        <path class="dashed-line" d="M 250 350 C 380 250, 450 300, 550 190" />
        <path class="dashed-line" d="M 300 450 C 420 550, 500 480, 580 550" />
      </svg>
    </div>
  `;
}
