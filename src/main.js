// main.js
let currentView = 'libraries';

const STORAGE_KEY = 'home-lib:libraries';
const ACTIVE_KEY = 'home-lib:active-library';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('#app not found');
}

let state = loadState();

function id(prefix) {
  if (window.crypto && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function createShelf(order = 0, name = `Полка ${order + 1}`) {
  return {
    id: id('shelf'),
    name,
    order,
    books: [],
  };
}

function createLibrary(name = 'Моя библиотека') {
  const createdAt = now();

  return {
    id: id('library'),
    name,
    createdAt,
    updatedAt: createdAt,
    cabinets: [
      {
        id: id('cabinet'),
        name: 'Главный шкаф',
        location: 'Дом',
        shelves: [createShelf()],
      },
    ],
  };
}

function loadState() {
  try {
    const libraries = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '[]'
    );

    const safeLibraries =
      Array.isArray(libraries) && libraries.length
        ? libraries
        : [createLibrary()];

    const activeId = localStorage.getItem(ACTIVE_KEY);

    return {
      libraries: safeLibraries,
      activeLibraryId:
        safeLibraries.some((l) => l.id === activeId)
          ? activeId
          : safeLibraries[0].id,
    };
  } catch {
    const library = createLibrary();

    return {
      libraries: [library],
      activeLibraryId: library.id,
    };
  }
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state.libraries)
  );

  localStorage.setItem(
    ACTIVE_KEY,
    state.activeLibraryId
  );
}

