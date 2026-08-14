import { readFileSync } from 'node:fs';

const version = process.argv[2]?.replace(/^v/, '');

if (!version) {
  throw new Error('Usage: node scripts/release-notes.mjs <version>');
}

const changelog = readFileSync('CHANGELOG.md', 'utf8');
const lines = changelog.split(/\r?\n/);
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const versionHeading = new RegExp(`^#{1,2} \\[?${escapedVersion}\\]?(?:\\(|\\s|$)`);
const start = lines.findIndex(line => versionHeading.test(line));

if (start === -1) {
  throw new Error(`No changelog entry found for version ${version}.`);
}

const endOffset = lines.slice(start + 1).findIndex(line => /^#{1,2}\s/.test(line));
const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
const releaseNotes = lines.slice(start + 1, end).join('\n').trim();

if (!releaseNotes) {
  throw new Error(`The changelog entry for version ${version} is empty.`);
}

process.stdout.write(`${releaseNotes}\n`);
