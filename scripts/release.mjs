// Prepares a release: bumps the version in package.json (and the lockfile)
// and moves CHANGELOG "Unreleased" notes under the new version and today's date.
// It does not touch git; it prints the commands to run when you're ready.
//
//   npm run release -- patch | minor | major | 1.2.3
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const current = pkg.version;

function next(version, kind) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+$/.test(kind ?? '')) return kind;
  return null;
}

const version = next(current, arg);
if (!version) {
  console.error('Usage: npm run release -- patch | minor | major | <x.y.z>');
  process.exit(1);
}

const changelog = readFileSync('CHANGELOG.md', 'utf8');
const unreleased = /## \[Unreleased\]\n([\s\S]*?)(?=\n## \[|$)/.exec(changelog);
if (!unreleased || !unreleased[1].trim()) {
  console.error('CHANGELOG.md has no notes under "## [Unreleased]". Add them first.');
  process.exit(1);
}
if (changelog.includes(`## [${version}]`)) {
  console.error(`CHANGELOG.md already has a ${version} section.`);
  process.exit(1);
}

if (version !== current) {
  // `npm` is a .cmd shim on Windows, so it runs through a shell. `version` is
  // checked to be x.y.z above, so the command string is safe to build.
  execSync(`npm version ${version} --no-git-tag-version`, { stdio: 'inherit' });
}

// The release date in the maintainer's own time zone, not UTC.
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
writeFileSync(
  'CHANGELOG.md',
  changelog.replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${version}] - ${date}\n`),
);

console.log(`\nPrepared Raster ${version}. Review the changes, then run:\n`);
console.log('  git add -A');
console.log(`  git commit -m "Release v${version}"`);
console.log(`  git tag -a v${version} -m "Raster ${version}"`);
console.log('  git push --follow-tags\n');
