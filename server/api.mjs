import { createServer } from 'node:http';
import { BookResolverService } from './services/resolver.mjs';

const port = Number(process.argv[2] || process.env.API_PORT || 8787);
const resolver = new BookResolverService();

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  if (url.pathname === '/health') return send(res, 200, { ok: true });
  if (url.pathname.startsWith('/book/isbn/')) {
    const isbn = decodeURIComponent(url.pathname.slice('/book/isbn/'.length));
    const result = await resolver.resolveByIsbn(isbn);
    return send(res, result.status, result.body);
  }
  if (url.pathname === '/book/search') {
    const result = await resolver.search(url.searchParams.get('q'));
    return send(res, result.status, result.body);
  }
  return send(res, 404, { error: 'Not found' });
}).listen(port, () => {
  console.log(`Book Resolver API: http://localhost:${port}`);
});
