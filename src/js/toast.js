/**
 * Показывает временное уведомление (toast).
 * @param {string} message - текст сообщения
 * @param {string} type - тип: 'info', 'success', 'error'
 */
export function showToast(message, type = 'info') {
  // Удаляем предыдущий тост, если есть
  document.querySelector('.toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';

  // Стиль зависит от типа уведомления
  const bgColor = type === 'success' ? 'var(--success)' :
                  type === 'error'   ? 'var(--danger)'  :
                                       'var(--text-primary)';
  toast.style.cssText = `background: ${bgColor};`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Автоматическое скрытие через 3 секунды с анимацией
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.transition = '0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}