import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['backend/api/server.mjs', process.env.BOOK_RESOLVER_PORT || '8787'], { stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/static-server.mjs', process.env.PORT || '5173'], { stdio: 'inherit' }),
];

function shutdown(code = 0) {
  for (const child of processes) child.kill('SIGTERM');
  process.exit(code);
}

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) shutdown(code);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
