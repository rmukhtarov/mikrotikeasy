// System prompts, device profiles and server-side lint rules.
import { referenceFor, schemaLint, SCHEMA } from './schema.mjs';
// Written for this local tool; device hints describe public MikroTik hardware traits.

export const DEVICES = {
  any: { label: 'Any / unspecified', hint: '' },
  'hex-s': { label: 'hEX / hEX S / RB750Gr3', hint: 'Small desktop router, 5 GbE ports on one switch chip, no wireless. Bridge hw offload works on LAN ports. Modest CPU: keep rule counts reasonable.' },
  'hap-ax': { label: 'hAP ax2 / ax3 / ac2 / ac3', hint: 'SOHO wireless router, 4-5 LAN ports on one switch group, limited CPU. Wireless uses /interface wifi (ax) or /interface wireless (ac).' },
  rb3011: { label: 'RB3011UiAS', hint: 'ARM 10-port router, two switch chips (ether1-5, ether6-10) plus SFP. Hw offload only within the same switch chip.' },
  rb4011: { label: 'RB4011iGS+', hint: 'Strong ARM CPU, 10 GbE ports on two switch chips + SFP+. Suitable for branch/office edge, multiple WANs.' },
  rb5009: { label: 'RB5009UG+S+IN', hint: 'ARM64, 7x GbE + 2.5G + SFP+, single switch chip with offload. Good for small ISP edge and PPPoE.' },
  rb2011: { label: 'RB2011 series', hint: 'Older MIPS router, two switch chips (ether1-5, ether6-10). Limited CPU: prefer fasttrack, avoid heavy L7 rules.' },
  ccr: { label: 'CCR2004 / CCR2116 / CCR2216', hint: 'Cloud Core Router, many cores, no switch-chip bridging on most models (hw=yes has no effect). ISP core, BGP, PPPoE BNG.' },
  crs: { label: 'CRS3xx / CRS5xx', hint: 'Switch first. Use bridge VLAN filtering with hw offload; keep routing/firewall light, the CPU is weak.' },
  'lte-builtin': { label: 'Chateau / LtAP / hAP ac3 LTE6 (built-in LTE)', hint: 'SOHO router with a built-in LTE modem (interface lte1, APN profiles in /interface lte apn). Often used as the only or backup WAN.' },
  chr: { label: 'CHR (virtual)', hint: 'Virtual router, no switch chip. Never use hw=yes. Interfaces are ether1..N (virtio). Licence limits throughput.' },
};

const LANG_NAME = { az: 'Azerbaijani (Latin script)', ru: 'Russian', en: 'English' };

