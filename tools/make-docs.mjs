// Generates the animated SVG pictures used in README.md (docs/*.svg) from the app's own live diagram.
// GitHub shows SVG animations (SMIL + CSS) in <img>, but no scripts, so the styles are inlined with
// fixed colours. Run: node tools/make-docs.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDiagram } from '../public/diagram.js';
import { defaultSpec } from '../public/wizard-core.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs');
mkdirSync(OUT, { recursive: true });

// light theme values of the CSS variables the diagram uses
const VARS = { '--bg': '#f6f7f9', '--panel': '#ffffff', '--line': '#d8dde3', '--text': '#1b1f24', '--muted': '#5b6470',
  '--accent': '#0f7f73', '--accent-ink': '#ffffff', '--warn': '#d29922', '--bad': '#f85149', '--ok': '#3fb950', '--mono': 'ui-monospace, Consolas, monospace' };

// every top-level CSS block of styles.css that styles the diagram (.dg*, @keyframes dg-*)
function diagramCss() {
  const css = readFileSync(join(ROOT, 'public', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const prelude = css.slice(i, open).trim();
    if (/\bdg|dg-/.test(prelude) && !/prefers-reduced-motion/.test(prelude) && !/\.dg-(wrap|head|legend|box|note|pill|cap|pm|hint|s2)\b/.test(prelude)) out.push(css.slice(i, j).trim());
    i = j;
  }
  let s = out.join('\n');
  for (let k = 0; k < 5; k++) s = s.replace(/var\((--[\w-]+)\)/g, (_, v) => VARS[v] || '#888');
  return s.replace(/\.dg \{[^}]*\}/, '').replace(/cursor: pointer;?/g, '');
}
const CSS = diagramCss() + '\n.bgc { fill: #ffffff; stroke: #d8dde3; }\n.cap { fill: #0f7f73; font: 600 13px system-ui, "Segoe UI", sans-serif; }';

function standalone(spec, step, sim, label, caption) {
  const html = renderDiagram(spec, 'en', step, sim, label);
  let svg = html.match(/<svg[\s\S]*<\/svg>/)[0];
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const H = Number(h) + 34;
  svg = svg.replace(/<svg class="dg" viewBox="0 0 \d+ \d+"[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/ (data-dg-go|tabindex|role|aria-label)="[^"]*"/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${caption}">
<style>${CSS}</style>
<rect class="bgc" x="0.5" y="0.5" width="${w - 1}" height="${H - 1}" rx="14"/>
<text class="cap" x="18" y="24">${caption}</text>
<g transform="translate(0 30)">${svg}</g>
</svg>
`;
}

const base = (dev = 'rb3011') => {
  const s = defaultSpec(dev);
  s.identity = 'Office'; s.adminPassword = 'x';
  return s;
};
const label = { rb3011: 'RB3011UiAS', 'hap-ac': 'hAP ac2 / ac3', 'lte-builtin': 'hAP ac3 LTE6' };

const scenes = {
  // everything together
  'overview': (() => {
    const s = base('hap-ac');
    s.wan2.enabled = true; s.wan2.type = 'lte';
    s.guest.enabled = true; s.cams.enabled = true; s.wifi.enabled = true; s.wifi.ssid = 'Office';
    s.ports.ether4 = { role: 'cam' }; s.ports.ether5 = { role: 'guest' };
    s.forwards = [{ name: 'nvr', proto: 'tcp', extPort: '8443', ip: '192.168.50.10', intPort: '443' }];
    s.security.geoMode = 'allow'; s.security.geoCountries = 'AZ, TR';
    return [s, 6, { down: false }, label['hap-ac'], 'The whole network on one live picture'];
  })(),
  // second WAN, main line cut: traffic on the backup (LTE)
  'failover': (() => {
    const s = base('rb3011');
    s.wan2.enabled = true; s.wan2.type = 'lte';
    return [s, 1, { down: true }, label.rb3011, 'Failover: the main line is cut, traffic moved to LTE by itself'];
  })(),
  // ports with roles
  'ports': (() => {
    const s = base('rb3011');
    s.guest.enabled = true; s.cams.enabled = true;
    s.ports.ether7 = { role: 'cam' }; s.ports.ether8 = { role: 'cam' }; s.ports.ether9 = { role: 'guest' }; s.ports.ether10 = { role: 'off' }; s.ports.sfp1 = { role: 'off' };
    return [s, 3, { down: false }, label.rb3011, 'Ports: which cable goes where'];
  })(),
  // guest + camera networks + WiFi
  'networks': (() => {
    const s = base('hap-ac');
    s.guest.enabled = true; s.cams.enabled = true; s.wifi.enabled = true; s.wifi.ssid = 'Office';
    s.ports.ether4 = { role: 'cam' }; s.ports.ether5 = { role: 'guest' };
    return [s, 4, { down: false }, label['hap-ac'], 'Guests and cameras in their own networks'];
  })(),
  // protection, port forward and country filter
  'security': (() => {
    const s = base('rb3011');
    s.forwards = [{ name: 'nvr', proto: 'tcp', extPort: '8443', ip: '192.168.88.50', intPort: '443' }];
    s.security.geoMode = 'allow'; s.security.geoCountries = 'AZ';
    return [s, 5, { down: false }, label.rb3011, 'Protection: unwanted connections stop at the shield, the allowed forward gets through'];
  })(),
};

for (const [name, args] of Object.entries(scenes)) {
  const file = join(OUT, `diagram-${name}.svg`);
  writeFileSync(file, standalone(...args));
  console.log(file, readFileSync(file).length, 'bytes');
}
