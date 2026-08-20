import { esc, formatDate } from './utils.js';
import { showToast } from './toast.js';

export let modal = {
  isOpen: false,
  type: null,
  data: null,
  onSave: null,
  onClose: null
};

export function showModal(type, config) {
  modal = { isOpen: true, type, ...config };
  renderModal();
}

export function closeModal() {
  modal.isOpen = false;
  if (modal.onClose) modal.onClose();
  document.querySelector('.modal-overlay')?.remove();
}

export function renderModal() {
  document.querySelector('.modal-overlay')?.remove();
  if (!modal.isOpen) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const modalEl = document.createElement('div');
  modalEl.className = 'modal';

  if (modal.type === 'confirm') {
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${esc(modal.title || '')}</h2>
      <p style="margin-bottom:20px;color:var(--text-secondary);">${esc(modal.message || '')}</p>
      <div class="modal-actions">
        <button class="btn-secondary" data-close>Отмена</button>
        <button class="btn-danger" data-confirm>Удалить</button>
      </div>
    `;
  } else if (modal.type === 'edit' || modal.type === 'add-book-isbn') {
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${esc(modal.title || '')}</h2>
      <form data-form>
        ${modal.fields?.map(f => {
          const key = esc(f.key);
          const label = esc(f.label || '');
          const placeholder = esc(f.placeholder || '');
          const value = esc(f.value || '');
          return `
            <label for="field-${key}">${label}${f.required ? ' *' : ''}</label>
            ${f.type === 'textarea' ? `
              <textarea
                id="field-${key}"
                name="field-${key}"
                placeholder="${placeholder}"
                ${f.required ? 'required' : ''}
              >${value}</textarea>
            ` : `
              <input
                id="field-${key}"
                name="field-${key}"
                type="${esc(f.type || 'text')}"
                placeholder="${placeholder}"
                value="${value}"
                ${f.required ? 'required' : ''}
              />
            `}
          `;
        }).join('')}
        ${modal.type === 'add-book-isbn' ? `
          <div style="margin-top:8px;padding:12px;background:var(--bg-primary);border-radius:8px;font-size:13px;color:var(--text-secondary);">
            💡 Если книга не будет найдена, вы сможете ввести данные вручную.
          </div>
        ` : ''}
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-close>Отмена</button>
          <button type="submit" class="btn-primary">Сохранить</button>
        </div>
      </form>
    `;
    modalEl.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {};
      modal.fields.forEach(f => {
        data[f.key] = formData.get(`field-${f.key}`) || '';
      });
      if (modal.onSave) {
        try {
          const result = await modal.onSave(data);
          if (result !== false) closeModal();
        } catch (err) {
          showToast('Ошибка: ' + err.message, 'error');
        }
      }
    });
  } else if (modal.type === 'book-details') {
    const book = modal.book;
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${esc(book.title)}</h2>
      <div style="margin:16px 0;">
        ${book.author ? `<p><strong>Автор:</strong> ${esc(book.author)}</p>` : ''}
        ${book.isbn ? `<p><strong>ISBN:</strong> ${esc(book.isbn)}</p>` : ''}
        ${book.description ? `<p><strong>Описание:</strong></p><p style="color:var(--text-secondary);">${esc(book.description)}</p>` : ''}
        <p style="color:var(--text-secondary);font-size:13px;margin-top:12px;">Добавлена: ${formatDate(book.createdAt)}</p>
        ${book.updatedAt !== book.createdAt ? `<p style="color:var(--text-secondary);font-size:13px;">Обновлена: ${formatDate(book.updatedAt)}</p>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" data-close>Закрыть</button>
        <button class="btn-primary" data-action="edit-book" data-id="${esc(book.id)}">✏️ Редактировать</button>
      </div>
    `;
  } else {
    modalEl.innerHTML = `
      <button class="close-btn" data-close>×</button>
      <h2>${esc(modal.title || 'Ошибка')}</h2>
      <p style="color:var(--text-secondary);">${esc(modal.message || '')}</p>
      <div class="modal-actions">
        <button class="btn-primary" data-close>OK</button>
      </div>
    `;
  }

  overlay.appendChild(modalEl);
  document.body.appendChild(overlay);

  modalEl.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  modalEl.querySelector('[data-confirm]')?.addEventListener('click', () => {
    if (modal.onConfirm) {
      modal.onConfirm();
      closeModal();
    }
  });

  modalEl.querySelector('[data-action="edit-book"]')?.addEventListener('click', () => {
    const onEdit = modal.onEdit;
    closeModal();
    if (onEdit) onEdit();
  });

  setTimeout(() => {
    modalEl.querySelector('input:not([type="hidden"]), textarea')?.focus();
  }, 100);
}