const RULES = `
You are a senior MikroTik network engineer. You write RouterOS __VER__ CLI scripts only.

Hard rules:
__VERRULES__
- Never invent interface names, IPs, subnets, secrets or peers the user did not give. Use clear placeholders like <WAN_IP>, <RADIUS_SECRET>, <PEER_PUBLIC_KEY> and list each in missing_details.
- Every "comment=" value and every "#" comment line in the script MUST be plain ASCII English (RouterOS terminals break on non-ASCII).
- Security baseline unless the user explicitly asks otherwise:
  * interface lists WAN and LAN; input chain: accept established,related,untracked; drop invalid; accept ICMP; accept from LAN (or the management subnet); drop everything else from WAN.
  * forward chain: fasttrack + accept established,related; drop invalid; drop from WAN not dst-nat-ed.
  * /ip service: disable telnet, ftp, www, api, api-ssl (unless asked); restrict winbox/ssh to the management subnet.
  * /tool mac-server and mac-winbox limited to LAN list; /ip neighbor discovery-settings set discover-interface-list=LAN.
  * disable /ip proxy, /ip socks, /ip upnp unless asked; /ip dns set allow-remote-requests only for LAN with an input rule protecting port 53 from WAN.
- Order matters: create every interface (bridge, vlan, wireguard...) BEFORE any line references it (interface list members, addresses, rules).
- One item per "/ip service set": use "/ip service set telnet,ftp,www,api,api-ssl disabled=yes" and separate lines for winbox and ssh. Never put two items on one set line.
- /ip address has no "gateway" property. A static WAN needs "/ip route add dst-address=0.0.0.0/0 gateway=<WAN_GATEWAY>" and a <WAN_PREFIX> placeholder for the mask unless given.
- Forward chain with a final drop MUST have "accept connection-state=established,related,untracked" right after fasttrack, otherwise return traffic is dropped. hw-offload=yes on fasttrack only on devices with L3 hardware offload (CRS3xx/CCR2004/CCR2116), not on RB3011/hEX/RB4011/RB5009.
- Bridge VLAN filtering recipe, in this order: create bridge with vlan-filtering=no; add "/interface bridge port" for every port with pvid=<access vlan> for access ports (frame-types=admit-only-untagged-and-priority-tagged) and trunk ports (frame-types=admit-only-vlan-tagged); add "/interface bridge vlan" entries whose tagged list includes the bridge itself plus the trunk ports; create /interface vlan on the bridge; put the management VLAN interface in the LAN list; only as the very LAST line enable "/interface bridge set <bridge> vlan-filtering=yes".
- With several VLANs, create a separate interface list MGMT (only the management VLAN) and use it for /tool mac-server, mac-winbox, neighbor discovery and the input rule that allows management. Guest/camera/VPN interfaces must never be in MGMT. MAC-Winbox ignores /ip service address limits.
- Fasttrack only with connection-state=established,related. End the forward chain with a drop for anything not explicitly allowed between zones.
- Allow DHCP (udp 67) from every VLAN that has a DHCP server in the input chain before a catch-all drop.
- WireGuard road-warrior peers (phones, laptops, "road warrior", mobile users) have NO endpoint-address/endpoint-port on the router side; only interface, public-key, allowed-address=<ip>/32. Do not add private-key to /interface wireguard: RouterOS generates it.
- On /ip address do not set network= or broadcast=; RouterOS calculates them. Use address=<WAN_IP>/<WAN_PREFIX> only.
- When telling the user to remove the default configuration, always write the full command: /system reset-configuration no-defaults=yes skip-backup=no (without no-defaults the defconf comes back).
- Every interface list used in rules must get members (/interface list member add). PPPoE/DHCP client NAMES are not interfaces: a DHCP client runs on its physical port (use the port in lists/routes), a PPPoE client creates an interface with its name.
- dst-nat (port forward) rules MUST match in-interface-list=WAN or dst-address-type=local, otherwise they hijack LAN traffic to the whole internet. Internet NAT = srcnat masquerade with out-interface-list=WAN (hairpin rules do not replace it).
- Open every listening service you create in the input chain before the drop: WireGuard listen-port (udp), IPv6 DHCP client (udp 546 from fe80::/10 on WAN), etc.
- IPv6 from prefix delegation: /ipv6 dhcp-client add interface=<WAN> request=prefix pool-name=<pool> add-default-route=yes; /ipv6 address add address=::1/64 from-pool=<pool> interface=<LAN> advertise=yes.
- "set" on list menus (anything that also has "add") needs the item: /ipv6 nd set [find interface=bridge1] ... or /interface wifi set [find default-name=wifi1] ...
- Hotspot: server profiles live in /ip hotspot profile, user profiles in /ip hotspot user profile; create profiles before they are referenced. Never walled-garden dst-host=* (it bypasses the login).
- Recursive failover recipe: /ip route add dst-address=<CHECK1>/32 gateway=<GW1> scope=10; /ip route add dst-address=0.0.0.0/0 gateway=<CHECK1> target-scope=11 check-gateway=ping distance=1; same for WAN2 with distance=2. For a DHCP WAN use add-default-route=no and a dhcp-client script that sets the check route gateway to $"gateway-address".
- A pure L2 switch (CRS used as switch, "no routing"): no NAT, no router firewall rules; only bridge, ports, VLAN table, management VLAN interface/IP/route and service hardening.
- When you make a security decision the user did not ask for (e.g. blocking office from cameras), mention it in missing_details as a question instead of silently enforcing it.
- Country (geo-IP) filtering: lists from https://www.iwik.org/ipcountry/mikrotik/<CC> (address-list named by the upper-case country code) loaded by a /system script (/tool fetch + /import) and a daily /system scheduler. Apply them only to new inbound connections (dstnat / port forwards, or a raw drop on WAN for block lists), never so that replies to LAN users are dropped. Warn that /import executes the downloaded file.
- Port scan detection: input rule with psd=21,3s,3,1 connection-state=new in-interface-list=WAN placed after the established accept, adding to an address-list with a timeout, plus a raw prerouting drop of that list.
- Do not add "/system reset-configuration" or anything that wipes the device.
`;

