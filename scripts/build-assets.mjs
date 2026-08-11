import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDirectory = join(root, 'public');
const outputDirectory = join(root, '.build');
const outputPublicDirectory = join(outputDirectory, 'public');
const nativeCaptureDirectory = join(root, 'native', 'wasapi-capture');
const nativeCaptureOutputDirectory = join(outputDirectory, 'wasapi-capture');
const nativeCaptureSource = join(nativeCaptureDirectory, 'Program.cs');
const nativeCaptureLibrary = join(nativeCaptureDirectory, 'NAudio.dll');
const nativeCaptureNotices = join(nativeCaptureDirectory, 'THIRD-PARTY-NOTICES.md');
const nativeCaptureExecutable = join(nativeCaptureOutputDirectory, 'what-i-listen-wasapi.exe');
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const execFileAsync = promisify(execFile);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputPublicDirectory, { recursive: true });

for (const entry of await readdir(publicDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || extname(entry.name) === '.ts') continue;
  await cp(join(publicDirectory, entry.name), join(outputPublicDirectory, entry.name));
}

await mkdir(nativeCaptureOutputDirectory, { recursive: true });
await execFileAsync(cscPath, [
  '/nologo',
  '/optimize+',
  '/platform:x64',
  '/target:exe',
  `/out:${nativeCaptureExecutable}`,
  `/reference:${nativeCaptureLibrary}`,
  '/reference:System.Web.Extensions.dll',
  nativeCaptureSource,
]);
await cp(nativeCaptureLibrary, join(nativeCaptureOutputDirectory, 'NAudio.dll'));
await cp(nativeCaptureNotices, join(nativeCaptureOutputDirectory, 'THIRD-PARTY-NOTICES.md'));
