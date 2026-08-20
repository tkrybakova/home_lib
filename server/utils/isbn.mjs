export function normalizeIsbn(value = '') {
  return String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn10(value = '') {
  const isbn = normalizeIsbn(value);
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const digit = isbn[i] === 'X' ? 10 : Number(isbn[i]);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(value = '') {
  const isbn = normalizeIsbn(value);
  if (!/^\d{13}$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function looksLikeIsbn(value = '') {
  const isbn = normalizeIsbn(value);
  return isValidIsbn10(isbn) || isValidIsbn13(isbn);
}

export function parseYear(value = '') {
  const match = String(value).match(/(?:18|19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

export function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values.flat().filter(Boolean)) {
    const text = String(value).trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase('ru-RU');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}