const OUT_SCHEMA = `
Reply with ONE JSON object and nothing else (no markdown fences):
{
  "summary": "string, 2-5 sentences",
  "script": "string, the complete RouterOS v7 script (generate mode) or a corrected/hardened script (review mode, may be empty if nothing to change)",
  "missing_details": ["string", ...],
  "findings": [{"severity":"critical|high|medium|low","title":"string","detail":"string"}],
  "self_check": {"passed": true|false, "issues": ["string", ...]}
}
"findings" is required in review mode (security issues first, then misconfigurations, then performance); in generate mode it may be empty.
Before answering, check your own script against the hard rules and report problems in self_check.issues.
`;

const V7_RULES = `- Output RouterOS v7 syntax (e.g. /interface/bridge/port or "/interface bridge port", /routing, /interface wifi where relevant). Never output v6-only syntax.`;

// RouterOS 6 (6.45+, long-term 6.49.x): what differs from v7
const V6_RULES = `- Output RouterOS v6 syntax for 6.45+ (long-term 6.49.x). Write menus with spaces ("/interface bridge port"), never slash paths like /interface/bridge/port. Never output v7-only features.
- v7-only, do NOT use on v6: /interface wifi (use /interface wireless + /interface wireless security-profiles), /interface wireguard (WireGuard does not exist on v6: use L2TP/IPsec, SSTP or IKEv2 and say so in missing_details), /routing table, /routing filter rule, /routing ospf interface-template, /routing bgp connection, /container, routing-table= on routes.
- Policy routing on v6: /ip firewall mangle action=mark-routing new-routing-mark=<NAME> passthrough=no, then /ip route add ... routing-mark=<NAME>. No /routing table add.
- OSPF on v6: /routing ospf instance set [find default=yes] router-id=<ID>; /routing ospf network add network=<NET> area=backbone. BGP on v6: /routing bgp instance set default as=<AS> router-id=<ID>; /routing bgp peer add name=<N> remote-address=<IP> remote-as=<AS>; filters: /routing filter add chain=<C> prefix=<P> action=accept|discard.
- NTP on v6: /system ntp client set enabled=yes server-dns-names=pool.ntp.org (there is no /system ntp client servers menu).
- On v6 "add" in /ip dhcp-client, /ip dhcp-server and /interface pppoe-client can leave the item disabled: always write disabled=no.
- v6 /ip dhcp-client has no check-gateway: for failover use add-default-route=no and a dhcp-client script that (re)adds a static default route with check-gateway=ping, or the recursive recipe below.
- fasttrack-connection has no hw-offload option on v6.
- IPv6 on v6 is a separate package that must be enabled first (/system package enable ipv6, then reboot); mention it in missing_details.
- Bridge VLAN filtering exists on v6 (6.41+) but is hardware-offloaded only on CRS3xx; on RB/hEX it runs on the CPU. Mention this as a performance note; switch-chip VLANs (/interface ethernet switch vlan) are the fast alternative.`;

const rulesFor = (ros) => RULES.replace('__VER__', ros === '6' ? 'v6' : 'v7').replace('__VERRULES__', ros === '6' ? V6_RULES : V7_RULES);

export function systemPrompt({ mode, lang, deviceId, ros = '7', input = '', mistakes = [] }) {
  // the command reference is dumped from a v7 router: only useful for v7 scripts
  const ref = ros === '6' ? '' : referenceFor(input);
  const past = mistakes.length ? `\nMistakes previous scripts made (do NOT repeat them):\n- ${mistakes.join('\n- ')}\n` : '';
  return basePrompt({ mode, lang, deviceId, ros }) + ref + past;
}

function basePrompt({ mode, lang, deviceId, ros = '7' }) {
  const v = ros === '6' ? 'v6' : 'v7';
  const dev = DEVICES[deviceId] && deviceId !== 'any' ? `\nTarget device: ${DEVICES[deviceId].label}. ${DEVICES[deviceId].hint}\n` : '';
  const task = mode === 'review'
    ? 'Task: the user pastes a RouterOS /export. Audit it. Report findings, then give a script with the fixes to apply (not a full reconfiguration).'
    : `Task: the user describes a network in plain language. Produce a deployable RouterOS ${v} script.`;
  const language = `Write "summary", "missing_details", "findings" and "self_check.issues" in ${LANG_NAME[lang] || 'English'}. The script itself and its comments stay in ASCII English.`;
  return `${rulesFor(ros)}\n${task}\n${dev}\n${language}\n${OUT_SCHEMA.replace('RouterOS v7', `RouterOS ${v}`)}`;
}

export function fixPrompt(issues) {
  return `Your previous script has these problems:\n- ${issues.join('\n- ')}\nFix all of them. Return the same JSON object shape, with self_check describing the corrected script.`;
}

