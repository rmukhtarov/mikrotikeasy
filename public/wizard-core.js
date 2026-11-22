// Deterministic RouterOS v7 / v6 config builder for the setup wizard.
// Pure module (no DOM): used by the browser UI and by the server for validation.

export const DEVICE_PORTS = {
  any: { ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'], wifi: false, bw: 'no' },
  'hex-s': { ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'sfp1'], wifi: false, bw: 'no' },
  'hap-ax': { label: 'hAP ax2 / ax3 / ax lite', ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'], wifi: 'wifi', bw: 'no', v7only: true },
  // hAP ac2/ac3 and the LTE models use the classic wireless package (wlan1 = 2.4 GHz, wlan2 = 5 GHz)
  'hap-ac': { label: 'hAP ac2 / ac3', ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'], wifi: 'wireless', bw: 'no' },
  'lte-builtin': { label: 'hAP ac3 LTE6 / Chateau LTE / LtAP (LTE)', ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'], wifi: 'wireless', wlan2Optional: true, bw: 'no', lteBuiltin: true },
  rb3011: { ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'ether6', 'ether7', 'ether8', 'ether9', 'ether10', 'sfp1'], wifi: false, bw: 'full' },
  rb4011: { ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'ether6', 'ether7', 'ether8', 'ether9', 'ether10', 'sfp-sfpplus1'], wifi: false, bw: 'no' },
  rb5009: { ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'ether6', 'ether7', 'ether8', 'sfp-sfpplus1'], wifi: false, bw: 'no', v7only: true },
  rb2011: { ports: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'ether6', 'ether7', 'ether8', 'ether9', 'ether10', 'sfp1'], wifi: false, bw: 'partial', bwRx: ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'sfp1'] },
  ccr: { ports: ['ether1', ...Array.from({ length: 12 }, (_, i) => `sfp-sfpplus${i + 1}`)], wifi: false, bw: 'no' },
  chr: { ports: ['ether1', 'ether2', 'ether3', 'ether4'], wifi: false, bw: 'no', noLte: true },
};

// ---------- IPv4 helpers ----------
export const ip2int = (s) => {
  const p = String(s).trim().split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || +x > 255)) return null;
  return ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + +p[3];
};
export const int2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
export function subnet(ip, prefix) {
  const a = ip2int(ip), p = Number(prefix);
  if (a === null || !(p >= 8 && p <= 30)) return null;
  const mask = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
  const net = (a & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
  return { ip: a, prefix: p, net, bc, first: net + 1, last: bc - 1, cidr: `${int2ip(net)}/${p}`, size: bc - net - 1 };
}
export function defaultPool(ip, prefix) {
  const s = subnet(ip, prefix); if (!s) return null;
  const start = s.size > 40 ? s.first + 9 : s.first + 1;
  return { start: int2ip(start), end: int2ip(s.last) };
}
// "a.b.c.d", "a.b.c.d/nn" or "a.b.c.d-e.f.g.h" -> list of CIDRs (queue targets accept prefixes, not ranges)
export function toCidrs(text) {
  const t = String(text || '').trim();
  if (/^[\d.]+\/\d+$/.test(t)) { const [ip, p] = t.split('/'); return ip2int(ip) !== null && +p >= 0 && +p <= 32 ? [t] : null; }
  const [a0, b0] = t.split('-').map((x) => x.trim());
  let a = ip2int(a0), b = b0 === undefined ? a : ip2int(b0);
  if (a === null || b === null || a > b) return null;
  const out = [];
  while (a <= b) {
    let size = 32;
    while (size > 0) {
      const mask = (0xffffffff << (33 - size)) >>> 0;
      const block = 2 ** (33 - size);
      if ((a & mask) >>> 0 !== a || a + block - 1 > b) break;
      size--;
    }
    out.push(`${int2ip(a)}/${size}`);
    a += 2 ** (32 - size);
  }
  return out;
}
const inNet = (s, n) => n !== null && n >= s.first && n <= s.last;
const overlaps = (a, b) => a.net <= b.bc && b.net <= a.bc;

// RouterOS string literal
const q = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\?/g, '\\?')}"`;
const rate = (v) => { const t = String(v || '').trim(); if (!t) return ''; return /^\d+(\.\d+)?$/.test(t) ? `${t}M` : t.replace(/\s+/g, ''); };
// iwik.org country lists: two-letter codes, upper case
export const geoList = (s) => [...new Set(String(s || '').toUpperCase().split(/[\s,;]+/).filter(Boolean))];
// only ranges that can never be a real internet source; private and CGNAT ranges are left out on purpose
// (many ISPs, LTE operators and upstream routers hand out 10.x / 100.64.x / 192.168.x WAN addresses)
const BOGONS = ['0.0.0.0/8', '127.0.0.0/8', '169.254.0.0/16', '192.0.0.0/24', '192.0.2.0/24', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '240.0.0.0/4'];
// RouterOS terminals break on non-ASCII text: transliterate AZ/RU descriptions for comment=
const TR = { 'ə': 'e', 'Ə': 'E', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S', 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
export const ascii = (s) => String(s || '').split('').map((ch) => TR[ch] ?? (TR[ch.toLowerCase()] ? TR[ch.toLowerCase()].toUpperCase() : ch)).join('').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 60);
const validRate = (v) => !String(v || '').trim() || /^\d+(\.\d+)?\s*[kKmMgG]?$/.test(String(v).trim());

