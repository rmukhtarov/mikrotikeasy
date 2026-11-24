// Where the app reads its own files from: the source tree (node / Docker) or, in the Windows
// single-file build, the assets embedded in the .exe (Node.js single executable application).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let sea = null;
try { const s = process.getBuiltinModule?.('node:sea'); if (s?.isSea()) sea = s; } catch { /* not a single executable */ }
export const IS_EXE = !!sea;

// source tree root (unused inside the .exe, where import.meta.url does not exist)
export const ROOT = IS_EXE ? dirname(process.execPath) : dirname(fileURLToPath(import.meta.url));

// writable folder for .env, settings and the AI mistake memory
// - exe: %LOCALAPPDATA%\MikrotikEasy (the .exe may sit in a read-only folder)
// - otherwise: ./data next to the sources (Docker overrides it with /data)
export const DATA_DIR = IS_EXE ? join(process.env.LOCALAPPDATA || dirname(process.execPath), 'MikrotikEasy') : join(ROOT, 'data');

/** Reads a bundled file by its path relative to the project root (e.g. "public/index.html"). */
export function readAsset(rel, encoding) {
  if (sea) {
    const buf = Buffer.from(sea.getAsset(rel.replace(/\\/g, '/')));
    return encoding ? buf.toString(encoding) : buf;
  }
  return readFileSync(join(ROOT, rel), encoding);
}

export function hasAsset(rel) {
  if (sea) { try { sea.getAsset(rel.replace(/\\/g, '/')); return true; } catch { return false; } }
  return existsSync(join(ROOT, rel));
}