// Deterministic checks run on the server, independent of the model.
export function lint(script, { mode, deviceId, ros }, input = '') {
  const s = script || '';
  const issues = [];
  if (!s.trim()) return mode === 'generate' ? ['Script is empty.'] : [];
  if (deviceId === 'chr' && /hw=yes/.test(s)) issues.push('hw=yes used on CHR (no switch chip).');
  if (s.split(/\r?\n/).some((l) => !l.trim().startsWith('#') && /reset-configuration/.test(l))) issues.push('Script runs reset-configuration (only mention it in a # comment).');
  if (/[^\x00-\x7F]/.test(s)) issues.push('Script contains non-ASCII characters (comments must be ASCII).');
  const L = normalize(s); // full commands, one per entry, menu path always present
  const has = (re) => L.some((l) => re.test(l));
  const idx = (re) => L.findIndex((l) => re.test(l));
  const lastIdx = (re) => L.reduce((a, l, i) => (re.test(l) ? i : a), -1);
  const fw = (chain) => L.filter((l) => /^\/ip firewall filter (add|set)\b/.test(l) && new RegExp(`\\bchain=${chain}\\b`).test(l));

  // pure L2 switch: router-only checks (NAT, router firewall) do not apply
  const l2 = deviceId === 'crs' || /\bL2\b|switch only|коммутатор|маршрутизац\S* не нужна|routing (is )?not needed|no routing|routing olmasın|yalnız switch/i.test(input);
  if (mode === 'generate' && !l2) {
    const input_ = fw('input'), forward = fw('forward');
    if (!input_.length) issues.push('No input-chain firewall rules.');
    else if (!input_.some((l) => /action=drop/.test(l))) issues.push('Input chain has no drop rule.');
    if (!has(/^\/ip service /)) issues.push('/ip service is not hardened.');
    if (/dhcp[ -]?client/i.test(input) && !has(/^\/ip dhcp-client add/)) issues.push('User asked for a DHCP client on WAN but the script has no "/ip dhcp-client add".');
    if (/stati[ck]|статич/i.test(input) && !has(/^\/ip route add\b.*gateway=/)) issues.push('Static WAN but no default route ("/ip route add dst-address=0.0.0.0/0 gateway=<WAN_GATEWAY>").');
    if (forward.some((l) => /action=drop/.test(l) && !/connection-state|src-|dst-|in-interface|out-interface/.test(l))
      && !forward.some((l) => /action=accept/.test(l) && /connection-state=[\w,]*established/.test(l)))
      issues.push('Forward chain ends with a drop but never accepts established,related traffic: return traffic will be dropped.');
  }
  if (/fasttrack-connection[^\n]*hw-offload=yes/.test(s) && !['ccr', 'crs'].includes(deviceId)) issues.push('hw-offload=yes on fasttrack is not supported on this device; remove it.');
  for (const l of L.filter((l) => /^\/ip service set /.test(l))) {
    if ((l.match(/\b(disabled|address|port)=/g) || []).length > 1 && /=\S+ \w[\w-]* (disabled|address|port)=/.test(l)) issues.push(`Invalid syntax, several items in one line: "${l}". Use one item (or a comma list) per set.`);
  }
  if (has(/^\/ip address add\b.*\bgateway=/)) issues.push('"/ip address" has no gateway property; use "/ip route add".');
  if (has(/^\/interface bridge vlan add\b.*\bvid=/)) issues.push('"/interface bridge vlan" has no "vid" property; use "vlan-ids=".');
  if (has(/^\/ip firewall (filter|nat|mangle|raw) (add|set)\b.*\bprotocol=\w+,/)) issues.push('"protocol=" takes one value (e.g. tcp,udp is invalid); write separate rules per protocol.');
  if (has(/^\/ip firewall filter (add|set)\b.*\bfasttrack=/)) issues.push('There is no "fasttrack=" property; use action=fasttrack-connection.');
  const ifLists = L.map((l) => (l.match(/^\/interface list add\b.*\bname=([\w-]+)/) || [])[1]).filter(Boolean);
  for (const l of L.filter((l) => /^\/ip firewall/.test(l))) {
    const al = (l.match(/\b(?:src|dst)-address-list=!?([\w-]+)/) || [])[1];
    if (al && ifLists.includes(al) && !has(new RegExp(`^/ip firewall address-list add\\b.*list=${al}\\b`))) issues.push(`"${al}" is an interface list, not an address list: use in-interface-list=${al} instead of *-address-list.`);
  }
  if (mode === 'generate' && !l2 && ifLists.includes('WAN') && !/no nat|без nat|nat-sız|natsız/i.test(input)
    && !L.some((l) => /^\/ip firewall nat add\b/.test(l) && /\bchain=srcnat\b/.test(l) && /\baction=(masquerade|src-nat)\b/.test(l) && /\bout-interface(-list)?=/.test(l)))
    issues.push('No internet source NAT: add "/ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade" (a hairpin rule is not enough).');
  for (const l of L.filter((l) => /^\/ip firewall nat add\b/.test(l) && /\bchain=dstnat\b/.test(l) && /\baction=(dst-nat|redirect|netmap)\b/.test(l)))
    if (!/\b(in-interface|in-interface-list|dst-address|dst-address-type|dst-address-list)=/.test(l))
      issues.push(`dst-nat rule matches traffic in every direction (no in-interface-list=WAN / dst-address-type=local): it hijacks LAN traffic to the whole internet: ${l}`);
  // interface lists that are used but never get members
  for (const n of ifLists) {
    if (['all', 'none', 'dynamic', 'static'].includes(n)) continue;
    const used = L.some((l) => new RegExp(`-list=!?${n}(\\s|$)`).test(l) && !/^\/interface list/.test(l));
    if (used && !has(new RegExp(`^/interface list member add\\b.*\\blist=${n}\\b`))) issues.push(`Interface list "${n}" is used by rules but has no members ("/interface list member add list=${n} interface=..."): those rules match nothing.`);
  }
  // references to interfaces that do not exist
  const created = new Set(L.map((l) => (l.match(/^\/interface [\w -]+? add\b.*\bname=([\w.-]+)/) || [])[1]).filter(Boolean));
  const physical = /^(ether\d+|sfp\d*|sfp-sfpplus\d+|sfp28-\d+|qsfp\S*|combo\d+|wlan\d+|wifi\d+|lte\d+|lo|all|none|dynamic|static|bridge|defconf)$/;
  const badIf = new Set();
  for (const l of L) {
    if (/^\/interface (ethernet|list) set\b/.test(l)) continue;
    for (const m of l.matchAll(/(?<![\w.-])(interface|in-interface|out-interface|master-interface|datapath\.bridge|bridge|gateway)=("[^"]*"|\S+)/g)) {
      if (m[1] === 'bridge' && !/^\/interface bridge (port|vlan|host|mdb) add/.test(l)) continue;
      for (let v of m[2].replace(/"/g, '').split(',')) {
        v = v.replace(/^!/, '').replace(/%.*$/, '');
        if (!v || /[<$[]/.test(v) || /^[\d.:/]+$/.test(v) || created.has(v) || physical.test(v)) continue;
        badIf.add(`${v}`);
      }
    }
  }
  for (const v of badIf) issues.push(`"${v}" is used as an interface/gateway but no interface with that name exists (a DHCP client or profile name is not an interface).`);
  // WireGuard listen ports must be reachable when the input chain drops traffic
  if (fw('input').some((l) => /action=drop/.test(l))) {
    for (const l of L.filter((l) => /^\/interface wireguard add\b/.test(l))) {
      const port = (l.match(/\blisten-port=(\d+)/) || [])[1];
      if (port && !fw('input').some((r) => /action=accept/.test(r) && /protocol=udp/.test(r) && new RegExp(`dst-port=([\\d,-]*,)?${port}(,|\\s|$)`).test(r)))
        issues.push(`WireGuard listens on UDP ${port} but the input chain never accepts it: tunnels will not come up.`);
    }
  }
  // IPv6
  if (has(/^\/ipv6 dhcp-client add/) && L.some((l) => /^\/ipv6 firewall filter add\b/.test(l) && /chain=input/.test(l) && /action=drop/.test(l))
    && !L.some((l) => /^\/ipv6 firewall filter add\b/.test(l) && /chain=input/.test(l) && /action=accept/.test(l) && /dst-port=([\d,-]*,)?546\b/.test(l)))
    issues.push('IPv6 DHCP client is used but the IPv6 input chain does not accept UDP 546 from WAN: prefix delegation will never arrive.');
  for (const l of L.filter((l) => /^\/ipv6 address add\b/.test(l))) if (!/\baddress=/.test(l)) issues.push(`/ipv6 address add needs address= (e.g. address=::1/64 from-pool=<pool>): ${l}`);
  // "set" on list menus needs an item
  for (const l of L) {
    const m = l.match(/^(\/[\w -]+?) set (.*)$/); if (!m || !SCHEMA?.menus[m[1]]?.add) continue;
    if (/^[\w.-]+=/.test(m[2]) && !/\bnumbers=/.test(m[2])) issues.push(`"set" on a list menu must name the item ([find ...], a name or a number): ${l}`);
  }
  // hotspot
  for (const l of L.filter((l) => /^\/ip hotspot walled-garden add\b/.test(l)))
    if (/dst-host=("\*"|\*|\*\.\*)(\s|$)/.test(l) && !/action=deny/.test(l)) issues.push('Walled-garden accept dst-host=* lets everyone use the internet without logging in.');
  // named objects referenced before / without definition
  const objRefs = [
    [/^\/ip hotspot add\b/, 'profile', /^\/ip hotspot profile add\b/, '/ip hotspot profile'],
    [/^\/ip hotspot user add\b/, 'profile', /^\/ip hotspot user profile add\b/, '/ip hotspot user profile'],
    [/^\/ppp secret add\b/, 'profile', /^\/ppp profile add\b/, '/ppp profile'],
    [/^\/interface pppoe-server server add\b/, 'default-profile', /^\/ppp profile add\b/, '/ppp profile'],
  ];
  for (const [useRe, key, defRe, menu] of objRefs) {
    L.forEach((l, i) => {
      if (!useRe.test(l)) return;
      const name = (l.match(new RegExp(`\\b${key}=("[^"]*"|\\S+)`)) || [])[1]?.replace(/"/g, '');
      if (!name || /^(default|default-encryption|<)/.test(name)) return;
      const d = L.findIndex((x) => defRe.test(x) && new RegExp(`\\bname=("?)${name}\\1(\\s|$)`).test(x));
      if (d < 0) issues.push(`${key}=${name} refers to a ${menu} that is never created (it must be created with "${menu} add name=${name}").`);
      else if (d > i) issues.push(`${key}=${name} is used before "${menu} add name=${name}" creates it.`);
    });
  }
  if (/recursive|рекурсив/i.test(input) && !has(/^\/ip route add\b.*target-scope=/))
    issues.push('Recursive failover was requested but no route uses a check host with target-scope (e.g. host route "dst-address=1.1.1.1/32 gateway=<GW1> scope=10" + "dst-address=0.0.0.0/0 gateway=1.1.1.1 target-scope=11 check-gateway=ping distance=1").');
  if (mode === 'generate' && has(/^\/interface bridge port add\b.*interface=ether/) && !/no-defaults|clean|reset/i.test(s))
    issues.push('Script adds ports to a new bridge but does not mention that the default configuration (defconf bridge with the same ports) must be removed first; add a header comment telling the user to start from /system reset-configuration no-defaults=yes or to remove defconf.');
  if (/road.?warrior|telefon|phone|mobil|laptop|noutbuk|ноутбук|телефон/i.test(input) && has(/^\/interface wireguard peers add\b.*endpoint-address=/))
    issues.push('Road-warrior WireGuard peers must not have endpoint-address/endpoint-port on the router; remove them.');
  if (has(/^\/ip address add\b.*\b(network|broadcast)=</)) issues.push('Do not set network=/broadcast= placeholders on /ip address; RouterOS calculates them.');
  if (/reset-configuration/.test(s) && !/reset-configuration[^\n]*no-defaults=yes/.test(s)) issues.push('The reset-configuration hint must include no-defaults=yes, otherwise the default configuration comes back.');
  if (has(/^\/tool mac-winbox\b/)) issues.push('Wrong menu "/tool mac-winbox"; it is "/tool mac-server mac-winbox".');
  if (fw('forward').some((l) => /fasttrack-connection/.test(l) && !/connection-state=[\w,]*established/.test(l)))
    issues.push('Fasttrack rule has no connection-state=established,related: new connections get fasttracked and can bypass later forward drop rules.');
  if (mode === 'generate' && fw('forward').length && !fw('forward').some((l) => /action=drop/.test(l) && (/connection-nat-state=!dstnat/.test(l) || !/connection-state|src-|dst-|in-interface|out-interface/.test(l))))
    issues.push('Forward chain has no "drop in-interface-list=WAN connection-nat-state=!dstnat connection-state=new" (or final drop): new connections from WAN to internal networks are allowed.');
  if (/00:00:00:00:00:00/.test(s)) issues.push('Placeholder MAC 00:00:00:00:00:00 used; remove the lease or use <MAC> and list it in missing_details.');

  // objects must exist before they are referenced
  for (const m of s.matchAll(/address-pool=([\w-]+)/g)) {
    const def = s.search(new RegExp(`/ip[ /]pool[ /]add[^\\n]*name=${m[1]}\\b`));
    if (def > m.index) issues.push(`Pool "${m[1]}" is used before "/ip pool add" creates it.`);
  }
  const reported = new Set();
  L.forEach((l, i) => {
    const m = l.match(/^\/interface (bridge|vlan|wireguard|bonding|eoip|gre|vrrp|veth) add\b.*\bname=([\w.-]+)/);
    if (!m) return;
    const ref = new RegExp(`\\b(interface|bridge|in-interface|out-interface)=([\\w.,-]*,)?${m[2].replace(/[.-]/g, '\\$&')}(,|\\s|$)`);
    const first = L.findIndex((x, j) => j < i && ref.test(x));
    if (first >= 0 && !reported.has(m[2])) { reported.add(m[2]); issues.push(`Interface "${m[2]}" is referenced before it is created: "${L[first]}".`); }
  });

  // bridge VLAN filtering
  if (/vlan-filtering=yes/.test(s)) {
    const on = idx(/vlan-filtering=yes/);
    if (!has(/^\/interface bridge port add/)) issues.push('vlan-filtering is enabled but no "/interface bridge port add" lines exist: no port is in the bridge.');
    if (on < lastIdx(/^\/interface (bridge (port|vlan)|vlan) add/)) issues.push('vlan-filtering=yes is enabled before ports/VLANs are configured; enable it as the very last step to avoid losing access.');
    for (const v of L.filter((l) => /^\/interface vlan add\b/.test(l))) {
      const br = (v.match(/\binterface=([\w.-]+)/) || [])[1], id = (v.match(/\bvlan-id=(\d+)/) || [])[1];
      if (!br || !id || !has(new RegExp(`^/interface bridge add\\b.*name=${br}\\b`))) continue;
      const covers = (l) => ((l.match(/\bvlan-ids=([\d,-]+)/) || [])[1] || '').split(',').some((r) => { const [a, b = a] = r.split('-').map(Number); return +id >= a && +id <= b; });
      const entry = L.find((l) => /^\/interface bridge vlan add/.test(l) && covers(l));
      if (!entry) { issues.push(`VLAN ${id} has an /interface vlan on "${br}" but no "/interface bridge vlan add bridge=${br} tagged=${br},<trunk ports> vlan-ids=${id}" entry: with vlan-filtering the VLAN carries no traffic.`); continue; }
      if (!entry) continue;
      if (!new RegExp(`tagged=([\\w.,-]*,)?${br}(,|\\s|$)`).test(entry.replace(/untagged=\S+/, '')))
        issues.push(`Bridge "${br}" itself is not tagged for VLAN ${id} in /interface bridge vlan, so the router cannot reach that VLAN.`);
    }
  }
  // a WAN port inside a bridge: the provider network joins the LAN and rules on that port never match
  const wanMembers = L.filter((l) => /^\/interface list member add\b/.test(l) && /\blist=WAN\b/.test(l)).map((l) => (l.match(/\binterface=("?)([\w.-]+)\1/) || [])[2]).filter(Boolean);
  for (const w of wanMembers) if (has(new RegExp(`^/interface bridge port add\\b.*\\binterface=${w.replace(/[.]/g, '\\.')}(\\s|$)`)))
    issues.push(`WAN interface "${w}" is also a bridge port: remove it from the bridge (the ISP network would join the LAN and firewall rules on ${w} never match).`);

  if (ros !== '6') issues.push(...schemaLint(L, deviceId)); // schema is dumped from v7
  else {
    // menus whose properties are the same on v6 and v7: validate them against the v7 schema too
    const STABLE = /^\/(ip (address|pool|dhcp-server( network| lease)?|firewall (filter|nat|mangle|address-list)|service|dns|neighbor discovery-settings)|interface (bridge( port| vlan)?|vlan|list( member)?)|tool mac-server( mac-winbox)?|queue simple|system identity|user)\s+(add|set)\b/;
    issues.push(...schemaLint(L.filter((l) => STABLE.test(l)), deviceId));
    const V7ONLY = [[/^\/interface wifi\b/, '/interface wifi (use /interface wireless)'], [/^\/interface wireguard\b/, '/interface wireguard (WireGuard does not exist on v6)'],
      [/^\/routing table\b/, '/routing table (use routing-mark)'], [/^\/routing filter rule\b/, '/routing filter rule (use /routing filter add chain=...)'],
      [/^\/routing ospf interface-template\b/, '/routing ospf interface-template (use /routing ospf network)'], [/^\/routing bgp connection\b/, '/routing bgp connection (use /routing bgp peer)'],
      [/^\/container\b/, '/container'], [/^\/system ntp client servers\b/, '/system ntp client servers (use server-dns-names=)'], [/\brouting-table=/, 'routing-table= (use routing-mark=)']];
    for (const [re, what] of V7ONLY) if (has(re)) issues.push(`RouterOS v6 script uses v7-only ${what}.`);
    if (/^\s*\/[a-z-]+\/[a-z]/m.test(s)) issues.push('RouterOS v6 does not accept slash menu paths like /interface/bridge: write "/interface bridge".');
    if (has(/^\/ip firewall filter add\b.*hw-offload=/)) issues.push('hw-offload= on fasttrack does not exist on RouterOS v6.');
  }
  return [...new Set(issues)];
}

// Turn a script into full commands: expands "/menu" header blocks, joins "\" continuations, drops comments.
export function normalize(script) {
  const out = []; let menu = '';
  const lines = script.replace(/\\\r?\n\s*/g, '').split(/\r?\n/);
  for (let raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    if (l.startsWith(':')) {
      // scripting line (:if/:foreach/:do): lint the commands inside do={ ... } as normal commands
      const body = (l.match(/do=\{([\s\S]*)\}/) || [])[1] || '';
      for (const c of body.split(/;\s*(?=\/)/)) if (c.trim().startsWith('/')) out.push(...normalize(c.trim().replace(/;\s*$/, '')));
      continue;
    }
    if (l.startsWith('/')) {
      const m = l.match(/^(\/[\w-]+(?:[ /][\w-]+)*?)(?:\s+(add|set|remove|print|enable|disable|export)\b(.*))?$/);
      const path = (m ? m[1] : l).replace(/\//g, ' ').trim().replace(/^/, '/');
      if (m && m[2]) out.push(`${path} ${m[2]}${m[3]}`.trim()); else menu = path;
      if (m && m[2]) menu = path;
    } else if (menu) out.push(`${menu} ${l}`);
  }
  return out;
}

// Deterministic, safe repairs applied before linting (no model round-trip needed):
// - transliterate non-ASCII text in "#" comments and comment="..." values
// - drop comment= from commands whose menu has no comment property (e.g. /ip service set)
const TR = { ə: 'e', Ə: 'E', ı: 'i', İ: 'I', ş: 'sh', Ş: 'Sh', ç: 'ch', Ç: 'Ch', ğ: 'g', Ğ: 'G', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  '—': '-', '–': '-', '«': '"', '»': '"', '“': '"', '”': '"', '’': "'", '→': '->', '…': '...' };
const translit = (t) => t.replace(/[^\x00-\x7F]/g, (c) => TR[c] ?? TR[c.toLowerCase()]?.toUpperCase() ?? '');

export function sanitize(script) {
  const fixes = new Set(); let menu = '';
  const out = String(script || '').split(/\r?\n/).map((raw) => {
    let line = raw;
    const t = line.trim();
    if (t.startsWith('#')) { if (/[^\x00-\x7F]/.test(line)) { fixes.add('Transliterated non-ASCII comment lines.'); line = translit(line); } return line; }
    if (/comment="[^"]*[^\x00-\x7F]/.test(line)) { fixes.add('Transliterated non-ASCII comment= values.'); line = line.replace(/comment="([^"]*)"/g, (m, v) => `comment="${translit(v)}"`); }
    // which menu/command is this line?
    let path = menu, cmd = '';
    const m = t.match(/^(\/[\w-]+(?:[ /][\w-]+)*?)(?:\s+(add|set)\b|$)/);
    if (t.startsWith('/')) { if (m) { path = m[1].replace(/\//g, ' ').trim().replace(/^/, '/'); cmd = m[2] || ''; if (!cmd) menu = path; } }
    else cmd = (t.match(/^(add|set)\b/) || [])[1] || '';
    const args = cmd && SCHEMA?.menus[path]?.[cmd];
    if (args && !args.includes('comment') && /\scomment=/.test(line)) {
      line = line.replace(/\s+comment=("(?:[^"\\]|\\.)*"|\S+)/g, '');
      fixes.add(`Removed comment= where ${path} ${cmd} has no comment property.`);
    }
    return line;
  });
  return { script: out.join('\n'), fixes: [...fixes] };
}
