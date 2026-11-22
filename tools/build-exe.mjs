// Builds single-file Windows executables (x64 and x86) with the Node.js "single executable
// application" feature: the app, the web UI and its data are embedded in one .exe.
// Run on Windows with Node.js 22.x:  node tools/build-exe.mjs
// Needs internet once (npx esbuild / postject / rcedit and the official node.exe, checked by SHA-256).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build'), DIST = join(ROOT, 'dist');
const NODE = process.version; // the blob must be made by the same Node version as the target node.exe
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ARCHES = (process.argv[2] || 'x64,x86').split(',');
mkdirSync(BUILD, { recursive: true }); mkdirSync(DIST, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
// build tools, pinned, installed once into build/tools (called directly, no shell, so arguments with spaces stay whole)
const TOOLS = join(BUILD, 'tools'), NM = join(TOOLS, 'node_modules');
if (!existsSync(join(NM, 'postject')) || !existsSync(join(NM, 'rcedit')) || !existsSync(join(NM, 'esbuild'))) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--prefix', TOOLS, 'esbuild@0.24.0', 'rcedit@4.0.1', 'postject@1.0.0-alpha.6'], { stdio: 'inherit', shell: true });
}
const sha256 = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// 1. one CommonJS file (SEA entry points must be CommonJS)
run(process.execPath, [join(NM, 'esbuild', 'bin', 'esbuild'), 'server.mjs', '--bundle', '--platform=node', '--format=cjs', '--target=node22',
  '--log-level=error', `--outfile=${join(BUILD, 'app.cjs')}`]);

// 2. embedded files: everything the server reads through assets.mjs
const assets = {};
const add = (rel) => { assets[rel] = join(ROOT, rel); };
['package.json', 'data/ros-schema.json', 'data/mistakes.json'].forEach(add);
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (!n.startsWith('_')) add(relative(ROOT, p).replace(/\\/g, '/'));
  }
})(join(ROOT, 'public'));

// 3. official node.exe per architecture, verified against nodejs.org SHASUMS256.txt
const sums = await (await fetch(`https://nodejs.org/dist/${NODE}/SHASUMS256.txt`)).text();
for (const arch of ARCHES) {
  const cache = join(BUILD, `node-${NODE}-win-${arch}.exe`);
  const want = (sums.match(new RegExp(`^([0-9a-f]{64})\\s+win-${arch}/node\\.exe$`, 'm')) || [])[1];
  if (!want) throw new Error(`No win-${arch} node.exe for ${NODE}`);
  if (!existsSync(cache) || sha256(cache) !== want) {
    console.log(`Downloading node.exe ${NODE} win-${arch} ...`);
    const r = await fetch(`https://nodejs.org/dist/${NODE}/win-${arch}/node.exe`);
    if (!r.ok) throw new Error(`Download failed: HTTP ${r.status}`);
    writeFileSync(cache, Buffer.from(await r.arrayBuffer()));
    if (sha256(cache) !== want) throw new Error(`Checksum mismatch for win-${arch}/node.exe`);
  }

  // 4. the blob is architecture specific: make it with that architecture's own node.exe
  //    (x86 runs on x64 Windows; a blob from x64 node crashes a 32-bit node.exe)
  const blob = join(BUILD, `app-${arch}.blob`), seaConfig = join(BUILD, `sea-config-${arch}.json`);
  writeFileSync(seaConfig, JSON.stringify({
    main: join(BUILD, 'app.cjs'), output: blob,
    disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, assets,
  }, null, 1));
  run(cache, ['--experimental-sea-config', seaConfig]);

  // 5. icon and version info first, then inject the app blob
  const out = join(DIST, `MikrotikEasy-${version}-win-${arch}.exe`);
  copyFileSync(cache, out);
  run(join(NM, 'rcedit', 'bin', process.arch === 'x64' ? 'rcedit-x64.exe' : 'rcedit.exe'), [out, '--set-icon', join(ROOT, 'tools', 'icon.ico'),
    '--set-version-string', 'ProductName', 'MikrotikEasy', '--set-version-string', 'FileDescription', 'MikrotikEasy - MikroTik RouterOS configurator',
    '--set-version-string', 'CompanyName', 'MikrotikEasy', '--set-version-string', 'LegalCopyright', 'MIT License',
    '--set-version-string', 'OriginalFilename', `MikrotikEasy-${version}-win-${arch}.exe`,
    '--set-file-version', version, '--set-product-version', version]);
  run(process.execPath, [join(NM, 'postject', 'dist', 'cli.js'), out, 'NODE_SEA_BLOB', blob,
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', '--overwrite']);
  console.log(`${out}  ${(statSync(out).size / 1048576).toFixed(1)} MB  sha256 ${sha256(out)}`);
}