const MSG = {
  az: {
    badIp: (f) => `${f}: IP ünvanı düzgün deyil.`, badPrefix: (f) => `${f}: maska (prefix) 8 ilə 30 arasında olmalıdır.`,
    need: (f) => `${f} doldurulmalıdır.`, poolOut: 'DHCP aralığı LAN şəbəkəsindən kənardadır.', poolOrder: 'DHCP aralığının başlanğıcı sonundan böyükdür.',
    samePort: 'İki WAN eyni portda ola bilməz.', overlap: 'Qonaq şəbəkəsi LAN ilə üst-üstə düşür.', gwOut: (w) => `${w}: gateway həmin şəbəkədə deyil.`,
    fwdOut: (n) => `Yönləndirmə "${n}": daxili IP LAN-da deyil.`, badRate: (f) => `${f}: sürət düzgün deyil (məs. 20 və ya 20M).`, noLan: 'Heç bir LAN portu seçilməyib.',
    badGeo: 'Ölkə kodları 2 hərfli olmalıdır, vergüllə: məs. AZ, TR, GE.',
    nGeoAllow: (c) => `Ölkə filtri: port yönləndirmələrə yalnız ${c} IP-lərindən icazə var. Siyahılar iwik.org-dan router açılanda və hər gün yüklənir; ilk dəfə internet qoşulandan sonra əl ilə işlədin: /system script run geo-update. Yoxlamaq: /system script print where name=geo-update (şərhdə son uğurlu yeniləmə tarixi və ya PROBLEM yazılır). Yüklənən fayl qırıqdırsa, köhnə siyahı saxlanır. Siyahı yüklənməyibsə, yönləndirmələr bağlı qalır. Diqqət: /import yüklənən faylı skript kimi icra edir, yəni router hər gün iwik.org-a etibar edir (HTTPS ilə yüklənir).`,
    nGeoBlock: (c) => `Ölkə filtri: ${c} IP-lərindən port yönləndirmələrə giriş bloklanır. Siyahılar iwik.org-dan hər gün yenilənir; ilk dəfə: /system script run geo-update. Yoxlamaq: /system script print where name=geo-update (şərhdə son uğurlu yeniləmə tarixi və ya PROBLEM yazılır), /log print where message~"geo-update". Yüklənən fayl qırıqdırsa, köhnə siyahı saxlanır. Böyük ölkələrin (US, CN) siyahısı on minlərlə sətirdir və zəif router-lərdə yaddaş tutur. Diqqət: /import yüklənən faylı skript kimi icra edir, yəni router hər gün iwik.org-a etibar edir (HTTPS ilə yüklənir).`,
    noLte: 'Virtual router-də (CHR) LTE modem yoxdur.', sameLte: 'İki WAN eyni LTE interfeysində ola bilməz.',
    nLte: 'LTE: modemi əvvəlcədən yoxlayın: /interface lte print (lte1 görünməlidir) və /interface lte monitor lte1 once (registration-status: registered). USB modem görünmürsə, o bu RouterOS versiyasında dəstəklənmir və ya "CD-ROM" rejimindədir. Modemin MikroTik uyğunluq siyahısında olduğuna baxın.',
    nLteData: 'LTE ehtiyat xəttdirsə, failover yoxlaması (ping) ayda təxminən bir neçə MB trafik sərf edir. Limitli tarifdə bunu nəzərə alın.',
    camName: 'Kamera şəbəkəsi', overlapCam: 'Kamera şəbəkəsi LAN və ya qonaq şəbəkəsi ilə üst-üstə düşür.',
    nCamNoNet: 'Kamera şəbəkəsi: kameralar LAN-ı görmür və internetə yalnız saat (NTP) üçün çıxır, buludlara və istehsalçı serverlərinə video göndərə bilmir. LAN-dan kameralara baxmaq olur.',
    nCamNet: 'Kamera şəbəkəsi: kameralar LAN-ı görmür, internetə çıxışı var. LAN-dan kameralara baxmaq olur.',
    noV6: 'Bu model RouterOS 6-nı dəstəkləmir, yalnız v7.', nV6: 'RouterOS 6 üçün ən azı 6.45 lazımdır (tövsiyə: long-term 6.49.x). Köhnə versiyada əvvəlcə yeniləyin: System → Packages → Check For Updates, kanal long-term.',
    wifiPass: 'WiFi parolu ən azı 8 simvol olmalıdır.', checkSame: 'Failover yoxlama ünvanları fərqli olmalıdır.',
    nFasttrack: 'Sürət limitləri olduğu üçün FastTrack söndürülüb (yoxsa limitlər işləməz). CPU yükü bir az artacaq.',
    nBwPartial: 'RB2011-də upload limiti yalnız ether1-5 və sfp1-də işləyir.', nNoPass: 'Admin parolu verilməyib: tətbiqdən sonra mütləq parol qoyun.',
    nDhcpFailover: 'Ehtiyat yoxlama: DHCP WAN-ın gateway-i dəyişəndə yoxlama marşrutu skript ilə avtomatik yenilənir.',
    nReset: 'Skripti təmiz router-ə tətbiq edin: /system reset-configuration no-defaults=yes, sonra Winbox ilə MAC üzərindən LAN portuna qoşulub New Terminal-a yapışdırın.',
    nRecursive: (a, b) => `Failover: əsas xətt ${a} ünvanı ilə yoxlanır${b ? `, ehtiyat xətt ${b} ilə` : ''}. Ünvan cavab verməyəndə trafik ehtiyat xəttə keçir (yalnız kabel deyil, provayderin özü düşəndə də).`,
    nSimple: 'Failover: əsas xəttin gateway-i cavab verməyəndə ehtiyat xəttə keçid.',
  },
  ru: {
    badIp: (f) => `${f}: неверный IP-адрес.`, badPrefix: (f) => `${f}: маска (префикс) должна быть от 8 до 30.`,
    need: (f) => `Заполните поле ${f}.`, poolOut: 'Диапазон DHCP выходит за пределы сети LAN.', poolOrder: 'Начало диапазона DHCP больше конца.',
    samePort: 'Два WAN не могут быть на одном порту.', overlap: 'Гостевая сеть пересекается с LAN.', gwOut: (w) => `${w}: шлюз не в этой сети.`,
    fwdOut: (n) => `Проброс "${n}": внутренний IP не в LAN.`, badRate: (f) => `${f}: неверная скорость (напр. 20 или 20M).`, noLan: 'Не выбран ни один LAN-порт.',
    badGeo: 'Коды стран — 2 буквы через запятую, например AZ, TR, GE.',
    nGeoAllow: (c) => `Фильтр стран: проброс портов разрешён только с IP ${c}. Списки загружаются с iwik.org при старте роутера и раз в сутки; в первый раз после подключения интернета запустите вручную: /system script run geo-update. Проверка: /system script print where name=geo-update (в комментарии дата последнего успешного обновления или PROBLEM). При битой загрузке остаётся старый список. Пока список не загружен, проброс закрыт. Внимание: /import выполняет загруженный файл как скрипт, то есть роутер ежедневно доверяет iwik.org (загрузка по HTTPS).`,
    nGeoBlock: (c) => `Фильтр стран: доступ к пробросам с IP ${c} блокируется. Списки обновляются с iwik.org раз в сутки; в первый раз: /system script run geo-update. Проверка: /system script print where name=geo-update (в комментарии дата последнего успешного обновления или PROBLEM), /log print where message~"geo-update". При битой загрузке остаётся старый список. Списки крупных стран (US, CN) — десятки тысяч строк и занимают память на слабых роутерах. Внимание: /import выполняет загруженный файл как скрипт, то есть роутер ежедневно доверяет iwik.org (загрузка по HTTPS).`,
    noLte: 'У виртуального роутера (CHR) нет LTE-модема.', sameLte: 'Два WAN не могут использовать один LTE-интерфейс.',
    nLte: 'LTE: заранее проверьте модем: /interface lte print (должен быть lte1) и /interface lte monitor lte1 once (registration-status: registered). Если USB-модема нет в списке, он не поддерживается этой версией RouterOS или находится в режиме "CD-ROM". Сверьтесь со списком совместимости MikroTik.',
    nLteData: 'Если LTE резервный, проверка failover (ping) расходует примерно несколько МБ в месяц. Учтите это на лимитном тарифе.',
    camName: 'Сеть камер', overlapCam: 'Сеть камер пересекается с LAN или гостевой сетью.',
    nCamNoNet: 'Сеть камер: камеры не видят LAN и выходят в интернет только для синхронизации времени (NTP), не могут отправлять видео в облака производителя. Из LAN камеры смотреть можно.',
    nCamNet: 'Сеть камер: камеры не видят LAN, доступ в интернет есть. Из LAN камеры смотреть можно.',
    noV6: 'Эта модель не поддерживает RouterOS 6, только v7.', nV6: 'Для RouterOS 6 нужна версия не ниже 6.45 (рекомендуется long-term 6.49.x). На старой версии сначала обновитесь: System → Packages → Check For Updates, канал long-term.',
    wifiPass: 'Пароль WiFi должен быть не короче 8 символов.', checkSame: 'Адреса проверки failover должны различаться.',
    nFasttrack: 'Из-за ограничений скорости FastTrack отключён (иначе лимиты не работают). Нагрузка на CPU немного вырастет.',
    nBwPartial: 'На RB2011 ограничение upload работает только на ether1-5 и sfp1.', nNoPass: 'Пароль admin не задан: обязательно задайте его после применения.',
    nDhcpFailover: 'При смене шлюза DHCP-WAN маршрут проверки обновляется скриптом автоматически.',
    nReset: 'Применяйте на чистый роутер: /system reset-configuration no-defaults=yes, затем подключитесь Winbox по MAC к LAN-порту и вставьте в New Terminal.',
    nRecursive: (a, b) => `Failover: основной канал проверяется по ${a}${b ? `, резервный по ${b}` : ''}. Если адрес не отвечает, трафик уходит на резерв (даже если упал сам провайдер, а не кабель).`,
    nSimple: 'Failover: переключение на резерв, когда шлюз основного канала не отвечает.',
  },
  en: {
    badIp: (f) => `${f}: invalid IP address.`, badPrefix: (f) => `${f}: prefix must be between 8 and 30.`,
    need: (f) => `${f} is required.`, poolOut: 'DHCP range is outside the LAN subnet.', poolOrder: 'DHCP range start is after its end.',
    samePort: 'Both WANs cannot use the same port.', overlap: 'Guest network overlaps the LAN.', gwOut: (w) => `${w}: gateway is not in that subnet.`,
    fwdOut: (n) => `Forward "${n}": internal IP is not in the LAN.`, badRate: (f) => `${f}: invalid speed (e.g. 20 or 20M).`, noLan: 'No LAN port selected.',
    badGeo: 'Country codes are 2 letters, comma separated, e.g. AZ, TR, GE.',
    nGeoAllow: (c) => `Country filter: port forwards are open only to IPs from ${c}. Lists are loaded from iwik.org at boot and daily; the first time, run it by hand once the internet is up: /system script run geo-update. To check: /system script print where name=geo-update (the comment shows the last good update or PROBLEM). A broken download keeps the old list. Until a list is loaded, the forwards stay closed. Note: /import runs the downloaded file as a script, so the router trusts iwik.org every day (downloaded over HTTPS).`,
    nGeoBlock: (c) => `Country filter: IPs from ${c} are blocked from the port forwards. Lists refresh daily from iwik.org; the first time: /system script run geo-update. To check: /system script print where name=geo-update (the comment shows the last good update or PROBLEM), /log print where message~"geo-update". A broken download keeps the old list. Lists of large countries (US, CN) have tens of thousands of lines and use memory on small routers. Note: /import runs the downloaded file as a script, so the router trusts iwik.org every day (downloaded over HTTPS).`,
    noLte: 'A virtual router (CHR) has no LTE modem.', sameLte: 'Both WANs cannot use the same LTE interface.',
    nLte: 'LTE: check the modem first: /interface lte print (lte1 must be listed) and /interface lte monitor lte1 once (registration-status: registered). If a USB modem is not listed, this RouterOS version does not support it or it is in "CD-ROM" mode. Check the MikroTik compatibility list.',
    nLteData: 'With LTE as the backup, the failover check (ping) uses roughly a few MB per month. Keep that in mind on a capped plan.',
    camName: 'Camera network', overlapCam: 'The camera network overlaps the LAN or the guest network.',
    nCamNoNet: 'Camera network: cameras cannot see the LAN and reach the internet only for time sync (NTP), so they cannot send video to vendor clouds. The LAN can still watch them.',
    nCamNet: 'Camera network: cameras cannot see the LAN and have internet access. The LAN can still watch them.',
    noV6: 'This model does not support RouterOS 6, only v7.', nV6: 'RouterOS 6 needs at least 6.45 (recommended: long-term 6.49.x). On an older version upgrade first: System → Packages → Check For Updates, channel long-term.',
    wifiPass: 'WiFi password must be at least 8 characters.', checkSame: 'Failover check addresses must differ.',
    nFasttrack: 'FastTrack is disabled because speed limits are used (limits do not work with it). CPU load will be a bit higher.',
    nBwPartial: 'On RB2011 the upload limit works only on ether1-5 and sfp1.', nNoPass: 'No admin password given: set one right after applying.',
    nDhcpFailover: 'When the DHCP WAN gateway changes, the check route is updated by a script automatically.',
    nReset: 'Apply to a clean router: /system reset-configuration no-defaults=yes, then connect with Winbox via MAC on a LAN port and paste into New Terminal.',
    nRecursive: (a, b) => `Failover: the main line is checked by pinging ${a}${b ? `, the backup by ${b}` : ''}. If it stops answering, traffic moves to the backup (also when the ISP itself fails, not just the cable).`,
    nSimple: 'Failover: switch to the backup when the main gateway stops answering.',
  },
};

