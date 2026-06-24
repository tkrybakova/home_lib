import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['scripts/static-server.mjs', '5173'], { stdio: 'inherit' }),
  spawn(process.execPath, ['server/api.mjs', '8787'], { stdio: 'inherit' }),
];

function shutdown(signal) {
  for (const child of children) child.kill(signal);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
