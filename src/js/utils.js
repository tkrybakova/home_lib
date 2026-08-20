// Общие утилиты
export function id(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function now() {
  return new Date().toISOString();
}

export function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function normalizeIsbn(value = '') {
  return String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn10(value) {
  const isbn = normalizeIsbn(value);
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const digit = isbn[i] === 'X' ? 10 : Number(isbn[i]);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(value) {
  const isbn = normalizeIsbn(value);
  if (!/^97[89][0-9]{10}$/.test(isbn)) return false;
  const sum = isbn.slice(0, 12).split('').reduce((total, char, index) => {
    return total + Number(char) * (index % 2 === 0 ? 1 : 3);
  }, 0);
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

export function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);
  return isValidIsbn10(isbn) || isValidIsbn13(isbn);
}

export function generateBookVisual() {
  const r = Math.random();
  if (r < 0.15) {
    return {
      type: 'horizontal',
      height: 12 + Math.floor(Math.random() * 12),
      width: 40 + Math.floor(Math.random() * 30)
    };
  }
  const lean = Math.random() < 0.1 ? (Math.random() < 0.5 ? 'left' : 'right') : null;
  return {
    type: 'upright',
    height: 140 + Math.floor(Math.random() * 120),
    width: 16 + Math.floor(Math.random() * 16),
    lean
  };
}
