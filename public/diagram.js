// Live, animated picture of what the Master is about to configure.
// Plain words next to every element, so nobody has to know what a router symbol means.
import { DEVICE_PORTS, geoList } from './wizard-core.js';

const DG = {
  az: {
    title: 'Nə quracağıq', internet: 'İnternet', isp: (n) => `Provayder ${n}`, cable: 'kabel', login: 'login/parol ilə', sim: 'mobil internet (SIM)',
    router: 'MikroTik', home: 'Evdəki / ofisdəki cihazlar', pc: 'Kompüter', phone: 'Telefon', tv: 'Televizor', cam: 'Kamera / server',
    guests: 'Qonaqlar', guestPhone: 'Qonaq telefonu', wall: 'Qonaqlar sizin cihazları görmür',
    shield: 'Qoruma', blocked: 'Kənardan gələn istənməyən girişlər bloklanır', fwd: (p) => `Xaricdən icazəli giriş: port ${p}`,
    only: 'yalnız', block: 'bloklanır', active: 'işləyir', standby: 'ehtiyatda gözləyir', down: 'kəsildi', both: 'birlikdə',
    simDown: 'Əsas xətti "kəs" və nəticəyə bax', simUp: 'Xətti bərpa et', simNote: 'Trafik özü ehtiyat xəttə keçdi',
    limit: (n) => `${n} cihaz/qrupda sürət limiti`, wifi: 'WiFi', cams: 'Kameralar', off: 'söndürülüb (port bağlı)', pmTitle: 'Port xəritəsi: hansı kabel hara', clickGo: 'klikləyin, bu addım açılsın', clickHint: 'Sxemdəki istənilən hissəyə və ya nömrəyə klikləyin: uyğun addım açılır.', roleLan: 'daxili şəbəkə', roleGuest: 'qonaq şəbəkəsi', roleCam: 'kamera şəbəkəsi', camGroup: 'Kameralar', camNote: 'Kameralar LAN-a çıxa bilmir', camInetOn: 'internet var', camInetOff: 'internet yox (yalnız saat)',
    focus: ['Router: model və ad', 'İnternet: provayder/lər və qoşulma', 'Daxili şəbəkə: ünvanlar və cihazlar', 'Portlar: kabel qoşulmaları', 'WiFi, qonaq və kamera şəbəkələri', 'Qoruma, xaricdən giriş və limitlər', 'Hamısı birlikdə'],
    legend: ['Sizin internet trafiki', 'Bloklanan kənar girişlər', 'İcazə verdiyiniz xaricdən giriş'],
    remote: 'Uzaqdan cihazlar', remoteSub: 'telefon, noutbuk', tunLan: 'ev şəbəkəsinə', tunRouter: 'yalnız router-ə', legRemote: 'Uzaqdan giriş (şifrəli tunel)',
  },
  ru: {
    title: 'Что мы настроим', internet: 'Интернет', isp: (n) => `Провайдер ${n}`, cable: 'кабель', login: 'по логину/паролю', sim: 'мобильный интернет (SIM)',
    router: 'MikroTik', home: 'Устройства дома / в офисе', pc: 'Компьютер', phone: 'Телефон', tv: 'Телевизор', cam: 'Камера / сервер',
    guests: 'Гости', guestPhone: 'Телефон гостя', wall: 'Гости не видят ваши устройства',
    shield: 'Защита', blocked: 'Нежелательные подключения извне блокируются', fwd: (p) => `Разрешённый доступ извне: порт ${p}`,
    only: 'только', block: 'блок', active: 'работает', standby: 'в резерве', down: 'обрыв', both: 'вместе',
    simDown: '«Оборвать» основной канал и посмотреть', simUp: 'Восстановить канал', simNote: 'Трафик сам перешёл на резервный канал',
    limit: (n) => `ограничение скорости: ${n}`, wifi: 'WiFi', cams: 'Камеры', off: 'выключен (порт закрыт)', pmTitle: 'Карта портов: какой кабель куда', clickGo: 'нажмите, чтобы открыть этот шаг', clickHint: 'Нажмите на любую часть схемы или номер: откроется нужный шаг.', roleLan: 'локальная сеть', roleGuest: 'гостевая сеть', roleCam: 'сеть камер', camGroup: 'Камеры', camNote: 'Камеры не видят LAN', camInetOn: 'интернет: есть', camInetOff: 'интернет: нет (только время)',
    focus: ['Роутер: модель и имя', 'Интернет: провайдер(ы) и подключение', 'Локальная сеть: адреса и устройства', 'Порты: подключение кабелей', 'WiFi, гостевая сеть и сеть камер', 'Защита, доступ извне и лимиты', 'Всё вместе'],
    legend: ['Ваш интернет-трафик', 'Заблокированные подключения извне', 'Разрешённый вами доступ извне'],
    remote: 'Удалённые устройства', remoteSub: 'телефон, ноутбук', tunLan: 'в домашнюю сеть', tunRouter: 'только к роутеру', legRemote: 'Удалённый доступ (шифрованный туннель)',
  },
  en: {
    title: 'What we will set up', internet: 'Internet', isp: (n) => `Provider ${n}`, cable: 'cable', login: 'with login/password', sim: 'mobile internet (SIM)',
    router: 'MikroTik', home: 'Devices at home / in the office', pc: 'Computer', phone: 'Phone', tv: 'TV', cam: 'Camera / server',
    guests: 'Guests', guestPhone: "Guest's phone", wall: 'Guests cannot see your devices',
    shield: 'Protection', blocked: 'Unwanted connections from outside are blocked', fwd: (p) => `Allowed access from outside: port ${p}`,
    only: 'only', block: 'blocked', active: 'working', standby: 'on standby', down: 'cut', both: 'together',
    simDown: '"Cut" the main line and watch', simUp: 'Restore the line', simNote: 'Traffic moved to the backup line by itself',
    limit: (n) => `speed limit on ${n}`, wifi: 'WiFi', cams: 'Cameras', off: 'disabled (port closed)', pmTitle: 'Port map: which cable goes where', clickGo: 'click to open this step', clickHint: 'Click any part of the picture or a number to open that step.', roleLan: 'local network', roleGuest: 'guest network', roleCam: 'camera network', camGroup: 'Cameras', camNote: 'Cameras cannot reach the LAN', camInetOn: 'internet: yes', camInetOff: 'internet: no (time only)',
    focus: ['Router: model and name', 'Internet: provider(s) and connection', 'Local network: addresses and devices', 'Ports: cable connections', 'WiFi, guest and camera networks', 'Protection, access from outside and limits', 'Everything together'],
    legend: ['Your internet traffic', 'Blocked connections from outside', 'Access from outside that you allowed'],
    remote: 'Remote devices', remoteSub: 'phone, laptop', tunLan: 'to the home network', tunRouter: 'router only', legRemote: 'Remote access (encrypted tunnel)',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = (cls, path, dur, begin, r = 4.5) =>
  `<circle class="dg-anim ${cls}" r="${r}" opacity="0"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/>`
  + `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`;

function cloud(x, y, cls) {
  return `<g class="dg-cloud ${cls}"><circle cx="${x - 26}" cy="${y + 4}" r="17"/><circle cx="${x}" cy="${y - 8}" r="24"/><circle cx="${x + 26}" cy="${y + 4}" r="17"/><rect x="${x - 26}" y="${y + 4}" width="52" height="17"/></g>`;
}
// simple pictograms, always with a text label next to them
const ICON = {
  pc: (x, y) => `<rect x="${x - 16}" y="${y - 12}" width="32" height="21" rx="3"/><path d="M${x - 21} ${y + 13}h42" stroke-width="3" stroke-linecap="round"/>`,
  phone: (x, y) => `<rect x="${x - 8}" y="${y - 15}" width="16" height="29" rx="4"/><circle cx="${x}" cy="${y + 9}" r="1.6" class="dg-fill"/>`,
  tv: (x, y) => `<rect x="${x - 18}" y="${y - 13}" width="36" height="22" rx="3"/><path d="M${x - 8} ${y + 14}h16"/>`,
  cam: (x, y) => `<rect x="${x - 17}" y="${y - 9}" width="26" height="17" rx="4"/><path d="M${x + 9} ${y - 3}l9-5v15l-9-5z"/>`,
};

export function renderDiagram(spec, lang, step, sim, label = '') {
  const t = DG[lang] || DG.en;
  const dev = DEVICE_PORTS[spec.device] || DEVICE_PORTS.any;
  const wans = [spec.wan1, ...(spec.wan2?.enabled ? [spec.wan2] : [])];
  const two = wans.length === 2;
  const down = two && sim.down;
  const sec = spec.security || {};
  const fwds = spec.forwards || [];
  const cc = geoList(sec.geoCountries);
  const geoOn = sec.geoMode && sec.geoMode !== 'off' && fwds.length && cc.length;
  const guest = spec.guest?.enabled;
  const wifi = spec.wifi?.enabled && dev.wifi;
  const balance = two && spec.failover?.method === 'balance';
  // remote access: devices away from home reach the router through an encrypted tunnel
  const tuns = [
    ...(spec.vpn?.enabled && spec.ros !== '6' ? [{ k: 'wg', name: 'WireGuard', lan: spec.vpn.access === 'lan' }] : []),
    ...(spec.zt?.enabled && spec.ros !== '6' && dev.zt ? [{ k: 'zt', name: 'ZeroTier', lan: spec.zt.access === 'lan' }] : []),
  ];
  // every step lights up its own part of the picture; the rest fades back
  const ACTIVE = [['router'], ['wan', 'flow'], ['lan', 'flow'], ['ports', 'lan'], ['wifi', 'guest', 'cams'], ['sec', 'lim', 'remote'], null][step] || null;
  // every part is clickable and opens its step; the active one pulses (nothing is greyed out)
  const GO = { router: 0, wan: 1, lan: 2, ports: 3, wifi: 4, guest: 4, cams: 4, sec: 5, remote: 5 };
  const part = (name, body) => {
    const go = GO[name], on = ACTIVE && ACTIVE.includes(name) && go !== undefined;
    const attrs = go === undefined ? '' : ` data-dg-go="${go}" tabindex="0" role="button" aria-label="${esc(t.focus[go])}"`;
    const tip = go === undefined ? '' : `<title>${esc(`${go + 1}. ${t.focus[go]} (${t.clickGo})`)}</title>`;
    return `<g class="dg-part${on ? ' dg-on' : ''}"${attrs}>${tip}${body}</g>`;
  };
  const badge = (n, x, y) => `<g class="dg-badge${step === n ? ' dg-badge-on' : ''}" data-dg-go="${n}" tabindex="0" role="button" aria-label="${esc(t.focus[n])}"><title>${esc(`${n + 1}. ${t.focus[n]} (${t.clickGo})`)}</title><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y}">${n + 1}</text></g>`;

  const RX = 330, RW = 150, RY = 128, RH = 86, RCY = RY + RH / 2; // router box
  const wy = two ? [92, 252] : [170];
  const ry = two ? [RCY - 18, RCY + 18] : [RCY];
  const CX = 108;
  const wanPath = (i) => `M${RX + 10} ${ry[i]} C ${RX - 70} ${ry[i]}, ${CX + 120} ${wy[i]}, ${CX + 44} ${wy[i]}`;
  const lanY = [78, 128, 178, 228];
  const BUSX = 600, DX = 645;
  const camsOn = !!spec.cams?.enabled;
  const camY = 300, CAMX = RX + RW - 30;
  const gy = camsOn ? 384 : 304;
  const H = guest ? gy + 46 : camsOn ? camY + 52 : 300;
  const SHX = RX - 36;
  const REMY = (two ? wy[1] : wy[0]) + 128;          // remote devices: bottom-left, under the internet cloud(s)
  const HH = tuns.length ? Math.max(H, REMY + 62) : H;

  // port names for the "Ports" step
  const wanPort = (w) => (w.type === 'lte' ? (w.lteIf || 'lte1') : w.port);
  const usedWan = new Set(wans.filter((w) => w.type !== 'lte').map((w) => w.port));
  const roleOf = (r) => Object.entries(spec.ports || {}).filter(([p, v]) => !usedWan.has(p) && v && v.role === r).map(([p]) => p);
  // group by name: ether2..ether10 -> "ether2–10", sfp-sfpplus1 stays on its own line
  const groups = (l) => {
    const by = new Map();
    for (const x of l) { const m = x.match(/^(.*?)(\d+)$/); const k = m ? m[1] : x; if (!by.has(k)) by.set(k, []); by.get(k).push(m ? Number(m[2]) : null); }
    return [...by].map(([k, ns]) => (ns[0] === null ? k : ns.length === 1 ? `${k}${ns[0]}` : ns.length === 2 ? `${k}${ns[0]}, ${k}${ns[1]}` : `${k}${ns[0]}–${ns[ns.length - 1]}`));
  };
  const short = (l) => groups(l).join(', ');
  const lines = (x, y, l, cls = 'dg-port', up = true) => groups(l).map((g, i, a) => `<text class="${cls}" x="${x}" y="${up ? y - (a.length - 1 - i) * 13 : y + i * 13}">${esc(g)}</text>`).join('');
  const lanPorts = roleOf('lan'), guestPorts = guest ? roleOf('guest') : [], camPorts = camsOn ? roleOf('cam') : [], offPorts = roleOf('off');

  let s = `<svg class="dg" viewBox="0 0 820 ${HH}" role="img" aria-label="${esc(t.title)}">`;

  // ---- internet side
  let w8 = '';
  wans.forEach((w, i) => {
    const state = down ? (i === 0 ? 'down' : 'act') : two && !balance && i === 1 ? 'stby' : 'act';
    const kind = w.type === 'lte' ? t.sim : w.type === 'pppoe' ? t.login : t.cable;
    w8 += `<path class="dg-line dg-wan-${state}" d="${wanPath(i)}"/>`;
    w8 += cloud(CX, wy[i] - 2, `dg-cloud-${state}`);
    w8 += `<text class="dg-t dg-b" x="${CX}" y="${wy[i] + 40}" text-anchor="middle">${esc(two ? t.isp(i + 1) : t.internet)}</text>`;
    w8 += `<text class="dg-t dg-s" x="${CX}" y="${wy[i] + 55}" text-anchor="middle">${esc(kind)}</text>`;
    w8 += `<text class="dg-t dg-s dg-st-${state}" x="${CX}" y="${wy[i] + 69}" text-anchor="middle">● ${esc(state === 'down' ? t.down : state === 'stby' ? t.standby : balance ? t.both : t.active)}</text>`;
    if (w.type === 'lte') w8 += `<g class="dg-ico" transform="translate(${CX - 8} ${wy[i] - 14})"><path d="M0 0h11l5 5v15H0z"/><path d="M3 9h10M3 13h10" /></g>`;
    if (state === 'down') w8 += `<text class="dg-x" x="${(RX + CX) / 2 - 10}" y="${(ry[i] + wy[i]) / 2 + 6}" text-anchor="middle">✕</text>`;
  });
  s += part('wan', w8);

  // ---- LAN wiring (cameras are always part of the home/office picture)
  const lanDevs = [['pc', t.pc], ['phone', t.phone], ['tv', t.tv], ...(camsOn ? [] : [['cam', fwds.length ? t.cam : t.cams]])];
  const camTarget = camsOn ? camY : lanY[3];
  let lw = `<path class="dg-line dg-lan" d="M${RX + RW} ${RCY} H${BUSX} M${BUSX} ${lanY[0]} V${lanY[lanDevs.length - 1]}"/>`;
  lanDevs.forEach((_, i) => { lw += `<path class="dg-line dg-lan" d="M${BUSX} ${lanY[i]} H${DX - 22}"/>`; });
  s += part('lan', lw);
  if (guest) s += part('guest', `<path class="dg-line dg-guest" d="M${RX + RW / 2} ${RY + RH} V${gy} H${DX - 22}"/>`);
  if (camsOn) s += part('cams', `<path class="dg-line dg-camline" d="M${CAMX} ${RY + RH} V${camY} H${DX - 22}"/>`);

  // ---- animated traffic (before the router so dots disappear inside it)
  const out = down ? 1 : 0;
  let fl = '';
  lanDevs.forEach((_, i) => {
    const via = balance && !down ? i % 2 : out;
    fl += dot('dg-ok', `M${DX - 22} ${lanY[i]} H${BUSX} V${RCY} H${RX + RW / 2} L${RX + 10} ${ry[via]} C ${RX - 70} ${ry[via]}, ${CX + 120} ${wy[via]}, ${CX + 44} ${wy[via]}`, 3.4, i * 0.85);
  });
  if (guest) fl += dot('dg-ok', `M${DX - 22} ${gy} H${RX + RW / 2} V${RCY} L${RX + 10} ${ry[out]} C ${RX - 70} ${ry[out]}, ${CX + 120} ${wy[out]}, ${CX + 44} ${wy[out]}`, 3.8, 0.6);
  if (camsOn) {
    fl += dot('dg-cw', `M${DX - 22} ${lanY[0]} H${BUSX} V${RCY} H${CAMX} V${camY} H${DX - 22}`, 3.6, 1.2, 3.5);
    fl += spec.cams.internet
      ? dot('dg-ok', `M${DX - 22} ${camY} H${CAMX} V${RCY} H${RX + 10} L${RX + 10} ${ry[out]} C ${RX - 70} ${ry[out]}, ${CX + 120} ${wy[out]}, ${CX + 44} ${wy[out]}`, 3.6, 0.4)
      : dot('dg-bad', `M${DX - 22} ${camY} H${CAMX} V${RY + RH + 4}`, 2.2, 0.4);
  }
  s += part('flow', fl);

  // ---- protection: blocked (red), allowed forward (orange), shield, country tag
  let sc = dot('dg-bad', `M${CX + 44} ${wy[0] - 26} C ${CX + 130} ${wy[0] - 26}, ${SHX - 60} ${RCY - 40}, ${SHX - 4} ${RCY - 4}`, 2.6, 0.3);
  if (two) sc += dot('dg-bad', `M${CX + 44} ${wy[1] + 26} C ${CX + 130} ${wy[1] + 26}, ${SHX - 60} ${RCY + 40}, ${SHX - 4} ${RCY + 4}`, 2.9, 1.5);
  if (fwds.length) {
    const i = down ? 1 : 0;
    const fp = `M${CX + 44} ${wy[i] + 12} C ${CX + 150} ${wy[i] + 12}, ${RX - 80} ${RCY + 6}, ${RX + 10} ${RCY + 6} ${camsOn ? `H${CAMX} V${camY}` : `H${BUSX} V${lanY[3]}`} H${DX - 22}`;
    sc += `<path class="dg-line dg-fwd" d="${fp}"/>` + dot('dg-fw', fp, 4.2, 0.8);
    sc += `<text class="dg-t dg-s dg-fwt" x="${RX + RW / 2}" y="${RY + RH + 22}" text-anchor="middle">${esc(t.fwd(fwds.map((f) => f.extPort).filter(Boolean).join(', ') || '…'))}</text>`;
    if (geoOn) {
      const tag = `${sec.geoMode === 'allow' ? t.only : t.block}: ${cc.slice(0, 5).join(', ')}${cc.length > 5 ? '…' : ''}`;
      sc += `<g class="dg-geo dg-geo-${sec.geoMode}"><rect x="${CX - 62}" y="${wy[0] - 62}" width="124" height="22" rx="11"/><text x="${CX}" y="${wy[0] - 47}" text-anchor="middle">${esc(tag)}</text></g>`;
    }
  }
  sc += `<g class="dg-shield" transform="translate(${SHX} ${RCY})"><path d="M0 -24 L18 -16 V2 C18 14 9 21 0 25 C-9 21 -18 14 -18 2 V-16 Z"/><path class="dg-check" d="M-7 0 l5 5 l9 -10"/></g>`;
  sc += `<text class="dg-t dg-s" x="${SHX}" y="${RY - 14}" text-anchor="middle">${esc(t.shield)}</text>`;
  s += part('sec', sc);

  if (tuns.length) {
    let rm = '';
    tuns.forEach((tn, i) => {
      const off = i * 16;
      // tunnel comes in from the internet side, passes the shield (allowed) and ends in the router or goes on to the LAN
      const toRouter = `M${CX + 46} ${REMY - 8 + off} C ${CX + 160} ${REMY - 8 + off}, ${SHX - 50} ${RCY + 58 + off}, ${RX + 10} ${RCY + 24 + off / 2}`;
      const path = tn.lan ? `${toRouter} H${RX + RW / 2} V${RCY} H${BUSX} V${lanY[0]} H${DX - 22}` : `${toRouter} H${RX + RW / 2}`;
      rm += `<path class="dg-line dg-tun dg-tun-${tn.k}" d="${toRouter}"/>`;
      rm += dot(`dg-${tn.k}`, path, tn.lan ? 4.6 : 3.2, 0.5 + i * 1.1);
      rm += `<text class="dg-t dg-s dg-tunt-${tn.k}" x="${CX + 150}" y="${REMY - 16 + off * 1.6}">🔒 ${esc(tn.name)}: ${esc(tn.lan ? t.tunLan : t.tunRouter)}</text>`;
    });
    rm += `<g class="dg-ico">${ICON.pc(CX - 22, REMY)}${ICON.phone(CX + 24, REMY)}</g>`;
    rm += `<text class="dg-t dg-b" x="${CX}" y="${REMY + 36}" text-anchor="middle">${esc(t.remote)}</text>`;
    rm += `<text class="dg-t dg-s" x="${CX}" y="${REMY + 51}" text-anchor="middle">${esc(t.remoteSub)}</text>`;
    s += part('remote', rm);
  }

  // ---- router: a plain box with words, not a symbol
  let rt = `<rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" rx="14"/>`;
  rt += `<text class="dg-rt" x="${RX + RW / 2}" y="${RY + 34}" text-anchor="middle">${esc(t.router)}</text>`;
  rt += `<text class="dg-rs" x="${RX + RW / 2}" y="${RY + 52}" text-anchor="middle">${esc(label || 'MikroTik')}</text>`;
  for (let k = 0; k < 6; k++) rt += `<circle class="dg-led" cx="${RX + 30 + k * 18}" cy="${RY + RH - 16}" r="3.2" style="animation-delay:${(k * 0.37) % 1.3}s"/>`;
  s += part('router', `<g class="dg-router">${rt}</g>`);
  if (wifi) {
    s += part('wifi', `<path class="dg-ant" d="M${RX + 22} ${RY} v-22 M${RX + RW - 22} ${RY} v-22"/>`
      + `<g class="dg-waves"><path d="M${RX + RW - 34} ${RY - 30} a16 16 0 0 1 24 0"/><path d="M${RX + RW - 40} ${RY - 37} a24 24 0 0 1 36 0"/></g>`
      + `<text class="dg-t dg-s dg-wifit" x="${RX + RW - 22}" y="${RY - 62}" text-anchor="middle">${esc(t.wifi)}: ${esc(spec.wifi.ssid || '')}</text>`);
  }

  // ---- LAN devices with words
  let ld = `<text class="dg-t dg-b" x="${DX + 50}" y="${lanY[0] - 34}" text-anchor="middle">${esc(t.home)}</text>`;
  ld += `<text class="dg-t dg-s" x="${DX + 50}" y="${lanY[0] - 20}" text-anchor="middle">${esc(`${spec.lan?.address || ''}/${spec.lan?.prefix || ''}`)}</text>`;
  lanDevs.forEach(([k, name], i) => { ld += `<g class="dg-ico">${ICON[k](DX, lanY[i])}</g><text class="dg-t" x="${DX + 30}" y="${lanY[i] + 5}">${esc(name)}</text>`; });
  s += part('lan', ld);

  // ---- port names (step "Ports")
  let pt = '';
  wans.forEach((w, i) => { pt += `<text class="dg-port" x="${CX + 88}" y="${wy[i] + (i === 0 ? -10 : 22)}" text-anchor="middle">${esc(wanPort(w))}</text>`; });
  if (lanPorts.length) pt += lines(RX + RW + 8, RCY - 9, lanPorts);
  if (guestPorts.length) pt += lines(RX + RW / 2 + 10, gy - 8, guestPorts);
  if (camPorts.length) pt += lines(CAMX + 10, camY - 8, camPorts);
  if (step === 3 || step === 6) s += part('ports', pt);

  const nLim = (spec.limits || []).length + Object.values(spec.ports || {}).filter((p) => p && (p.down || p.up)).length;
  if (camsOn) {
    const cn = `${spec.cams.address || ''}/${spec.cams.prefix || ''}`;
    s += part('cams', `<path class="dg-camwall" d="M${BUSX - 30} ${camY - 34} H808"/><text class="dg-t dg-s dg-camt" x="${DX + 60}" y="${camY - 41}" text-anchor="middle">🔒 ${esc(t.camNote)}</text>`
      + `<g class="dg-ico">${ICON.cam(DX, camY)}</g><text class="dg-t dg-b" x="${DX + 30}" y="${camY + 2}">${esc(t.camGroup)}</text>`
      + `<text class="dg-t dg-s" x="${DX + 30}" y="${camY + 17}">${esc(cn)}</text>`
      + `<text class="dg-t dg-s ${spec.cams.internet ? 'dg-st-act' : 'dg-camt'}" x="${DX + 30}" y="${camY + 31}">${esc(spec.cams.internet ? t.camInetOn : t.camInetOff)}</text>`);
  }
  if (guest) {
    s += part('guest', `<path class="dg-wall" d="M${BUSX - 30} ${gy - 30} H808"/><text class="dg-t dg-s dg-wallt" x="${DX + 60}" y="${gy - 37}" text-anchor="middle">🔒 ${esc(t.wall)}</text>`
      + `<g class="dg-ico">${ICON.phone(DX, gy)}</g><text class="dg-t" x="${DX + 30}" y="${gy + 5}">${esc(t.guestPhone)}</text>`);
  }
  // numbered markers: where each step lives on the picture
  s += badge(0, RX + RW - 4, RY + 4) + badge(1, CX + 54, wy[0] - 30) + badge(2, DX + 150, lanY[0] - 46) + badge(3, RX + RW + 14, RCY + 24);
  if (wifi) s += badge(4, RX + RW + 30, RY - 38); else if (guest) s += badge(4, RX + RW / 2 - 18, gy - 18); else if (camsOn) s += badge(4, CAMX - 18, camY - 18);
  s += badge(5, SHX - 28, RCY - 30);
  s += '</svg>';

  const legend = t.legend.map((l, i) => `<span><i class="dg-k${i}"></i>${esc(l)}</span>`).join('') + (tuns.length ? `<span><i class="dg-k3"></i>${esc(t.legRemote)}</span>` : '');
  const simBtn = two && !balance ? `<button class="chip dg-sim" data-sim>${esc(down ? t.simUp : t.simDown)}</button>` : '';
  const note = down ? `<span class="dg-note">✓ ${esc(t.simNote)}</span>` : '';
  const lim = nLim ? `<span class="dg-pill${ACTIVE && ACTIVE.includes('lim') ? ' dg-pill-on' : ''}">⏱ ${esc(t.limit(nLim))}</span>` : '';
  const cap = `<span class="dg-cap"><i>${step + 1}</i>${esc(t.focus[step] || '')}</span>`;
  // port map: every socket, what it is for and what the user wrote it is connected to
  let pm = '';
  if (step === 3 || step === 6) {
    const all = (dev.ports || []).concat(wans.filter((w) => w.type === 'lte').map((w) => w.lteIf || 'lte1'));
    pm = `<div class="dg-pm"><b>${esc(t.pmTitle)}</b><div class="dg-pmg">${all.map((p) => {
      const wi = wans.findIndex((w) => (w.type === 'lte' ? (w.lteIf || 'lte1') : w.port) === p);
      const v = (spec.ports || {})[p] || {};
      const role = wi >= 0 ? 'wan' : (v.role === 'guest' && !guest) || (v.role === 'cam' && !camsOn) ? 'off' : v.role || 'lan';
      const what = wi >= 0 ? (two ? t.isp(wi + 1) : t.internet) : role === 'guest' ? t.roleGuest : role === 'cam' ? t.roleCam : role === 'off' ? t.off : t.roleLan;
      return `<div class="dg-pmi dg-pm-${role}"><code>${esc(p)}</code><span>${esc(what)}</span>${v.desc && wi < 0 ? `<em>${esc(v.desc)}</em>` : ''}</div>`;
    }).join('')}</div></div>`;
  }
  return `<div class="dg-wrap"><div class="dg-head"><b>${esc(t.title)}</b>${cap}${lim}${simBtn}${note}</div>${s}${pm}<div class="dg-legend">${legend}<span class="dg-s2">${esc(t.blocked)}</span><span class="dg-s2 dg-hint">👆 ${esc(t.clickHint)}</span></div></div>`;
}
