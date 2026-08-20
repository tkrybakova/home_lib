function getApiBaseUrl() {
  const configured = globalThis.HOME_LIB_API_URL;
  if (configured) return String(configured).replace(/\/$/, '');
  if (globalThis.location?.hostname === 'localhost' || globalThis.location?.hostname === '127.0.0.1') return 'http://localhost:8787';
  return '';
}

function normalizeResponse(data, cleanIsbn) {
  const cover = data.cover || data.coverUrl || data.image || '';
  return {
    title: data.title || '',
    author: Array.isArray(data.authors) ? data.authors.join(', ') : (data.authors || ''),
    isbn: data.isbn || cleanIsbn,
    description: typeof data.description === 'object' ? (data.description.value || '') : (data.description || ''),
    coverUrl: cover || `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`
  };
}

async function fetchFromLocalApi(cleanIsbn) {
  const API_URL = getApiBaseUrl();
  const response = await fetch(`${API_URL}/book/isbn/${encodeURIComponent(cleanIsbn)}`, { signal: AbortSignal.timeout(5000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return normalizeResponse(await response.json(), cleanIsbn);
}

async function fetchFromOpenLibrary(cleanIsbn) {
  const url = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(cleanIsbn)}&limit=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`Open Library HTTP ${response.status}`);
  const data = await response.json();
  const doc = data.docs?.[0];
  if (!doc) return null;
  const isbn13 = doc.isbn?.find(value => /^97[89]\d{10}$/.test(value));
  const isbn10 = doc.isbn?.find(value => /^\d{9}[\dXx]$/.test(value));
  return {
    title: doc.title || '',
    author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '',
    isbn: isbn13 || isbn10 || cleanIsbn,
    description: '',
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`
  };
}

export async function fetchBookByIsbn(isbn) {
  const cleanIsbn = String(isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!cleanIsbn) throw new Error('Invalid ISBN');

  try {
    const local = await fetchFromLocalApi(cleanIsbn);
    if (local?.title) return local;
  } catch (error) {
    console.warn('[isbn] local resolver unavailable, using Open Library:', error.message);
  }

  try {
    return await fetchFromOpenLibrary(cleanIsbn);
  } catch (error) {
    console.error('[isbn] Open Library lookup failed:', error);
    throw new Error('Не удалось получить данные книги. Проверьте соединение и ISBN.');
  }
}
