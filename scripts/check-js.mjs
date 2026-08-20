import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'data']);
const EXTENSIONS = new Set(['.js', '.mjs']);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) await walk(join(dir, entry.name));
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (EXTENSIONS.has(ext)) files.push(join(dir, entry.name));
  }
}

await walk(ROOT);
files.sort();

const failures = [];
for (const file of files) {
  try {
    await execFileAsync(process.execPath, ['--check', file]);
  } catch (error) {
    failures.push(relative(ROOT, file));
    process.stderr.write(`Syntax error: ${relative(ROOT, file)}\n`);
    if (error.stderr) process.stderr.write(error.stderr);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} JavaScript file(s) failed syntax validation.`);
  process.exit(1);
}

console.log(`Checked ${files.length} JavaScript files: no syntax errors.`);
