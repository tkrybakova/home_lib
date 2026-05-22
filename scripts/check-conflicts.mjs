import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'data']);
const CHECK_EXTENSIONS = new Set(['.js', '.mjs', '.json', '.webmanifest', '.html', '.css', '.md']);
const MARKERS = ['<<<<<<<', '=======', '>>>>>>>'];
const matches = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) await walk(join(dir, entry.name));
      continue;
    }

    const extension = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    if (!CHECK_EXTENSIONS.has(extension)) continue;

    const filePath = join(dir, entry.name);
    const content = await readFile(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (MARKERS.some((marker) => line.startsWith(marker))) {
        matches.push(`${filePath.replace(`${ROOT}/`, '')}:${index + 1}: ${line}`);
      }
    });
  }
}

await walk(ROOT);

if (matches.length > 0) {
  console.error('Found unresolved Git conflict markers. Resolve these files before building:');
  console.error(matches.join('\n'));
  process.exit(1);
}

console.log('No unresolved Git conflict markers found.');
