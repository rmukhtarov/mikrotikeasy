// Build data/ros-schema.json from the raw dumps produced on a RouterOS device
// (see tools/README.md). Usage: node tools/build-schema.mjs schema.txt enums.txt VERSION
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [schemaTxt, enumsTxt, version = 'unknown'] = process.argv.slice(2);
const toPath = (p) => '/' + p.split(',').join(' ');
const menus = {};
for (const line of readFileSync(schemaTxt, 'utf8').split(/\r?\n/)) {
  const [t, p, cmd, args] = line.split('|');
  if (t !== 'C') continue;
  const m = (menus[toPath(p)] ??= { cmds: [] });
  m.cmds.push(cmd);
  if (args?.trim()) m[cmd] = args.trim().split(/\s+/);
}
const values = {};
for (const line of readFileSync(enumsTxt, 'utf8').split(/\r?\n/)) {
  // E|path,cmd,arg|grammar (may itself contain "|")|completions
  if (!line.startsWith('E|')) continue;
  const a = line.indexOf('|', 2), z = line.lastIndexOf('|');
  const q = line.slice(2, a), grammar = z > a ? line.slice(a + 1, z) : '', comp = line.slice(z + 1);
  const parts = q.split(',');
  const arg = parts.pop(), cmd = parts.pop();
  const vals = comp.trim().split(/\s+/).filter((v) => v && v !== '!');
  const g = grammar.replace(/\s*;;\s*$/, '').trim();
  values[`${toPath(parts.join(','))} ${cmd} ${arg}`] = {
    values: vals,
    grammar: g,
    // free = accepts values outside the completion list (names, numbers, addresses...)
    free: !vals.length || vals.every((v) => ['all', 'dynamic', 'none', 'static'].includes(v)) || /string value|integer number|Interface|Address|Port|Time|Range|Prefix|Name=|Num=|Value=|Ip|\.\.\./.test(g.replace(/IpProtocol=[^;]*/, '')),
    multi: /\[,|,\w+\*|,\w+\]|\(max \d+ times\)/.test(g),
  };
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ros-schema.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ version, generated: new Date().toISOString().slice(0, 10), menus, values }));
console.log(`menus ${Object.keys(menus).length}, value specs ${Object.keys(values).length} -> ${out}`);
