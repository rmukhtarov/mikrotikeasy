// RouterOS command schema taken from a real device (/console inspect), used to
// (1) give the model an exact reference of menus/properties and (2) validate scripts.
import { readAsset, hasAsset } from './assets.mjs';

export const SCHEMA = hasAsset('data/ros-schema.json') ? JSON.parse(readAsset('data/ros-schema.json', 'utf8')) : null;

const SINGLE = new Set(['protocol', 'chain', 'action', 'vlan-id', 'pvid', 'frame-types']);

// menus always useful, plus keyword -> menus
const CORE = ['/interface list', '/interface list member', '/ip address', '/ip route', '/ip pool', '/ip dhcp-server', '/ip dhcp-server network',
  '/ip dhcp-client', '/ip dns', '/ip firewall filter', '/ip firewall nat', '/ip firewall address-list', '/ip service', '/tool mac-server',
  '/tool mac-server mac-winbox', '/ip neighbor discovery-settings'];
const TOPICS = [
  [/vlan|bridge|trunk|access|switch/i, ['/interface bridge', '/interface bridge port', '/interface bridge vlan', '/interface bridge settings', '/interface vlan']],
  [/wire ?guard|\bwg\b|vpn/i, ['/interface wireguard', '/interface wireguard peers']],
  [/pppoe|bng|ppp\b/i, ['/interface pppoe-client', '/interface pppoe-server server', '/ppp profile', '/ppp secret', '/ppp aaa']],
  [/radius/i, ['/radius', '/radius incoming', '/ppp aaa']],
  [/hotspot|captive|portal/i, ['/ip hotspot', '/ip hotspot profile', '/ip hotspot user', '/ip hotspot user profile', '/ip hotspot walled-garden']],
  [/queue|limit|rate|bandwidth|qos|shap/i, ['/queue simple', '/queue tree', '/queue type']],
  [/ospf/i, ['/routing ospf instance', '/routing ospf area', '/routing ospf interface-template']],
  [/bgp/i, ['/routing bgp connection', '/routing bgp template', '/routing filter rule']],
  [/ipsec|ike/i, ['/ip ipsec peer', '/ip ipsec identity', '/ip ipsec policy', '/ip ipsec profile', '/ip ipsec proposal']],
  [/wi-?fi|wireless|ssid|wlan/i, ['/interface wifi', '/interface wireless']],
  [/lte|4g|5g|sim/i, ['/interface lte']],
  [/failover|backup|dual.?wan|multi.?wan|netwatch/i, ['/tool netwatch', '/ip route', '/routing table', '/routing rule', '/ip firewall mangle']],
  [/mangle|policy rout|pcc|load.?balanc/i, ['/ip firewall mangle', '/routing table', '/routing rule']],
  [/raw|ddos|flood/i, ['/ip firewall raw']],
  [/ipv6/i, ['/ipv6 address', '/ipv6 route', '/ipv6 firewall filter', '/ipv6 settings', '/ipv6 nd', '/ipv6 dhcp-client']],
  [/ntp|time|clock/i, ['/system ntp client', '/system ntp client servers', '/system clock']],
  [/snmp/i, ['/snmp', '/snmp community']],
  [/user|admin|password/i, ['/user', '/user group']],
  [/eoip|gre|vxlan|tunnel/i, ['/interface eoip', '/interface gre', '/interface vxlan']],
  [/vrrp/i, ['/interface vrrp']],
  [/bond|lacp/i, ['/interface bonding']],
  [/log|syslog/i, ['/system logging', '/system logging action']],
  [/schedul|script/i, ['/system scheduler', '/system script']],
];