export function defaultSpec(device = 'any') {
  const d = DEVICE_PORTS[device] || DEVICE_PORTS.any;
  const ports = {};
  d.ports.forEach((p) => { if (p !== 'ether1') ports[p] = { role: 'lan', down: '', up: '' }; });
  return {
    device, ros: '7', identity: 'MikroTik', adminPassword: '', timezone: 'Asia/Baku',
    wan1: { port: 'ether1', type: 'dhcp', ip: '', prefix: '', gateway: '', user: '', pass: '', apn: 'internet', pin: '', lteIf: 'lte1' },
    wan2: { enabled: false, port: d.ports[1] || 'ether2', type: d.lteBuiltin ? 'lte' : 'dhcp', ip: '', prefix: '', gateway: '', user: '', pass: '', apn: 'internet', pin: '', lteIf: 'lte1' },
    failover: { method: 'recursive', check1: '1.1.1.1', check2: '8.8.8.8' },
    dns: '1.1.1.1,8.8.8.8',
    lan: { address: '192.168.88.1', prefix: 24, dhcp: true, poolStart: '', poolEnd: '', lease: '1d' },
    ports,
    guest: { enabled: false, address: '192.168.200.1', prefix: 24 },
    // separate camera network: LAN can watch the cameras, cameras cannot reach the LAN; internet optional
    cams: { enabled: false, address: '192.168.50.1', prefix: 24, internet: false },
    wifi: { enabled: !!d.wifi, ssid: 'MikroTik', pass: '', guestSsid: 'MikroTik-Guest', guestPass: '', country: 'Azerbaijan' },
    forwards: [], limits: [], hairpin: true,
    security: { portscan: true, bogons: true, geoMode: 'off', geoCountries: 'AZ' },
  };
}

