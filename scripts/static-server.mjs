import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createServer } from 'node:http';

const DEFAULT_PORT = Number(process.env.PORT || process.argv[2] || 5173);
const MAX_PORT_ATTEMPTS = 10;
const root = resolve(process.cwd());

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
  const decodedPath = decodeURIComponent(new URL(url, 'http://localhost').pathname);
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

function handleRequest(request, response) {
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
}

function listen(preferredPort, attempt = 0) {
  const currentPort = preferredPort + attempt;
  const server = createServer(handleRequest);

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      console.warn(`Port ${currentPort} is busy, trying ${currentPort + 1}...`);
      listen(preferredPort, attempt + 1);
      return;
    }

    if (error.code === 'EADDRINUSE') {
      console.error(`Could not start static server. Ports ${preferredPort}-${currentPort} are busy.`);
      console.error('Free one of those ports or run `npm run dev -- <port>`.');
      process.exit(1);
    }

    throw error;
  });

  server.listen(currentPort, '0.0.0.0', () => {
    console.log(`Serving ${root} at http://localhost:${currentPort}/`);
  });
}

listen(DEFAULT_PORT);