export function referenceFor(text) {
  if (!SCHEMA) return '';
  const menus = new Set(CORE);
  for (const [re, ms] of TOPICS) if (re.test(text)) ms.forEach((m) => menus.add(m));
  // review mode: every menu that appears in a pasted export
  for (const m of text.matchAll(/^\/[\w -]+$/gm)) { const p = m[0].trim().replace(/\s+/g, ' '); if (SCHEMA.menus[p]) menus.add(p); }
  const lines = [];
  for (const m of menus) {
    const d = SCHEMA.menus[m]; if (!d) continue;
    const cmd = d.add ? 'add' : d.set ? 'set' : null; if (!cmd) continue;
    const args = d[cmd].filter((a) => !['copy-from', 'place-before', 'numbers'].includes(a));
    lines.push(`${m} ${cmd}: ${args.join(' ')}`);
    for (const a of args) {
      const v = SCHEMA.values[`${m} ${cmd} ${a}`];
      if (v && !v.free) lines.push(`  ${a} = ${v.values.join(' | ')}${v.multi ? ' (comma list allowed)' : ''}`);
      else if (SINGLE.has(a)) lines.push(`  ${a}: exactly ONE value per rule`);
    }
  }
  return `\nRouterOS ${SCHEMA.version} command reference (taken from a real device). Use ONLY these menus and property names; anything else does not exist:\n${lines.join('\n')}\n`;
}

const known = (list, name) => list.includes(name) || list.filter((x) => x.startsWith(name)).length === 1;

// Split "key=value key2="quoted value" positional" into tokens, ignoring [ ... ] expressions.
function tokens(rest) {
  const out = []; let i = 0;
  const s = rest.replace(/\[[^\]]*\]/g, '[]');
  const re = /([\w.-]+)=("(?:[^"\\]|\\.)*"|\S*)|("(?:[^"\\]|\\.)*"|\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] ? { key: m[1], val: m[2].replace(/^"|"$/g, '') } : { pos: m[3] });
  return out;
}

// lines: normalized full commands ("/ip firewall filter add chain=input ...")
// properties that exist only on some hardware (schema comes from an RB2011)
const HW_ONLY = { 'hw-offload': ['ccr', 'crs'] };

export function schemaLint(lines, deviceId = 'any') {
  if (!SCHEMA) return [];
  const issues = [];
  const menus = Object.keys(SCHEMA.menus);
  for (const l of lines) {
    const m = l.match(/^(\/[\w -]+?) (add|set)\b(.*)$/);
    if (!m) {
      // menu-only or other command: check the path exists
      const p = (l.match(/^(\/[\w -]+?)(?: (remove|print|enable|disable|export|find)\b|$)/) || [])[1];
      if (p && !resolve(p, menus)) issues.push(`Unknown menu "${p}" in: ${l}`);
      continue;
    }
    const path = resolve(m[1], menus);
    if (!path) {
      // "/interface bridge set bridge1 vlan-filtering=yes" style: set on parent with item name
      issues.push(`Unknown menu "${m[1]}" in: ${l}`); continue;
    }
    const d = SCHEMA.menus[path]; const args = d[m[2]];
    if (!args) { issues.push(`"${m[2]}" is not a command of ${path}: ${l}`); continue; }
    for (const t of tokens(m[3])) {
      if (!t.key) continue;
      if (HW_ONLY[t.key]?.includes(deviceId)) continue;
      if (!known(args, t.key)) { issues.push(`${path} ${m[2]} has no property "${t.key}" (valid: ${args.filter((a) => a !== 'copy-from').slice(0, 40).join(' ')})`); continue; }
      const full = args.includes(t.key) ? t.key : args.find((x) => x.startsWith(t.key));
      const v = SCHEMA.values[`${path} ${m[2]} ${full}`];
      const val = t.val;
      if (!val || /^[$<\[(]/.test(val)) continue;
      if (SINGLE.has(full) && val.includes(',')) issues.push(`${path} ${full}= takes exactly one value, got "${val}": ${l}`);
      if (v && !v.free) for (const x of val.split(',')) {
        const y = x.replace(/^!/, '');
        if (y && !v.values.includes(y)) issues.push(`${path} ${full}="${y}" is not valid (allowed: ${v.values.join(' | ')})`);
      }
    }
  }
  return [...new Set(issues)];
}

// exact menu, or unique-prefix abbreviation per segment (RouterOS accepts "/ip fire filter")
function resolve(p, menus) {
  const norm = p.trim().replace(/\s+/g, ' ');
  if (SCHEMA.menus[norm]) return norm;
  const segs = norm.slice(1).split(' ');
  const cands = menus.filter((x) => { const s = x.slice(1).split(' '); return s.length === segs.length && s.every((v, i) => v.startsWith(segs[i])); });
  return cands.length === 1 ? cands[0] : null;
}