export function validate(spec, lang = 'en') {
  const M = MSG[lang] || MSG.en, e = [];
  if (spec.ros === '6' && DEVICE_PORTS[spec.device]?.v7only) e.push(M.noV6);
  const lan = subnet(spec.lan.address, spec.lan.prefix);
  if (ip2int(spec.lan.address) === null) e.push(M.badIp('LAN'));
  else if (!lan) e.push(M.badPrefix('LAN'));
  const wans = [['WAN1', spec.wan1], ...(spec.wan2.enabled ? [['WAN2', spec.wan2]] : [])];
  for (const [n, w] of wans) {
    if (w.type === 'static') {
      const s = subnet(w.ip, w.prefix);
      if (ip2int(w.ip) === null) e.push(M.badIp(`${n} IP`)); else if (!s) e.push(M.badPrefix(n));
      if (ip2int(w.gateway) === null) e.push(M.badIp(`${n} gateway`)); else if (s && !inNet(s, ip2int(w.gateway))) e.push(M.gwOut(n));
    }
    if (w.type === 'pppoe' && !w.user) e.push(M.need(`${n} PPPoE user`));
    if (w.type === 'lte') {
      if (DEVICE_PORTS[spec.device]?.noLte) e.push(M.noLte);
      if (!String(w.apn || '').trim()) e.push(M.need(`${n} APN`));
      if (w.pin && !/^\d{4,8}$/.test(String(w.pin))) e.push(M.need(`${n} PIN (4-8)`));
    }
  }
  const lte1 = spec.wan1.type === 'lte', lte2 = spec.wan2.type === 'lte';
  if (spec.wan2.enabled && !lte1 && !lte2 && spec.wan2.port === spec.wan1.port) e.push(M.samePort);
  if (spec.wan2.enabled && lte1 && lte2 && (spec.wan1.lteIf || 'lte1') === (spec.wan2.lteIf || 'lte1')) e.push(M.sameLte);
  if (spec.wan2.enabled && spec.failover.method === 'recursive') {
    for (const c of ['check1', 'check2']) if (ip2int(spec.failover[c]) === null) e.push(M.badIp(c));
    if (spec.failover.check1 === spec.failover.check2) e.push(M.checkSame);
  }
  if (lan && spec.lan.dhcp) {
    const def = defaultPool(spec.lan.address, spec.lan.prefix);
    const a = ip2int(spec.lan.poolStart || def.start), b = ip2int(spec.lan.poolEnd || def.end);
    if (a === null || b === null) e.push(M.badIp('DHCP'));
    else if (!inNet(lan, a) || !inNet(lan, b)) e.push(M.poolOut);
    else if (a > b) e.push(M.poolOrder);
  }
  const roles = Object.entries(spec.ports).filter(([p]) => !(spec.wan1.type !== 'lte' && p === spec.wan1.port) && !(spec.wan2.enabled && spec.wan2.type !== 'lte' && p === spec.wan2.port));
  if (!roles.some(([, v]) => v.role === 'lan') && !(spec.wifi.enabled && DEVICE_PORTS[spec.device]?.wifi)) e.push(M.noLan);
  for (const [p, v] of roles) for (const k of ['down', 'up']) if (!validRate(v[k])) e.push(M.badRate(`${p} ${k}`));
  if (spec.guest.enabled) {
    const g = subnet(spec.guest.address, spec.guest.prefix);
    if (!g) e.push(M.badIp('Guest')); else if (lan && overlaps(g, lan)) e.push(M.overlap);
  }
  const cm = spec.cams || {};
  if (cm.enabled) {
    const c = subnet(cm.address, cm.prefix);
    const g = spec.guest.enabled ? subnet(spec.guest.address, spec.guest.prefix) : null;
    if (!c) e.push(M.badIp(M.camName)); else if ((lan && overlaps(c, lan)) || (g && overlaps(c, g))) e.push(M.overlapCam);
  }
  if (spec.wifi.enabled && DEVICE_PORTS[spec.device]?.wifi) {
    if ((spec.wifi.pass || '').length < 8) e.push(M.wifiPass);
    if (spec.guest.enabled && spec.wifi.guestPass && spec.wifi.guestPass.length < 8) e.push(M.wifiPass);
  }
  for (const f of spec.forwards) {
    if (ip2int(f.ip) === null) e.push(M.badIp(`Forward ${f.name || ''}`));
    else if (lan && !inNet(lan, ip2int(f.ip)) && !(cm.enabled && subnet(cm.address, cm.prefix) && inNet(subnet(cm.address, cm.prefix), ip2int(f.ip)))) e.push(M.fwdOut(f.name || f.ip));
    if (!/^\d+(-\d+)?$/.test(String(f.extPort || ''))) e.push(M.need(`Forward ${f.name || ''} port`));
  }
  const sv = spec.security || {};
  if (sv.geoMode && sv.geoMode !== 'off' && spec.forwards.length) {
    const cc = geoList(sv.geoCountries);
    if (!cc.length || cc.some((c) => !/^[A-Z]{2}$/.test(c))) e.push(M.badGeo);
  }
  for (const l of spec.limits) {
    if (!toCidrs(l.target)) e.push(M.badIp(`${l.name || 'Limit'}: ${l.target}`));
    for (const k of ['down', 'up']) if (!validRate(l[k])) e.push(M.badRate(`${l.target} ${k}`));
  }
  return e;
}

