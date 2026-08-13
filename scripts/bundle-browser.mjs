import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  bundle: true,
  entryPoints: [join(root, 'public', 'overlay.ts')],
  format: 'esm',
  logLevel: 'info',
  minify: true,
  outfile: join(root, '.build', 'public', 'overlay.js'),
  platform: 'browser',
  sourcemap: false,
  target: ['chrome140'],
});

// TypeScript génère une source map avant qu’esbuild ne remplace overlay.js.
// Elle ne correspondrait plus au bundle final et alourdirait l’installateur.
await rm(join(root, '.build', 'public', 'overlay.js.map'), { force: true });
