import { readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distributionDirectory = join(root, 'dist');

try {
  const entries = await readdir(distributionDirectory, { withFileTypes: true });
  const staleInstallers = entries.filter((entry) => entry.isFile()
    && (entry.name.endsWith('.exe') || entry.name.endsWith('.exe.blockmap')));

  await Promise.all(staleInstallers.map((entry) => rm(join(distributionDirectory, entry.name))));
  if (staleInstallers.length) {
    console.log(`Installateurs précédents supprimés : ${staleInstallers.map((entry) => entry.name).join(', ')}`);
  }
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') process.exit(0);
  throw error;
}
