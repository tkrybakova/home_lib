import { readFile } from 'node:fs/promises';

const manifestPath = new URL('./manifest.webmanifest', import.meta.url);

try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
  const missingFields = requiredFields.filter((field) => !manifest[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required field(s): ${missingFields.join(', ')}`);
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('Manifest must contain at least one icon.');
  }

  console.log('manifest.webmanifest is valid JSON and contains required PWA fields.');
} catch (error) {
  console.error(`Manifest validation failed: ${error.message}`);
  process.exit(1);
}