export function build(spec, lang = 'en') {
  const M = MSG[lang] || MSG.en;
  const errors = validate(spec, lang);
  if (errors.length) return { errors, script: '', notes: [] };
  const dev = DEVICE_PORTS[spec.device] || DEVICE_PORTS.any;
  const notes = [M.nReset, ...(spec.ros === '6' ? [M.nV6] : [])], o = [];
  const add = (...l) => o.push(...l);
  const lan = subnet(spec.lan.address, spec.lan.prefix);
  const guest = spec.guest.enabled ? subnet(spec.guest.address, spec.guest.prefix) : null;
  const wans = [{ n: 1, ...spec.wan1 }, ...(spec.wan2.enabled ? [{ n: 2, ...spec.wan2 }] : [])];
  const wanIf = (w) => (w.type === 'pppoe' ? `pppoe-wan${w.n}` : w.type === 'lte' ? (w.lteIf || 'lte1') : w.port);
  const isWan = (p) => wans.some((w) => w.type !== 'lte' && w.port === p);
  const portList = Object.entries(spec.ports).filter(([p]) => !isWan(p));
  const lanPorts = portList.filter(([, v]) => v.role === 'lan').map(([p]) => p);
  const guestPorts = guest ? portList.filter(([, v]) => v.role === 'guest').map(([p]) => p) : [];
  const cams = spec.cams?.enabled ? subnet(spec.cams.address, spec.cams.prefix) : null;
  const camPorts = cams ? portList.filter(([, v]) => v.role === 'cam').map(([p]) => p) : [];
  const offPorts = portList.filter(([, v]) => v.role === 'off' || (v.role === 'guest' && !guest) || (v.role === 'cam' && !cams)).map(([p]) => p);
  const v6 = spec.ros === '6';
  const wifiOn = spec.wifi.enabled && !!dev.wifi && !(v6 && dev.wifi === 'wifi');
  const limitsOn = spec.limits.length > 0;
  const failover = wans.length === 2;
  // ---- security extras ----
  const sec = { portscan: false, bogons: false, geoMode: 'off', geoCountries: 'AZ', ...(spec.security || {}) };
  const geoCc = geoList(sec.geoCountries);
  const geoOn = sec.geoMode !== 'off' && spec.forwards.length > 0 && geoCc.length > 0;


  add(`# RouterOS v${v6 ? 6 : 7} configuration generated by MikrotikEasy`,
    `# Device: ${spec.device}  Generated: ${new Date().toISOString().slice(0, 10)}`,
    '# Apply on a clean router: /system reset-configuration no-defaults=yes skip-backup=no',
    '# then connect with Winbox via MAC address on a LAN port, open New Terminal and paste.', '');

  add('# --- System ---', `/system identity set name=${q(spec.identity || 'MikroTik')}`);
  if (spec.timezone) add(`/system clock set time-zone-autodetect=no time-zone-name=${spec.timezone}`);
  if (v6) add('/system ntp client set enabled=yes server-dns-names=pool.ntp.org', '');
  else add('/system ntp client set enabled=yes', '/system ntp client servers add address=pool.ntp.org', '');

  add('# --- Interface lists ---', '/interface list add name=WAN', '/interface list add name=LAN');
  if (guest) add('/interface list add name=GUEST');
  if (cams) add('/interface list add name=CAM');
  add('');

  add('# --- LAN bridge ---', '/interface bridge add name=bridge-lan protocol-mode=rstp comment="LAN"');
  lanPorts.forEach((p) => add(`/interface bridge port add bridge=bridge-lan interface=${p}`));
  if (guest) {
    add('/interface bridge add name=bridge-guest protocol-mode=rstp comment="Guest"');
    guestPorts.forEach((p) => add(`/interface bridge port add bridge=bridge-guest interface=${p}`));
  }
  if (cams) {
    add('/interface bridge add name=bridge-cam protocol-mode=rstp comment="Cameras"');
    camPorts.forEach((p) => add(`/interface bridge port add bridge=bridge-cam interface=${p}`));
  }
  offPorts.forEach((p) => add(`/interface ethernet set [find default-name=${p}] disabled=yes comment=${q(ascii(spec.ports[p]?.desc) || 'unused')}`));
  // what the user wrote is plugged into each port (shown in Winbox next to the port)
  [...lanPorts, ...guestPorts, ...camPorts].forEach((p) => { const d = ascii(spec.ports[p]?.desc); if (d) add(`/interface ethernet set [find default-name=${p}] comment=${q(d)}`); });
  add('');

  if (wifiOn && dev.wifi === 'wireless') {
    const country = String(spec.wifi.country || 'Azerbaijan').toLowerCase();
    const prof = (name, pass) => pass
      ? `/interface wireless security-profiles add name=${name} mode=dynamic-keys authentication-types=wpa2-psk wpa2-pre-shared-key=${q(pass)}`
      : `/interface wireless security-profiles add name=${name} mode=none`;
    add('# --- WiFi (wireless package: wlan1 = 2.4 GHz, wlan2 = 5 GHz) ---', prof('wifi-lan', spec.wifi.pass));
    if (guest) add(prof('wifi-guest', spec.wifi.guestPass));
    const radio = (w, band, width) => {
      const l = [`/interface wireless set [find default-name=${w}] mode=ap-bridge band=${band} channel-width=${width} frequency=auto ssid=${q(spec.wifi.ssid)} security-profile=wifi-lan country=${q(country)} installation=indoor wireless-protocol=802.11 disabled=no`,
        `/interface bridge port add bridge=bridge-lan interface=${w}`];
      if (guest) l.push(`/interface wireless add name=${w}-guest master-interface=${w} ssid=${q(spec.wifi.guestSsid || `${spec.wifi.ssid}-Guest`)} security-profile=wifi-guest default-forwarding=no disabled=no`,
        `/interface bridge port add bridge=bridge-guest interface=${w}-guest`);
      return l;
    };
    add(...radio('wlan1', '2ghz-b/g/n', '20/40mhz-XX'));
    const r5 = radio('wlan2', '5ghz-a/n/ac', '20/40/80mhz-XXXX');
    // some LTE models (LtAP) have only a 2.4 GHz radio: configure wlan2 only when it exists
    if (dev.wlan2Optional) add(`:if ([:len [/interface wireless find default-name=wlan2]] > 0) do={ ${r5.join('; ')} }`);
    else add(...r5);
    add('');
  }
  if (wifiOn && dev.wifi === 'wifi') {
    const sec = (pass) => (pass ? `security.authentication-types=wpa2-psk,wpa3-psk security.passphrase=${q(pass)}` : 'security.authentication-types=""');
    add('# --- WiFi ---');
    for (const w of ['wifi1', 'wifi2']) {
      add(`/interface wifi set [find default-name=${w}] configuration.mode=ap configuration.ssid=${q(spec.wifi.ssid)} configuration.country=${q(spec.wifi.country || 'Azerbaijan')} ${sec(spec.wifi.pass)} disabled=no`);
      add(`/interface bridge port add bridge=bridge-lan interface=${w}`);
      if (guest) {
        add(`/interface wifi add name=${w}-guest master-interface=${w} configuration.mode=ap configuration.ssid=${q(spec.wifi.guestSsid || `${spec.wifi.ssid}-Guest`)} ${sec(spec.wifi.guestPass)} datapath.client-isolation=yes disabled=no`);
        add(`/interface bridge port add bridge=bridge-guest interface=${w}-guest`);
      }
    }
    add('');
  }

  add('# --- Internet ---');
  for (const w of wans) {
    const dist = w.n;
    const recursive = failover && spec.failover.method === 'recursive';
    const check = w.n === 1 ? spec.failover.check1 : spec.failover.check2;
    if (w.type === 'lte') {
      const lif = wanIf(w);
      add(`/interface lte apn add name=wan${w.n}-apn apn=${q(String(w.apn || 'internet').trim())} use-peer-dns=yes add-default-route=${recursive ? 'no' : 'yes'} default-route-distance=${dist} comment="WAN${w.n}"`);
      add(`/interface lte set [find name=${lif}] apn-profiles=wan${w.n}-apn${w.pin ? ` pin=${q(w.pin)}` : ''} disabled=no comment="WAN${w.n}"`);
    } else if (w.type === 'pppoe') {
      add(`/interface pppoe-client add name=pppoe-wan${w.n} interface=${w.port} user=${q(w.user)} password=${q(w.pass || '')} use-peer-dns=yes add-default-route=${recursive ? 'no' : 'yes'} default-route-distance=${dist} disabled=no comment="WAN${w.n}"`);
    } else if (w.type === 'static') {
      const s = subnet(w.ip, w.prefix);
      add(`/ip address add address=${w.ip}/${s.prefix} interface=${w.port} comment="WAN${w.n}"`);
      if (!recursive) add(`/ip route add dst-address=0.0.0.0/0 gateway=${w.gateway} distance=${dist}${failover ? ' check-gateway=ping' : ''} comment="WAN${w.n} default"`);
    } else {
      if (recursive) {
        add(`/ip route add dst-address=${check}/32 gateway=${w.port} scope=10 comment="WAN${w.n} check"`);
        add(`/ip dhcp-client add interface=${w.port} use-peer-dns=yes add-default-route=no comment="WAN${w.n}" script=${q(`:if ($bound=1) do={/ip route set [find comment="WAN${w.n} check"] gateway=$"gateway-address"}`)} disabled=no`);
      } else {
        if (v6 && failover) {
          // v6 dhcp-client has no check-gateway: keep a static default route with check-gateway, refreshed by the lease script
          const sc = `:if ($bound=1) do={/ip route remove [find comment="WAN${w.n} default"]; /ip route add dst-address=0.0.0.0/0 gateway=$"gateway-address" distance=${dist} check-gateway=ping comment="WAN${w.n} default"} else={/ip route remove [find comment="WAN${w.n} default"]}`;
          add(`/ip dhcp-client add interface=${w.port} use-peer-dns=yes add-default-route=no comment="WAN${w.n}" script=${q(sc)} disabled=no`);
        } else add(`/ip dhcp-client add interface=${w.port} use-peer-dns=yes add-default-route=yes default-route-distance=${dist}${failover ? ' check-gateway=ping' : ''} comment="WAN${w.n}" disabled=no`);
      }
    }
    if (recursive) {
      if (w.type !== 'dhcp') add(`/ip route add dst-address=${check}/32 gateway=${w.type === 'pppoe' || w.type === 'lte' ? wanIf(w) : w.gateway} scope=10 comment="WAN${w.n} check"`);
      add(`/ip route add dst-address=0.0.0.0/0 gateway=${check} target-scope=11 check-gateway=ping distance=${dist} comment="WAN${w.n} default via ${check}"`);
    }
    add(`/interface list member add interface=${wanIf(w)} list=WAN`);
  }
  if (wans.some((w) => w.type === 'lte')) { notes.push(M.nLte); if (failover) notes.push(M.nLteData); }
  if (failover) {
    notes.push(spec.failover.method === 'recursive' ? M.nRecursive(spec.failover.check1, spec.failover.check2) : M.nSimple);
    if (spec.failover.method === 'recursive' && wans.some((w) => w.type === 'dhcp')) notes.push(M.nDhcpFailover);
  }
  add('');

  add('# --- LAN addressing and DHCP ---', `/ip address add address=${spec.lan.address}/${lan.prefix} interface=bridge-lan comment="LAN"`);
  add('/interface list member add interface=bridge-lan list=LAN');
  const pool = (s, start, end, gw) => {
    const a = ip2int(start), b = ip2int(end), g = ip2int(gw);
    if (g >= a && g <= b) return [g > a ? `${int2ip(a)}-${int2ip(g - 1)}` : null, g < b ? `${int2ip(g + 1)}-${int2ip(b)}` : null].filter(Boolean).join(',');
    return `${start}-${end}`;
  };
  if (spec.lan.dhcp) {
    const def = defaultPool(spec.lan.address, spec.lan.prefix);
    add(`/ip pool add name=pool-lan ranges=${pool(lan, spec.lan.poolStart || def.start, spec.lan.poolEnd || def.end, spec.lan.address)}`);
    add(`/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=pool-lan lease-time=${spec.lan.lease || '1d'} disabled=no`);
    add(`/ip dhcp-server network add address=${lan.cidr} gateway=${spec.lan.address} dns-server=${spec.lan.address}`);
  }
  if (guest) {
    const def = defaultPool(spec.guest.address, spec.guest.prefix);
    add(`/ip address add address=${spec.guest.address}/${guest.prefix} interface=bridge-guest comment="Guest"`,
      '/interface list member add interface=bridge-guest list=GUEST',
      `/ip pool add name=pool-guest ranges=${pool(guest, def.start, def.end, spec.guest.address)}`,
      '/ip dhcp-server add name=dhcp-guest interface=bridge-guest address-pool=pool-guest lease-time=2h disabled=no',
      `/ip dhcp-server network add address=${guest.cidr} gateway=${spec.guest.address} dns-server=${spec.guest.address}`);
  }
  if (cams) {
    const def = defaultPool(spec.cams.address, spec.cams.prefix);
    add(`/ip address add address=${spec.cams.address}/${cams.prefix} interface=bridge-cam comment="Cameras"`,
      '/interface list member add interface=bridge-cam list=CAM',
      `/ip pool add name=pool-cam ranges=${pool(cams, def.start, def.end, spec.cams.address)}`,
      '/ip dhcp-server add name=dhcp-cam interface=bridge-cam address-pool=pool-cam lease-time=1d disabled=no',
      `/ip dhcp-server network add address=${cams.cidr} gateway=${spec.cams.address} dns-server=${spec.cams.address}`);
    notes.push(spec.cams.internet ? M.nCamNet : M.nCamNoNet);
  }
  add('');

  const dns = String(spec.dns || '').split(/[\s,]+/).filter((x) => ip2int(x) !== null);
  add('# --- DNS ---', `/ip dns set allow-remote-requests=yes${dns.length ? ` servers=${dns.join(',')}` : ''}`, '');

  const bwPorts = portList.filter(([, v]) => v.down || v.up);
  if (bwPorts.length && dev.bw !== 'no') {
    add('# --- Port speed limits (switch chip, rx = upload from the device, tx = download to it) ---');
    for (const [p, v] of bwPorts) add(`/interface ethernet set [find default-name=${p}] bandwidth=${rate(v.up) || 'unlimited'}/${rate(v.down) || 'unlimited'}`);
    if (dev.bw === 'partial' && bwPorts.some(([p, v]) => v.up && !dev.bwRx.includes(p))) notes.push(M.nBwPartial);
    add('');
  }
  if (limitsOn) {
    add('# --- Device / IP range speed limits (max-limit = upload/download) ---');
    spec.limits.forEach((l, i) => add(`/queue simple add name=${q(l.name || `limit-${i + 1}`)} target=${toCidrs(l.target).join(',')} max-limit=${rate(l.up) || '0'}/${rate(l.down) || '0'}`));
    notes.push(M.nFasttrack);
    add('');
  }

  add('# --- Firewall ---', '/ip firewall filter',
    'add chain=input action=accept connection-state=established,related,untracked comment="accept established"',
    'add chain=input action=drop connection-state=invalid comment="drop invalid"',
    'add chain=input action=accept protocol=icmp comment="accept ICMP"',
    'add chain=input action=accept in-interface-list=LAN comment="accept from LAN"');
  if (guest) add('add chain=input action=accept in-interface-list=GUEST protocol=udp dst-port=53,67 comment="guest DNS and DHCP"',
    'add chain=input action=accept in-interface-list=GUEST protocol=tcp dst-port=53 comment="guest DNS tcp"');
  if (cams) add('add chain=input action=accept in-interface-list=CAM protocol=udp dst-port=53,67 comment="cameras DNS and DHCP"');
  if (sec.portscan) add('add chain=input action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w protocol=tcp psd=21,3s,3,1 connection-state=new in-interface-list=WAN comment="detect port scanners"');
  add('add chain=input action=drop comment="drop everything else"');
  if (!limitsOn) add('add chain=forward action=fasttrack-connection connection-state=established,related comment="fasttrack"');
  add('add chain=forward action=accept connection-state=established,related,untracked comment="accept established"',
    'add chain=forward action=drop connection-state=invalid comment="drop invalid"',
    'add chain=forward action=drop connection-state=new connection-nat-state=!dstnat in-interface-list=WAN comment="drop WAN not forwarded"');
  if (guest) add('add chain=forward action=drop in-interface-list=GUEST out-interface-list=LAN comment="guest cannot reach LAN"',
    'add chain=forward action=accept in-interface-list=GUEST out-interface-list=WAN comment="guest to internet"');
  if (cams) {
    add('add chain=forward action=accept in-interface-list=LAN out-interface-list=CAM comment="LAN can watch the cameras"',
      'add chain=forward action=drop in-interface-list=CAM out-interface-list=LAN comment="cameras cannot reach the LAN"');
    if (guest) add('add chain=forward action=drop in-interface-list=CAM out-interface-list=GUEST comment="cameras cannot reach guests"');
    add(spec.cams.internet
      ? 'add chain=forward action=accept in-interface-list=CAM out-interface-list=WAN comment="cameras to internet"'
      : 'add chain=forward action=accept in-interface-list=CAM out-interface-list=WAN protocol=udp dst-port=123 comment="cameras: time sync only, no cloud"');
  }
  add('add chain=forward action=accept in-interface-list=LAN out-interface-list=WAN comment="LAN to internet"',
    ...(geoOn ? ['add chain=forward action=jump jump-target=geo connection-state=new connection-nat-state=dstnat in-interface-list=WAN comment="country filter for port forwards"'] : []),
    'add chain=forward action=accept connection-nat-state=dstnat comment="port forwards"',
    'add chain=forward action=drop comment="drop everything else"');

  if (geoOn) {
    // country lists come from iwik.org: each list is named by its country code (AZ, TR, ...)
    if (sec.geoMode === 'allow') {
      geoCc.forEach((c) => add(`add chain=geo action=return src-address-list=${c} comment="geo allow ${c}"`));
      add('add chain=geo action=drop comment="geo: country not allowed"');
    } else geoCc.forEach((c) => add(`add chain=geo action=drop src-address-list=${c} comment="geo block ${c}"`));
  }
  add('/ip firewall nat', 'add chain=srcnat action=masquerade out-interface-list=WAN comment="masquerade"');
  const routerIps = [spec.lan.address, ...(guest ? [spec.guest.address] : [])];
  for (const f of spec.forwards) {
    const protos = f.proto === 'both' ? ['tcp', 'udp'] : [f.proto || 'tcp'];
    for (const pr of protos) {
      const match = spec.hairpin ? `dst-address-type=local dst-address=!${routerIps[0]}` : 'in-interface-list=WAN';
      const src = f.src ? ` src-address=${String(f.src).trim()}` : '';
      add(`add chain=dstnat action=dst-nat ${match}${src} protocol=${pr} dst-port=${f.extPort} to-addresses=${f.ip}${f.intPort ? ` to-ports=${f.intPort}` : ''} comment=${q(`forward ${f.name || f.extPort}`)}`);
      if (spec.hairpin) add(`add chain=srcnat action=masquerade src-address=${lan.cidr} dst-address=${f.ip} protocol=${pr} dst-port=${f.intPort || f.extPort} comment=${q(`hairpin ${f.name || f.extPort}`)}`);
    }
  }
  if (wans.some((w) => w.type === 'pppoe')) add('/ip firewall mangle', 'add chain=forward action=change-mss new-mss=clamp-to-pmtu protocol=tcp tcp-flags=syn out-interface-list=WAN passthrough=yes comment="PPPoE MSS clamp"');
  add('');

  if (sec.bogons) {
    add('# --- Bogon filter: source addresses that never come from the internet ---');
    BOGONS.forEach((b) => add(`/ip firewall address-list add list=bogons address=${b}`));
    add('/ip firewall raw add chain=prerouting action=drop in-interface-list=WAN src-address-list=bogons comment="drop bogon sources from WAN"', '');
  }
  if (sec.portscan) {
    add('# --- Port scan protection: scanners are blocked for 2 weeks ---',
      '/ip firewall raw add chain=prerouting action=drop in-interface-list=WAN src-address-list=port-scanners comment="drop port scanners"', '');
  }
  if (geoOn) {
    // download -> sanity check (size) -> import -> check the list is not empty; a bad download keeps the old list
    const src = `:local ok 0; :local bad ""; :foreach c in={${geoCc.map((c) => `"${c}"`).join(';')}} do={ :local f ("geo-" . $c . ".rsc"); :do { /tool fetch url=("https://www.iwik.org/ipcountry/mikrotik/" . $c) dst-path=$f; :delay 2s; :local sz [/file get [find name=$f] size]; :if ($sz < 200) do={ :set bad ($bad . $c . " "); :log error ("geo-update: " . $c . " list too small (" . $sz . " bytes), old list kept") } else={ /import file-name=$f; :local n [:len [/ip firewall address-list find list=$c]]; :if ($n = 0) do={ :set bad ($bad . $c . " "); :log error ("geo-update: " . $c . " list is empty after import") } else={ :set ok ($ok + 1); :log info ("geo-update: " . $c . " " . $n . " networks") } }; /file remove [find name=$f] } on-error={ :set bad ($bad . $c . " "); :log warning ("geo-update: download failed for " . $c . ", old list kept") } }; :local stamp ([/system clock get date] . " " . [/system clock get time]); :if ([:len $bad] = 0) do={ /system script set [find name=geo-update] comment=("country lists OK " . $stamp) } else={ /system script set [find name=geo-update] comment=("country lists PROBLEM " . $stamp . ": " . $bad) }`;
    add('# --- Country lists (iwik.org), refreshed daily and at boot ---',
      `/system script add name=geo-update source=${q(src)} comment="country IP lists from iwik.org"`,
      '/system scheduler add name=geo-update start-time=startup interval=1d on-event="/system script run geo-update" comment="refresh country IP lists"', '');
    notes.push(sec.geoMode === 'allow' ? M.nGeoAllow(geoCc.join(', ')) : M.nGeoBlock(geoCc.join(', ')));
  }
  add('# --- Hardening ---',
    '/ip service set telnet,ftp,www,api,api-ssl disabled=yes',
    `/ip service set winbox address=${lan.cidr}`,
    `/ip service set ssh address=${lan.cidr}`,
    '/tool mac-server set allowed-interface-list=LAN',
    '/tool mac-server mac-winbox set allowed-interface-list=LAN',
    '/ip neighbor discovery-settings set discover-interface-list=LAN');
  if (spec.adminPassword) add(`/user set admin password=${q(spec.adminPassword)}`); else notes.push(M.nNoPass);

  return { errors: [], script: o.join('\n') + '\n', notes };
}
