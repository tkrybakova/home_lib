import { createServer } from 'node:http';
import { BookResolverService } from './resolver.mjs';

const port = Number(process.env.BOOK_RESOLVER_PORT || process.argv[2] || 8787);
const resolver = new BookResolverService();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method !== 'GET') {
      return sendJson(response, 405, { error: 'Method not allowed' });
    }

    if (url.pathname.startsWith('/book/isbn/')) {
      const isbn = decodeURIComponent(url.pathname.slice('/book/isbn/'.length));
      const result = await resolver.resolveByIsbn(isbn);
      return sendJson(response, result.status, result.body);
    }

    if (url.pathname === '/book/search') {
      const result = await resolver.search(url.searchParams.get('q'));
      return sendJson(response, result.status, result.body);
    }

    if (url.pathname === '/health') {
      return sendJson(response, 200, { ok: true, service: 'book-resolver-api' });
    }

    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Book Resolver API listening at http://localhost:${port}`);
});

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(body, null, 2));
}