function activeLibrary() {
  return (
    state.libraries.find(
      (library) => library.id === state.activeLibraryId
    ) || state.libraries[0]
  );
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function render() {
  const library = activeLibrary();

  if (!library) {
    app.innerHTML = `
      <main>
        <section class="panel">
          <h2>Нет библиотек</h2>

          <button
            class="button primary"
            data-action="library-add"
          >
            Создать библиотеку
          </button>
        </section>
      </main>
    `;
    return;
  }

  const cabinets = library.cabinets || [];

  app.innerHTML = `
    <main>

      <header class="hero">
        <div>
          <p class="eyebrow">HOME LIBRARY</p>

          <h1>${escapeHtml(library.name)}</h1>

          <p>
            Управление домашней библиотекой,
            шкафами, полками и книгами.
          </p>
        </div>
      </header>

      ${
        currentView === 'libraries'
          ? renderLibraries()
          : ''
      }

      ${
        currentView === 'shelves'
          ? renderShelves(cabinets)
          : ''
      }

      ${
        currentView === 'books'
          ? renderBooks()
          : ''
      }

    </main>
  `;
}

function renderLibraries() {
  return `
    <section class="panel">

      <div class="section-heading">
        <h2>Библиотеки</h2>

        <button
          class="button primary"
          data-action="library-add"
        >
          + Библиотека
        </button>
      </div>

      <div class="library-list">

        ${state.libraries
          .map(
            (library) => `
              <article class="library-card">

                <button
                  class="library-select"
                  data-action="library-select"
                  data-id="${library.id}"
                >
                  <strong>
                    ${escapeHtml(library.name)}
                  </strong>

                  <small>
                    ${library.cabinets.length} шкафов
                  </small>
                </button>

              </article>
            `
          )
          .join('')}

      </div>

    </section>
  `;
}

function renderShelves(cabinets) {
  return `
    <section class="panel">

      <div class="section-heading">

        <h2>Стеллажи</h2>

        <div class="inline-actions">

          <button
            class="button secondary"
            data-action="back-libraries"
          >
            ← Библиотеки
          </button>

          <button
            class="button primary"
            data-action="cabinet-add"
          >
            + Шкаф
          </button>

        </div>

      </div>

      <div class="cabinet-grid">

        ${cabinets
          .map(
            (cabinet) => `
              <article class="cabinet-card">

                <button
                  class="card-select"
                  data-action="cabinet-select"
                  data-id="${cabinet.id}"
                >
                  <h3>
                    ${escapeHtml(cabinet.name)}
                  </h3>

                  <p class="muted">
                    ${escapeHtml(cabinet.location || '')}
                  </p>
                </button>

                <div class="shelf-list">

                  ${cabinet.shelves
                    .map(
                      (shelf) => `
                        <div class="shelf-row">

                          <button
                            data-action="shelf-open"
                            data-cabinet="${cabinet.id}"
                            data-id="${shelf.id}"
                          >
                            ${escapeHtml(shelf.name)}
                          </button>

                          <small>
                            ${shelf.books.length} книг
                          </small>

                        </div>
                      `
                    )
                    .join('')}

                </div>

              </article>
            `
          )
          .join('')}

      </div>

    </section>
  `;
}

function renderBooks() {
  const library = activeLibrary();

  const cabinet = library.cabinets.find(
    (item) => item.id === selectedCabinetId
  );

  if (!cabinet) {
    return `
      <section class="panel">
        <h2>Шкаф не найден</h2>
      </section>
    `;
  }

  return `
    <section class="panel books-panel">

      <div class="section-heading">

        <h2>
          ${escapeHtml(cabinet.name)}
        </h2>

        <div class="inline-actions">

          <button
            class="button secondary"
            data-action="back-shelves"
          >
            ← Стеллажи
          </button>

          <button
            class="button primary"
            data-action="book-add"
          >
            + Книга
          </button>

        </div>

      </div>

      ${cabinet.shelves
        .map(
          (shelf) => `
            <section class="shelf-block">

              <h3 class="shelf-title">
                ${escapeHtml(shelf.name)}
              </h3>

              <div class="book-list">

                ${
                  shelf.books.length
                    ? shelf.books
                        .map((book) =>
                          renderBook({
                            book,
                            cabinetName: cabinet.name,
                            shelfName: shelf.name,
                            cabinetId: cabinet.id,
                            shelfId: shelf.id,
                          })
                        )
                        .join('')
                    : `
                      <div class="empty-state">
                        Полка пустая
                      </div>
                    `
                }

              </div>

            </section>
          `
        )
        .join('')}

    </section>
  `;
}





app.addEventListener('click', (event) => {
  const button = event.target.closest('button');

  if (!button) return;

  const action = button.dataset.action;
  const itemId = button.dataset.id;

  if (action === 'add-library') {
    const name = prompt(
      'Название библиотеки',
      'Новая библиотека'
    )?.trim();

    if (!name) return;

    const library = createLibrary(name);

    state.libraries.push(library);

    state.activeLibraryId = library.id;

    persist();

    render();
  }

  if (action === 'select-library') {
    state.activeLibraryId = itemId;

    persist();

    render();
  }

  if (action === 'add-cabinet') {
    const name = prompt(
      'Название шкафа',
      'Новый шкаф'
    )?.trim();

    if (!name) return;

    const location = prompt(
      'Где находится шкаф?',
      'Дом'
    )?.trim();

    const library = activeLibrary();

    library.cabinets.push({
      id: id('cabinet'),
      name,
      location,
      shelves: [createShelf()],
    });

    persist();

    render();
  }
});


app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');

  if (!button) return;

  const { action, id: itemId } = button.dataset;

  if (!action) return;

  // выбор библиотеки
  if (action === 'library-select') {
    state.activeLibraryId = itemId;

    const library = activeLibrary();

    selectedCabinetId = library.cabinets?.[0]?.id || '';

    currentView = 'shelves';

    render();
  }

  // выбор шкафа
  if (action === 'cabinet-select') {
    selectedCabinetId = itemId;

    currentView = 'books';

    filters.cabinet = itemId;

    render();
  }

  // назад к библиотекам
  if (action === 'view-libraries') {
    currentView = 'libraries';
    render();
  }

  // назад к шкафам
  if (action === 'view-shelves') {
    currentView = 'shelves';
    render();
  }
});

render();