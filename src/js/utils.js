// Утилиты
export function id(p) {
  return `${p}-${crypto?.randomUUID?.() ?? Date.now()}`;
}

export function now() {
  return new Date().toISOString();
}

export function esc(v = '') {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Генерация визуальных параметров для книги
export function generateBookVisual() {
  const r = Math.random();
  if (r < 0.15) {
    return {
      type: 'horizontal',
      height: 12 + Math.floor(Math.random() * 12),
      width: 40 + Math.floor(Math.random() * 30)
    };
  } else {
    const lean = Math.random() < 0.1 ? (Math.random() < 0.5 ? 'left' : 'right') : null;
    return {
      type: 'upright',
      height: 140 + Math.floor(Math.random() * 120),
      width: 16 + Math.floor(Math.random() * 16),
      lean
    };
  }
}