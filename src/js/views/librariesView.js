import { state } from '../state.js';
import { esc } from '../utils.js';

export function renderLibraries() {
  const totalRooms = state.libraries.reduce((sum, library) => sum + (library.rooms?.length || 0), 0);
  if (!state.libraries.length) {
    return `
      <section class="archive-intro empty-intro">
        <div><span class="section-kicker">01 · BEGIN THE ARCHIVE</span><h2>Соберите библиотеку<br>как личное пространство.</h2><p>Создайте первую коллекцию, затем разложите её по помещениям, шкафам и полкам.</p></div>
        <button class="archive-cta" data-action="add-library"><span>+</span> Создать библиотеку</button>
      </section>
      <div class="empty-state archive-empty"><span class="empty-icon">✦</span><h3>Архив пока пуст</h3><p>Первая библиотека станет точкой входа в вашу коллекцию.</p></div>`;
  }

  const libraryNodes = state.libraries.map((l, index) => `
    <article class="collection-card" data-id="${esc(l.id)}">
      <button class="collection-cover" data-action="open-library" data-id="${esc(l.id)}">
        <img src="/library.png" alt="" class="library-image" />
        <span class="collection-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="collection-open">Открыть коллекцию →</span>
      </button>
      <div class="collection-info">
        <div><span class="collection-label">LIBRARY</span><h3>${esc(l.name)}</h3></div>
        <span class="collection-meta">${l.rooms?.length || 0} ${declOfNum(l.rooms?.length || 0, ['комната', 'комнаты', 'комнат'])}</span>
      </div>
    </article>`).join('');

  return `
    <section class="archive-intro">
      <div><span class="section-kicker">PRIVATE COLLECTIONS</span><h2>Ваши библиотеки —<br>разные стороны одного архива.</h2><p>Выберите коллекцию, чтобы перейти от общей истории к конкретному книжному месту.</p></div>
      <div class="archive-summary"><strong>${state.libraries.length}</strong><span>библиотек</span><i></i><strong>${totalRooms}</strong><span>пространств</span></div>
    </section>
    <div class="collections-grid">
      ${libraryNodes}
      <button class="collection-card collection-create" data-action="add-library">
        <span class="create-symbol">+</span><span class="collection-label">NEW ENTRY</span><h3>Новая библиотека</h3><span class="create-note">Добавить отдельную коллекцию</span>
      </button>
    </div>`;
}

function declOfNum(n, forms) {
  const cases = [2, 0, 1, 1, 1, 2];
  return forms[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
}
