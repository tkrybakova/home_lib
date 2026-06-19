export async function fetchBookByIsbn(isbn) {
  const API_URL = 'http://localhost:8787/book/isbn/';

  try {
    const cleanIsbn = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();

    if (!cleanIsbn) {
      throw new Error('Invalid ISBN');
    }

    const response = await fetch(
      `${API_URL}${encodeURIComponent(cleanIsbn)}`
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