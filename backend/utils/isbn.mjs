export function normalizeIsbn(value = '') {
  const cleaned = String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 13 && /^(978|979)\d{10}$/.test(cleaned)) return cleaned;
  if (cleaned.length === 10 && /^\d{9}[0-9X]$/.test(cleaned)) return cleaned;
  return cleaned.length >= 8 ? cleaned : '';
}

export function looksLikeIsbn(value = '') {
  const normalized = normalizeIsbn(value);
  return normalized.length === 10 || normalized.length === 13;
}

export function parseYear(value = '') {
  const year = String(value).match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[0];
  return year ? Number(year) : undefined;
}

export function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    const key = normalized.toLocaleLowerCase('ru-RU');
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}
