// Stand-alone "link between offices" tool: two MikroTik routers that are already configured get an
// encrypted WireGuard link. Office A and office B each get an add-on script; nothing else is touched.
import { defaultLink, buildLink, linkInfo, isWgKey, ascii } from './wizard-core.js';
import { wgKeypair, wgPsk } from './wg-keys.js';

const LK = {
  az: {
    tab: 'VPN tunel',
    intro: 'İki ofisin MikroTik router-lərini şifrəli WireGuard tuneli ilə birləşdirin. Router-lər artıq qurulubsa, bu alət hər biri üçün yalnız bağlantını əlavə edən skript hazırlayır. A = birinci ofis, B = ikinci ofis.',
    ros7: 'Yalnız RouterOS 7: bu bağlantı WireGuard ilə qurulur, RouterOS 6-da WireGuard yoxdur. Hər iki router-in versiyasını Winbox-un başlığında və ya System → Resources-da yoxlayın. RouterOS 6 olan router-də skript heç nə dəyişmədən dayanır.', ros7Tag: 'yalnız RouterOS 7',
    aTitle: 'A ofisi', bTitle: 'B ofisi', name: 'Ofisin adı',
    lan: 'LAN şəbəkəsi', lanHint: 'Bu ofisdəki kompüter, server və printerlərin şəbəkəsi (router-in LAN-ı), məs. 192.168.88.0/24. Tunel şəbəkəsi DEYİL. Bir neçəsi vergüllə.',
    ep: 'Router-in public ünvanı', epHint: 'Statik IP və ya DDNS adı (məs. /ip cloud). Yoxdursa, boş saxlayın: bu router bağlantını özü başladacaq.',
    pppoe: 'İnternet PPPoE ilədir',
    tunTitle: 'Tunel (WireGuard)', port: 'Port (UDP)', tunnel: 'Tunel şəbəkəsi (/30)',
    tunnelHint: 'Yalnız iki router arasındakı kiçik şəbəkə, LAN deyil: A-nın tunel ünvanı .1, B-ninki .2 olur. Adətən dəyişmək lazım deyil.',
    tunIps: (a, b) => `Tunel ünvanları: A ${a}  ↔  B ${b}`,
    accA: (b, a) => `B ofisi (${b}) A ofisində (${a}) nəyə çata bilər`, accB: (a, b) => `A ofisi (${a}) B ofisində (${b}) nəyə çata bilər`,
    accHintA: 'Bu icazələri A router-i yoxlayır. Sonradan dəyişmək üçün: IP → Firewall → Address Lists.', accHintB: 'Bu icazələri B router-i yoxlayır. Sonradan dəyişmək üçün: IP → Firewall → Address Lists.',
    modeLbl: 'İcazə', all: 'Bütün LAN şəbəkəsi', list: 'Yalnız seçilmiş cihazlar',
    dev: 'Cihaz', svc: 'Nəyə icazə', svcAll: 'Hər şey', svcFiles: 'Fayl paylaşımı', svcRdp: 'Uzaq masaüstü (RDP)', svcWeb: 'Veb (80, 443)', svcPrint: 'Printer', svcCustom: 'Öz portum',
    ports: 'Portlar', mac: 'MAC (sabit IP üçün)', macHint: 'Yazsanız, cihaz DHCP-dən həmişə bu IP-ni alacaq.', addDev: '+ Cihaz əlavə et', remove: 'Sil',
    keys: 'Yeni açarlar', keysConfirm: 'Bütün açarlar yenidən yaradılsın? Köhnə skriptlər artıq işləməyəcək.', keyErr: 'Açarlar yaradıla bilmədi.',
    keysNote: 'Açarlar brauzerdə yaradılır (açıq http üzərində server yaradır) və yalnız bu brauzerdə saxlanılır.',
    out: 'Skriptlər', errors: 'Düzəldilməli olanlar', notes: 'Bilməli olduqlarınız', scriptFor: (x, n) => `${x} router-i üçün skript: ${n}`,
    undo: (x, n) => `Silmə skripti: ${x} (${n})`, undoHint: 'Bağlantını sonradan tamamilə çıxarmaq üçün. Yalnız bu bağlantıya aid obyektləri silir.',
    secretWarn: 'Hər skriptdə həmin router-in gizli açarı var: yalnız öz router-inin sahibinə verin.', reset: 'Sıfırla', resetConfirm: 'Bütün daxil etdikləriniz silinsin?',
    dg: {
      title: 'A ↔ B bağlantısı', internet: 'İnternet', tunnel: 'WireGuard tunel (şifrəli)', tunNet: (c) => `tunel şəbəkəsi ${c}`,
      lan: 'LAN', pub: (x) => `public: ${x}`, noPub: 'public ünvan yoxdur', starts: 'bağlantını başladır',
      reach: (x) => `${x} buraya çata bilər:`, reachAll: 'bütün LAN', reachSel: (n) => `${n} seçilmiş cihaz`,
      legLan: 'LAN şəbəkəsi: ofisdəki cihazlar', legTun: 'Tunel şəbəkəsi: yalnız iki router arasında', legDots: 'Ofislər arası trafik', click: 'Sxemdə hissəyə klikləyin: uyğun bölmə açılır.',
    },
  },
  ru: {
    tab: 'VPN-туннель',
    intro: 'Соедините роутеры MikroTik двух офисов шифрованным туннелем WireGuard. Если роутеры уже настроены, инструмент готовит для каждого скрипт, который только добавляет связь. A — первый офис, B — второй.',
    ros7: 'Только RouterOS 7: связь строится на WireGuard, а в RouterOS 6 WireGuard нет. Проверьте версию обоих роутеров в заголовке Winbox или в System → Resources. На роутере с RouterOS 6 скрипт остановится, ничего не изменив.', ros7Tag: 'только RouterOS 7',
    aTitle: 'Офис A', bTitle: 'Офис B', name: 'Название офиса',
    lan: 'LAN-сеть', lanHint: 'Сеть компьютеров, серверов и принтеров этого офиса (LAN роутера), напр. 192.168.88.0/24. НЕ сеть туннеля. Несколько через запятую.',
    ep: 'Публичный адрес роутера', epHint: 'Статический IP или DDNS (напр. /ip cloud). Если нет — оставьте пустым: этот роутер сам начнёт связь.',
    pppoe: 'Интернет по PPPoE',
    tunTitle: 'Туннель (WireGuard)', port: 'Порт (UDP)', tunnel: 'Сеть туннеля (/30)',
    tunnelHint: 'Маленькая сеть только между двумя роутерами, не LAN: у A адрес .1, у B — .2. Обычно менять не нужно.',
    tunIps: (a, b) => `Адреса туннеля: A ${a}  ↔  B ${b}`,
    accA: (b, a) => `Куда офис B (${b}) может выходить в офисе A (${a})`, accB: (a, b) => `Куда офис A (${a}) может выходить в офисе B (${b})`,
    accHintA: 'Эти разрешения проверяет роутер A. Изменить позже: IP → Firewall → Address Lists.', accHintB: 'Эти разрешения проверяет роутер B. Изменить позже: IP → Firewall → Address Lists.',
    modeLbl: 'Разрешение', all: 'Вся LAN-сеть', list: 'Только выбранные устройства',
    dev: 'Устройство', svc: 'Что разрешено', svcAll: 'Всё', svcFiles: 'Общие папки', svcRdp: 'Удалённый рабочий стол (RDP)', svcWeb: 'Веб (80, 443)', svcPrint: 'Принтер', svcCustom: 'Свои порты',
    ports: 'Порты', mac: 'MAC (для постоянного IP)', macHint: 'Если указать, устройство всегда получит этот IP по DHCP.', addDev: '+ Добавить устройство', remove: 'Удалить',
    keys: 'Новые ключи', keysConfirm: 'Создать все ключи заново? Старые скрипты перестанут работать.', keyErr: 'Не удалось создать ключи.',
    keysNote: 'Ключи создаются в браузере (по обычному http — на сервере) и хранятся только в этом браузере.',
    out: 'Скрипты', errors: 'Нужно исправить', notes: 'Важно знать', scriptFor: (x, n) => `Скрипт для роутера ${x}: ${n}`,
    undo: (x, n) => `Скрипт удаления: ${x} (${n})`, undoHint: 'Чтобы позже полностью убрать связь. Удаляет только объекты этой связи.',
    secretWarn: 'В каждом скрипте секретный ключ своего роутера: передавайте только владельцу этого роутера.', reset: 'Сбросить', resetConfirm: 'Удалить всё введённое?',
    dg: {
      title: 'Связь A ↔ B', internet: 'Интернет', tunnel: 'Туннель WireGuard (шифрованный)', tunNet: (c) => `сеть туннеля ${c}`,
      lan: 'LAN', pub: (x) => `публичный: ${x}`, noPub: 'нет публичного адреса', starts: 'начинает связь',
      reach: (x) => `${x} может выходить сюда:`, reachAll: 'вся LAN', reachSel: (n) => `выбрано устройств: ${n}`,
      legLan: 'LAN-сеть: устройства офиса', legTun: 'Сеть туннеля: только между двумя роутерами', legDots: 'Трафик между офисами', click: 'Нажмите на часть схемы: откроется нужный раздел.',
    },
  },
  en: {
    tab: 'VPN tunnel',
    intro: 'Connect the MikroTik routers of two offices with an encrypted WireGuard tunnel. If the routers are already configured, this tool makes a script for each of them that only adds the link. A = first office, B = second office.',
    ros7: 'RouterOS 7 only: the link uses WireGuard, which RouterOS 6 does not have. Check the version of both routers in the Winbox title bar or in System > Resources. On a RouterOS 6 router the script stops without changing anything.', ros7Tag: 'RouterOS 7 only',
    aTitle: 'Office A', bTitle: 'Office B', name: 'Office name',
    lan: 'LAN network', lanHint: 'The network of the computers, servers and printers in this office (the router\'s LAN), e.g. 192.168.88.0/24. NOT the tunnel network. Several separated by commas.',
    ep: 'Public address of the router', epHint: 'Static IP or DDNS name (e.g. /ip cloud). Leave empty if there is none: this router will start the link.',
    pppoe: 'Internet over PPPoE',
    tunTitle: 'Tunnel (WireGuard)', port: 'Port (UDP)', tunnel: 'Tunnel network (/30)',
    tunnelHint: 'A small network only between the two routers, not a LAN: A gets .1 and B gets .2. Usually no need to change it.',
    tunIps: (a, b) => `Tunnel addresses: A ${a}  <->  B ${b}`,
    accA: (b, a) => `What office B (${b}) may reach in office A (${a})`, accB: (a, b) => `What office A (${a}) may reach in office B (${b})`,
    accHintA: 'Router A checks these permissions. To change them later: IP > Firewall > Address Lists.', accHintB: 'Router B checks these permissions. To change them later: IP > Firewall > Address Lists.',
    modeLbl: 'Permission', all: 'The whole LAN network', list: 'Selected devices only',
    dev: 'Device', svc: 'What is allowed', svcAll: 'Everything', svcFiles: 'File sharing', svcRdp: 'Remote desktop (RDP)', svcWeb: 'Web (80, 443)', svcPrint: 'Printer', svcCustom: 'My own ports',
    ports: 'Ports', mac: 'MAC (for a fixed IP)', macHint: 'If set, the device always gets this IP from DHCP.', addDev: '+ Add device', remove: 'Remove',
    keys: 'New keys', keysConfirm: 'Make all keys again? The old scripts will stop working.', keyErr: 'Could not generate the keys.',
    keysNote: 'The keys are made in the browser (over plain http the server makes them) and kept only in this browser.',
    out: 'Scripts', errors: 'Please fix', notes: 'Good to know', scriptFor: (x, n) => `Script for router ${x}: ${n}`,
    undo: (x, n) => `Undo script: ${x} (${n})`, undoHint: 'To remove the link completely later. It deletes only the objects of this link.',
    secretWarn: 'Each script holds its own router\'s private key: give it only to the owner of that router.', reset: 'Reset', resetConfirm: 'Clear everything you entered?',
    dg: {
      title: 'Link A <-> B', internet: 'Internet', tunnel: 'WireGuard tunnel (encrypted)', tunNet: (c) => `tunnel network ${c}`,
      lan: 'LAN', pub: (x) => `public: ${x}`, noPub: 'no public address', starts: 'starts the link',
      reach: (x) => `${x} may reach here:`, reachAll: 'the whole LAN', reachSel: (n) => `${n} selected device(s)`,
      legLan: 'LAN network: devices in the office', legTun: 'Tunnel network: only between the two routers', legDots: 'Traffic between the offices', click: 'Click a part of the picture to open its section.',
    },
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const fileName = (n) => `${String(ascii(n) || 'office').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'office'}-office-link-${new Date().toISOString().slice(0, 10)}.rsc`;
const dot = (cls, path, dur, begin) => `<circle class="dg-anim ${cls}" r="4.6" opacity="0"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/>`
  + `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`;

export function createLinkTool(root, { lang, toast }) {
  let L = (() => { try { const s = JSON.parse(store.get('link') || 'null'); if (s?.a && s?.b) return { ...defaultLink(), ...s }; } catch {} return defaultLink(); })();
  let res = null, busy = false, failed = false, timer = 0;
  const T = () => LK[lang()] || LK.en;
  const save = () => store.set('link', JSON.stringify(L));

  async function ensureKeys(all = false) {
    if (busy || (!all && failed)) return;
    if (!all && [L.aPriv, L.aPub, L.bPriv, L.bPub, L.psk].every(isWgKey)) return;
    busy = true;
    try {
      if (all || !isWgKey(L.aPriv) || !isWgKey(L.aPub)) { const k = await wgKeypair(); L.aPriv = k.priv; L.aPub = k.pub; }
      if (all || !isWgKey(L.bPriv) || !isWgKey(L.bPub)) { const k = await wgKeypair(); L.bPriv = k.priv; L.bPub = k.pub; }
      if (all || !isWgKey(L.psk)) L.psk = wgPsk();
      failed = false; save();
    } catch { failed = true; toast(T().keyErr); }
    finally { busy = false; }
    render();
  }

  // ---------- picture ----------
  function diagram() {
    const t = T(), d = t.dg, i = linkInfo(L);
    const an = esc(L.a.name || 'A'), bn = esc(L.b.name || 'B');
    const ea = String(L.a.endpoint || '').trim(), eb = String(L.b.endpoint || '').trim();
    const AX = 70, BX = 570, RW = 180, RY = 132, RH = 66, RCY = RY + RH / 2, LY = 246, LH = 92;
    const tun = `M${AX + RW} ${RCY} C ${AX + RW + 80} ${RCY}, 330 92, 410 92 C 490 92, ${BX - 80} ${RCY}, ${BX} ${RCY}`;
    const tunBack = `M${BX} ${RCY} C ${BX - 80} ${RCY}, 490 92, 410 92 C 330 92, ${AX + RW + 80} ${RCY}, ${AX + RW} ${RCY}`;
    const aMid = AX + RW / 2, bMid = BX + RW / 2;
    const fromA = `M${aMid} ${LY + 46} V${RY + RH} V${RCY} H${AX + RW} ${tun.slice(tun.indexOf('C'))}${L.bMode === 'list' ? '' : ` H${bMid} V${LY + 46}`}`;
    const fromB = `M${bMid} ${LY + 46} V${RCY} H${BX} ${tunBack.slice(tunBack.indexOf('C'))}${L.aMode === 'list' ? '' : ` H${aMid} V${LY + 46}`}`;
    const reach = (mode, list) => (mode === 'list' ? d.reachSel((list || []).length) : d.reachAll);
    const side = (x, letter, name, lan, ep, mid, key, accKey, mode, list, other) => `
      <g class="lk-part" tabindex="0" role="button" data-lk-go="${key}"><title>${esc(letter)}</title>
        <text class="dg-t dg-s ${ep ? 'lk-pub' : ''}" x="${mid}" y="${RY - 12}" text-anchor="middle">${esc(ep ? d.pub(ep) : d.noPub)}</text>
        <rect class="lk-router" x="${x}" y="${RY}" width="${RW}" height="${RH}" rx="12"/>
        <text class="dg-rt" x="${mid}" y="${RY + 28}" text-anchor="middle">${esc(letter)}</text>
        <text class="dg-rs" x="${mid}" y="${RY + 46}" text-anchor="middle">${name}</text>
        <path class="dg-line lk-lanline" d="M${mid} ${RY + RH} V${LY}"/>
        <rect class="lk-lan" x="${x - 10}" y="${LY}" width="${RW + 20}" height="${LH}" rx="12"/>
        <text class="dg-t dg-b lk-lant" x="${mid}" y="${LY + 20}" text-anchor="middle">${esc(d.lan)}: ${esc(lan || '?')}</text>
        <g class="dg-ico" transform="translate(${mid - 52} ${LY + 52})"><rect x="-14" y="-10" width="28" height="19" rx="3"/><path d="M-18 12h36" stroke-width="3"/></g>
        <g class="dg-ico" transform="translate(${mid} ${LY + 52})"><rect x="-10" y="-16" width="20" height="32" rx="2"/><path d="M-6 -9h12M-6 -3h12M-6 3h12"/></g>
        <g class="dg-ico" transform="translate(${mid + 52} ${LY + 52})"><rect x="-15" y="-6" width="30" height="14" rx="2"/><path d="M-9 -6v-7h18v7M-9 8v6h18v-6"/></g>
      </g>
      <g class="lk-part" tabindex="0" role="button" data-lk-go="${accKey}"><title>${esc(d.reach(other))}</title>
        <text class="dg-t dg-s lk-acc" x="${mid}" y="${LY + LH + 20}" text-anchor="middle">🔒 ${esc(d.reach(other))} ${esc(reach(mode, list))}</text>
      </g>`;
    const startsAt = ea && !eb ? 'b' : eb && !ea ? 'a' : '';
    return `<div class="dg-wrap"><div class="dg-head"><b>${esc(d.title)}</b><span class="lk-rostag">${esc(t.ros7Tag)}</span></div>
      <svg class="dg" viewBox="0 0 820 ${LY + LH + 34}" role="img" aria-label="${esc(d.title)}">
        <g class="dg-cloud"><circle cx="384" cy="54" r="17"/><circle cx="410" cy="42" r="24"/><circle cx="436" cy="54" r="17"/><rect x="384" y="54" width="52" height="17"/></g>
        <text class="dg-t dg-s" x="410" y="22" text-anchor="middle">${esc(d.internet)}</text>
        <g class="lk-part" tabindex="0" role="button" data-lk-go="lkTun"><title>${esc(d.tunnel)}</title>
          <path class="dg-line lk-tun" d="${tun}"/>
          <text class="dg-t dg-b lk-tunt" x="410" y="${RCY + 8}" text-anchor="middle">🔒 ${esc(d.tunnel)}</text>
          <text class="dg-t dg-s lk-tunt" x="410" y="${RCY + 26}" text-anchor="middle">A ${esc(i.aTun || '?')}  ↔  B ${esc(i.bTun || '?')}</text>
          <text class="dg-t dg-s" x="410" y="${RCY + 42}" text-anchor="middle">${esc(d.tunNet(L.tunnel))} · UDP ${esc(L.port)}</text>
          ${startsAt ? `<text class="dg-t dg-s lk-start" x="${startsAt === 'a' ? aMid + 8 : bMid + 8}" y="${RY + RH + 22}">${esc(d.starts)} ${startsAt === 'a' ? '→' : '←'}</text>` : ''}
        </g>
        ${dot('lk-dot', fromA, 4.4, 0.2)}${dot('lk-dot', fromB, 4.4, 2.4)}
        ${side(AX, t.aTitle, an, L.a.lan, ea, aMid, 'lkA', 'lkAccA', L.aMode, L.aList, 'B')}
        ${side(BX, t.bTitle, bn, L.b.lan, eb, bMid, 'lkB', 'lkAccB', L.bMode, L.bList, 'A')}
      </svg>
      <div class="dg-legend"><span><i class="lk-k-lan"></i>${esc(d.legLan)}</span><span><i class="lk-k-tun"></i>${esc(d.legTun)}</span><span><i class="lk-k-dot"></i>${esc(d.legDots)}</span><span class="dg-s2 dg-hint">👆 ${esc(d.click)}</span></div></div>`;
  }

  // ---------- form ----------
  const field = (label, html, hint = '') => `<label class="f"><span>${esc(label)}</span>${html}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  const input = (p, attrs = '') => `<input data-lp="${p}" value="${esc(getP(L, p))}" ${attrs}>`;
  const select = (p, opts) => `<select data-lp="${p}" data-re>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(getP(L, p)) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const check = (p, label) => `<label class="chk"><input type="checkbox" data-lp="${p}" data-re ${getP(L, p) ? 'checked' : ''}> ${esc(label)}</label>`;

  function officeHtml(k, title) {
    const t = T();
    return `<section class="lk-sec" id="lk${k.toUpperCase()}"><h3>${esc(title)}</h3>
      ${field(t.name, input(`${k}.name`, 'maxlength="40"'))}
      ${field(t.lan, input(`${k}.lan`, `placeholder="${k === 'a' ? '192.168.88.0/24' : '192.168.20.0/24'}" spellcheck="false"`), t.lanHint)}
      ${field(t.ep, input(`${k}.endpoint`, `placeholder="${k === 'a' ? 'ofis-a.example.com' : 'ofis-b.example.com'}" spellcheck="false"`), t.epHint)}
      ${check(`${k}.pppoe`, t.pppoe)}</section>`;
  }
  function accessHtml(k) {
    const t = T(), modeKey = `${k}Mode`, listKey = `${k}List`, id = `lkAcc${k.toUpperCase()}`;
    const title = k === 'a' ? t.accA(L.b.name || 'B', L.a.name || 'A') : t.accB(L.a.name || 'A', L.b.name || 'B');
    const svc = [['all', t.svcAll], ['files', t.svcFiles], ['rdp', t.svcRdp], ['web', t.svcWeb], ['print', t.svcPrint], ['custom', t.svcCustom]];
    let h = `<section class="lk-sec" id="${id}"><h3>${esc(title)}</h3>${field(t.modeLbl, select(modeKey, [['all', t.all], ['list', t.list]]), k === 'a' ? t.accHintA : t.accHintB)}`;
    if (L[modeKey] === 'list') {
      L[listKey] ||= [];
      h += L[listKey].map((r, i) => {
        const p = `${listKey}.${i}`;
        const extra = [r.svc === 'custom' ? field(t.ports, input(`${p}.ports`, 'placeholder="8080,8443" inputmode="numeric"')) : '', field(t.mac, input(`${p}.mac`, 'placeholder="AA:BB:CC:DD:EE:FF" spellcheck="false"'), t.macHint)].filter(Boolean);
        return `<div class="rowcard"><div class="grid3">${field(t.dev, input(`${p}.name`, 'maxlength="40"'))}${field('IP', input(`${p}.ip`, `placeholder="${k === 'a' ? '192.168.88.20' : '192.168.20.20'}" spellcheck="false"`))}${field(t.svc, select(`${p}.svc`, svc))}</div>`
          + `<div class="grid2">${extra.join('')}</div><button class="link" data-lkdel="${listKey}.${i}">${esc(t.remove)}</button></div>`;
      }).join('');
      h += `<button class="chip" data-lkadd="${listKey}">${esc(t.addDev)}</button>`;
    }
    return h + '</section>';
  }
  function outHtml() {
    const t = T();
    if (!res) return '';
    if (res.errors.length) return `<div class="box warnbox"><b>${esc(t.errors)}</b><ul>${res.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    const undoBlock = (x, name, script) => `<div class="out-head"><b>${esc(t.undo(x, name))}</b><div class="btns"><button data-lkucopy="${x}">Copy</button><button data-lkudl="${x}">.rsc</button></div></div><pre>${esc(script)}</pre>`;
    const block = (x, name, script) => `<div class="out-head"><h3>${esc(t.scriptFor(x, name))}</h3><div class="btns"><button data-lkcopy="${x}">Copy</button><button data-lkdl="${x}">.rsc</button></div></div><pre>${esc(script)}</pre>`;
    return `<div class="box accent"><b>${esc(t.notes)}</b><ul>${res.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <p class="box warnbox">${esc(t.secretWarn)}</p>${block('A', L.a.name, res.a)}${block('B', L.b.name, res.b)}
      <details class="lk-undo"><summary>${esc(t.undo('A / B', `${L.a.name} / ${L.b.name}`))}</summary><p class="muted">${esc(t.undoHint)}</p>${undoBlock('A', L.a.name, res.aUndo)}${undoBlock('B', L.b.name, res.bUndo)}</details>`;
  }

  function refreshLive() {
    res = buildLink(L, lang());
    const d = root.querySelector('.lk-dg'); if (d) d.innerHTML = diagram();
    const o = root.querySelector('.lk-out'); if (o) o.innerHTML = outHtml();
  }
  function render() {
    const t = T();
    res = buildLink(L, lang());
    const i = linkInfo(L);
    root.innerHTML = `<p class="muted">${esc(t.intro)}</p><p class="box warnbox lk-ros7">${(() => { const [h, ...r] = t.ros7.split(':'); const rest = r.join(':').trim(); return `<b>⚠ ${esc(h)}.</b> ${esc(rest.charAt(0).toUpperCase() + rest.slice(1))}`; })()}</p><div class="lk-dg">${diagram()}</div>
      <div class="grid2 lk-offices">${officeHtml('a', t.aTitle)}${officeHtml('b', t.bTitle)}</div>
      <section class="lk-sec" id="lkTun"><h3>${esc(t.tunTitle)}</h3>
        <div class="grid2">${field(t.port, input('port', 'inputmode="numeric"'))}${field(t.tunnel, input('tunnel', 'spellcheck="false"'), t.tunnelHint)}</div>
        <p class="muted lk-tunips">${esc(t.tunIps(i.aTun || '?', i.bTun || '?'))}</p></section>
      ${accessHtml('a')}${accessHtml('b')}
      <div class="btns"><button class="chip" data-lkkeys>${esc(t.keys)}</button></div><p class="muted">${esc(t.keysNote)}</p>
      <h3>${esc(t.out)}</h3><div class="lk-out">${outHtml()}</div>
      <div class="actions"><button class="btn-reset" data-lkreset><span aria-hidden="true">↺</span> ${esc(t.reset)}</button></div>`;
    ensureKeys();
  }

  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-lp]'); if (!el || el.hasAttribute('data-re')) return;
    setP(L, el.dataset.lp, el.value); save();
    clearTimeout(timer); timer = setTimeout(() => {
      refreshLive();
      const ip = root.querySelector('.lk-tunips'); if (ip) { const i = linkInfo(L); ip.textContent = T().tunIps(i.aTun || '?', i.bTun || '?'); }
    }, 300);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-lp]'); if (!el || !el.hasAttribute('data-re')) return;
    setP(L, el.dataset.lp, el.type === 'checkbox' ? el.checked : el.value); save(); render();
  });
  // click on the picture: open (scroll to) the matching section and flash it
  const go = (id) => { const s = root.querySelector(`#${id}`); if (!s) return; s.scrollIntoView({ behavior: 'smooth', block: 'center' }); s.classList.remove('lk-flash'); void s.offsetWidth; s.classList.add('lk-flash'); };
  root.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-lk-go]'); if (g) return go(g.dataset.lkGo);
    const b = e.target.closest('button'); if (!b) return;
    const t = T();
    if (b.dataset.lkadd) { L[b.dataset.lkadd].push({ name: '', ip: '', svc: 'all', ports: '', mac: '' }); save(); render(); }
    else if (b.dataset.lkdel) { const [k, i] = b.dataset.lkdel.split('.'); L[k].splice(+i, 1); save(); render(); }
    else if (b.hasAttribute('data-lkkeys')) { if (confirm(t.keysConfirm)) ensureKeys(true); }
    else if (b.hasAttribute('data-lkreset')) { if (confirm(t.resetConfirm)) { L = defaultLink(); save(); render(); } }
    else if (b.dataset.lkucopy && res && !res.errors.length) { await navigator.clipboard.writeText(b.dataset.lkucopy === 'A' ? res.aUndo : res.bUndo); toast('✓'); }
    else if (b.dataset.lkudl && res && !res.errors.length) {
      const x = b.dataset.lkudl, a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([x === 'A' ? res.aUndo : res.bUndo], { type: 'text/plain' }));
      a.download = fileName(x === 'A' ? L.a.name : L.b.name).replace('-office-link-', '-office-link-undo-'); a.click();
    }
    else if (b.dataset.lkcopy && res && !res.errors.length) { await navigator.clipboard.writeText(b.dataset.lkcopy === 'A' ? res.a : res.b); toast('✓'); }
    else if (b.dataset.lkdl && res && !res.errors.length) {
      const x = b.dataset.lkdl, a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([x === 'A' ? res.a : res.b], { type: 'text/plain' }));
      a.download = fileName(x === 'A' ? L.a.name : L.b.name); a.click();
    }
  });
  root.addEventListener('keydown', (e) => { const g = e.target.closest?.('[data-lk-go]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(g.dataset.lkGo); } });

  return { render, tab: () => T().tab };
}
