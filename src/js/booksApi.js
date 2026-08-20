function getApiBaseUrl() {
  const configured = globalThis.HOME_LIB_API_URL;
  if (configured) return String(configured).replace(/\/$/, '');

  // Local development normally serves the static app and API on different ports.
  if (globalThis.location?.hostname === 'localhost' || globalThis.location?.hostname === '127.0.0.1') {
    return 'http://localhost:8787';
  }

  // Production should reverse-proxy the API under the same origin.
  return '';
}

export async function fetchBookByIsbn(isbn) {
  const API_URL = getApiBaseUrl();

  try {
    const cleanIsbn = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();

    if (!cleanIsbn) {
      throw new Error('Invalid ISBN');
    }

    const response = await fetch(
      `${API_URL}/book/isbn/${encodeURIComponent(cleanIsbn)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      title: data.title || '',
      author: Array.isArray(data.authors)
        ? data.authors.join(', ')
        : (data.authors || ''),
      isbn: data.isbn || cleanIsbn,
      description: data.description || ''
    };

  } catch (error) {
    console.error('ISBN fetch error:', error);
    throw error;
  }
}
