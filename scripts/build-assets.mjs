import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDirectory = join(root, 'public');
const outputDirectory = join(root, '.build');
const outputPublicDirectory = join(outputDirectory, 'public');

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputPublicDirectory, { recursive: true });

for (const entry of await readdir(publicDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || extname(entry.name) === '.ts') continue;
  await cp(join(publicDirectory, entry.name), join(outputPublicDirectory, entry.name));
}
