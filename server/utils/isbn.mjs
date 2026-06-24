export function normalizeIsbn(value = '') {
  return String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function looksLikeIsbn(value = '') {
  const isbn = normalizeIsbn(value);
  return isbn.length === 10 || isbn.length === 13;
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
