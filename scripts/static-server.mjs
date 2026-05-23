import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || process.argv[2] || 5173);
const root = resolve(process.cwd());
const apiPort = Number(process.env.API_PORT || 8787);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function resolveRequestPath(url) {
  const decodedPath = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const safePath = normalize(decodedPath).replace(/^([/\\])+/, '');
  const filePath = resolve(root, safePath || 'index.html');

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return join(filePath, 'index.html');
  }

  return filePath;
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url || '/', `http://localhost:${port}`).pathname;
  if (pathname.startsWith('/book/') || pathname === '/health') {
    proxyToApi(request, response);
    return;
  }

  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
});

function proxyToApi(request, response) {
  const upstream = fetch(`http://127.0.0.1:${apiPort}${request.url || '/'}`, {
    method: request.method || 'GET',
    headers: { Accept: request.headers.accept || 'application/json' },
  });

  upstream
    .then(async (upstreamResponse) => {
      const body = await upstreamResponse.text();
      response.writeHead(upstreamResponse.status, {
        'content-type': upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8',
      });
      response.end(body);
    })
    .catch(() => {
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Book Resolver API is unavailable' }));
    });
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} at http://localhost:${port}/`);
});
