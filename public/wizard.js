import { WZ } from './wizard-i18n.js';
import { DEVICE_PORTS, defaultSpec, build, defaultPool, int2ip, geoList } from './wizard-core.js';
import { renderDiagram } from './diagram.js';

// ISO 3166-1 alpha-2 codes (iwik.org names its lists by these); names come from the browser in the UI language
const COUNTRIES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const flag = (c) => String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const SECRET = ['adminPassword', 'wan1.pass', 'wan2.pass', 'wan1.pin', 'wan2.pin', 'wifi.pass', 'wifi.guestPass'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

export function createWizard(root, { lang: getLang, labels, toast }) {
  let spec = load() || defaultSpec('any');
  let step = Math.min(6, Math.max(0, Number((location.hash.match(/step-(\d)/) || [])[1] || 0))), result = null, check = null;
  const T = () => WZ[getLang()] || WZ.en;
  const sim = { down: false };
  const ccName = (c) => { try { return new Intl.DisplayNames([getLang(), 'en'], { type: 'region' }).of(c) || c; } catch { return c; } };
  const diagram = () => renderDiagram(spec, getLang(), step, sim, DEVICE_PORTS[spec.device]?.label || labels()[spec.device] || '');
  let dgTimer = 0;
  const refreshDiagram = (now) => { clearTimeout(dgTimer); dgTimer = setTimeout(() => { const b = root.querySelector('.dg-box'); if (b) b.innerHTML = diagram(); }, now ? 0 : 450); };

  function load() {
    try { const s = JSON.parse(store.get('wizard') || 'null'); if (s && s.wan1 && s.lan) return { ...defaultSpec(s.device), ...s }; } catch {}
    return null;
  }
  function save() {
    const c = JSON.parse(JSON.stringify(spec));
    SECRET.forEach((p) => set(c, p, ''));
    store.set('wizard', JSON.stringify(c));
  }

  // ---- field helpers ----
  const field = (label, html, hint = '') => `<label class="f"><span>${esc(label)}</span>${html}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  const input = (path, attrs = '') => `<input data-p="${path}" value="${esc(get(spec, path))}" ${attrs}>`;
  const pass = (path) => `<input type="password" autocomplete="new-password" data-p="${path}" value="${esc(get(spec, path))}">`;
  const select = (path, opts, re = true) => `<select data-p="${path}" ${re ? 'data-re' : ''}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(get(spec, path)) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const check_ = (path, label) => `<label class="chk"><input type="checkbox" data-p="${path}" data-re ${get(spec, path) ? 'checked' : ''}> ${esc(label)}</label>`;
  const prefixes = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map((p) => {
    const mask = int2ip((0xffffffff << (32 - p)) >>> 0);
    return [p, `/${p}  ${mask}  (${2 ** (32 - p) - 2} ${T().hosts})`];
  });
  // RouterOS file names: keep them ASCII and space-free so /import file-name=... can be typed as is
  const fname = () => `${String(spec.identity || 'mikrotik').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'mikrotik'}-v${spec.ros || '7'}-${new Date().toISOString().slice(0, 10)}.rsc`;
  function secHtml() {
    const t = T();
    spec.security ||= { portscan: true, bogons: true, geoMode: 'off', geoCountries: 'AZ' };
    const opt = (path, label, hint) => `<div class="secopt">${check_(path, label)}<small>${esc(hint)}</small></div>`;
    let h = opt('security.portscan', t.secScan, t.secScanHint) + opt('security.bogons', t.secBogon, t.secBogonHint);
    h += `<div class="secopt">${field(t.geo, select('security.geoMode', [['off', t.geoOff], ['allow', t.geoAllow], ['block', t.geoBlock]]), spec.forwards.length ? t.geoHint : t.geoNeedFwd)}`;
    if (spec.security.geoMode !== 'off') h += ccPicker();
    return h + '</div>';
  }
  function ccChips() {
    const t = T(), sel = geoList(spec.security?.geoCountries);
    return sel.length ? sel.map((c) => `<span class="ccchip">${flag(c)} ${esc(ccName(c))} <button class="ccx" data-ccrm="${c}" aria-label="${esc(t.remove)}">✕</button></span>`).join('') : `<span class="muted">${esc(t.ccNone)}</span>`;
  }
  // freshness of the chosen country lists, checked by the server against iwik.org
  let geoInfo = {}, geoTimer = 0;
  function geoStatusHtml() {
    const t = T(), sel = geoList(spec.security?.geoCountries);
    if (!sel.length) return '';
    const rows = sel.map((c) => {
      const g = geoInfo[c];
      if (!g) return `<li class="gs-wait">${flag(c)} ${esc(ccName(c))}: ${esc(t.gsWait)}</li>`;
      if (g.state === 'error') return `<li class="gs-bad">${flag(c)} ${esc(ccName(c))}: ${esc(t.gsErr)}</li>`;
      if (g.state === 'empty') return `<li class="gs-bad">${flag(c)} ${esc(ccName(c))}: ${esc(t.gsEmpty)}</li>`;
      const cls = g.state === 'stale' ? 'gs-bad' : g.state === 'old' ? 'gs-warn' : 'gs-ok';
      return `<li class="${cls}">${flag(c)} ${esc(ccName(c))}: ${esc(t.gsNets(g.networks))}, ${esc(t.gsAge(g.ageHours))}${g.state === 'stale' ? ` — ${esc(t.gsStale)}` : ''}</li>`;
    }).join('');
    return `<div class="gs"><b>${esc(t.gsTitle)}</b><ul>${rows}</ul><small>${esc(t.gsSrc)}</small></div>`;
  }
  function loadGeoStatus() {
    clearTimeout(geoTimer);
    const sel = geoList(spec.security?.geoCountries).filter((c) => !geoInfo[c]);
    if (!sel.length) return;
    geoTimer = setTimeout(() => fetch(`/api/geo-status?cc=${sel.join(',')}`).then((r) => r.json()).then((d) => {
      for (const g of d.lists || []) geoInfo[g.cc] = g;
      const box = root.querySelector('.gs-box'); if (box) box.innerHTML = geoStatusHtml();
    }).catch(() => {}), 300);
  }
  function ccPicker() {
    const t = T(), sel = new Set(geoList(spec.security.geoCountries));
    const list = COUNTRIES.map((c) => [c, ccName(c)]).sort((a, b) => a[1].localeCompare(b[1], getLang()));
    loadGeoStatus();
    return `<div class="ccpick"><span class="cclbl">${esc(t.geoCc)}</span><div class="ccchips">${ccChips()}</div><div class="gs-box">${geoStatusHtml()}</div>
      <div class="ccbar"><input class="ccsearch" data-ccsearch placeholder="${esc(t.ccSearch)}"><button class="chip" data-ccclear>${esc(t.ccClear)}</button></div>
      <div class="cclist">${list.map(([c, n]) => `<label class="cc" data-q="${esc(`${n} ${c}`.toLowerCase())}"><input type="checkbox" data-cc="${c}"${sel.has(c) ? ' checked' : ''}> <span>${flag(c)}</span> ${esc(n)}</label>`).join('')}</div></div>`;
  }
  function setCountries(list) {
    spec.security.geoCountries = list.join(', '); check = null; save();
    const box = root.querySelector('.ccchips'); if (box) box.innerHTML = ccChips();
    const gs = root.querySelector('.gs-box'); if (gs) gs.innerHTML = geoStatusHtml();
    loadGeoStatus();
    root.querySelectorAll('[data-cc]').forEach((el) => { el.checked = list.includes(el.dataset.cc); });
    refreshDiagram(true);
  }
  const ports = () => (DEVICE_PORTS[spec.device] || DEVICE_PORTS.any).ports;

  function wanBlock(key) {
    const t = T(), w = spec[key];
    const dev = DEVICE_PORTS[spec.device] || DEVICE_PORTS.any;
    const typeOpts = [['dhcp', t.tDhcp], ['static', t.tStatic], ['pppoe', t.tPppoe], ...(dev.noLte ? [] : [['lte', t.tLte]])];
    if (w.type === 'lte') {
      w.apn ??= 'internet'; w.lteIf ??= 'lte1';
      return `<div class="grid2">${field(t.type, select(`${key}.type`, typeOpts))}${field(t.lteIf, input(`${key}.lteIf`, 'placeholder="lte1"'), t.lteIfHint)}</div>`
        + `<div class="grid2">${field(t.apn, input(`${key}.apn`, 'placeholder="internet"'), t.apnHint)}${field(t.pin, pass(`${key}.pin`), t.pinHint)}</div>`
        + `<p class="box accent">${esc(dev.lteBuiltin ? t.lteBuiltin : t.lteUsb)}</p>`;
    }
    let h = `<div class="grid2">${field(t.type, select(`${key}.type`, typeOpts))}${field(t.port, select(`${key}.port`, ports().map((p) => [p, p])))}</div>`;
    if (w.type === 'static') h += `<div class="grid3">${field(t.ip, input(`${key}.ip`, 'placeholder="203.0.113.10"'))}${field(t.prefix, select(`${key}.prefix`, [['', '—'], ...prefixes(8, 30)], false))}${field(t.gateway, input(`${key}.gateway`, 'placeholder="203.0.113.9"'))}</div>`;
    if (w.type === 'pppoe') h += `<div class="grid2">${field(t.user, input(`${key}.user`))}${field(t.pass, pass(`${key}.pass`))}</div>`;
    return h;
  }

  function stepHtml() {
    const t = T(), dev = DEVICE_PORTS[spec.device] || DEVICE_PORTS.any;
    switch (step) {
      case 0: return field(t.ros, select('ros', [['7', 'RouterOS 7'], ['6', 'RouterOS 6 (6.45+)']]), t.rosHint)
        + field(t.device, select('device', Object.keys(DEVICE_PORTS).filter((k) => spec.ros !== '6' || !DEVICE_PORTS[k].v7only).map((k) => [k, DEVICE_PORTS[k].label || labels()[k] || k])))
        + field(t.identity, input('identity'))
        + field(t.adminPass, pass('adminPassword'), t.adminPassHint)
        + field(t.tz, select('timezone', ['Asia/Baku', 'Europe/Istanbul', 'Europe/Moscow', 'Asia/Tbilisi', 'Europe/Kiev', 'Europe/Berlin', 'UTC'].map((z) => [z, z]), false));
      case 1: {
        let h = `<h3>${esc(t.wan1)}</h3>${wanBlock('wan1')}${check_('wan2.enabled', t.wan2On)}`;
        if (spec.wan2.enabled) {
          h += `<h3>${esc(t.wan2)}</h3>${wanBlock('wan2')}`;
          h += field(t.fMethod, select('failover.method', [['recursive', t.fRecursive], ['simple', t.fSimple]]));
          if (spec.failover.method === 'recursive') h += `<div class="grid2">${field(t.check1, input('failover.check1'))}${field(t.check2, input('failover.check2'))}</div>`;
        }
        return h + field(t.dns, input('dns', 'placeholder="1.1.1.1,8.8.8.8"'));
      }
      case 2: {
        const def = defaultPool(spec.lan.address, spec.lan.prefix);
        let h = `<div class="grid2">${field(t.lanIp, input('lan.address'))}${field(t.lanPrefix, select('lan.prefix', prefixes(16, 30)))}</div>${check_('lan.dhcp', t.dhcp)}`;
        if (spec.lan.dhcp) h += `<div class="grid3">${field(t.poolStart, input('lan.poolStart', `placeholder="${esc(def?.start || '')} (${esc(t.auto)})"`))}${field(t.poolEnd, input('lan.poolEnd', `placeholder="${esc(def?.end || '')} (${esc(t.auto)})"`))}${field(t.lease, select('lan.lease', [['1h', '1h'], ['8h', '8h'], ['1d', '1d'], ['3d', '3d'], ['7d', '7d']], false))}</div>`;
        return h;
      }
      case 3: {
        const wanPorts = [...(spec.wan1.type !== 'lte' ? [spec.wan1.port] : []), ...(spec.wan2.enabled && spec.wan2.type !== 'lte' ? [spec.wan2.port] : [])];
        const bw = dev.bw !== 'no';
        let rows = '';
        for (const p of ports()) {
          if (wanPorts.includes(p)) { rows += `<tr class="wanrow"><td><b>${p}</b></td><td colspan="4">${p === spec.wan1.port ? 'WAN1' : 'WAN2'}</td></tr>`; continue; }
          spec.ports[p] ||= { role: 'lan', down: '', up: '' };
          const roles = [['lan', t.rLan], ...(spec.guest.enabled ? [['guest', t.rGuest]] : []), ...(spec.cams?.enabled ? [['cam', t.rCam]] : []), ['off', t.rOff]];
          rows += `<tr><td><b>${p}</b></td><td>${select(`ports.${p}.role`, roles)}</td><td><input data-p="ports.${p}.desc" value="${esc(spec.ports[p].desc || '')}" placeholder="${esc(t.descPh)}" maxlength="60"></td>`
            + (bw ? `<td><input data-p="ports.${p}.down" value="${esc(spec.ports[p].down)}" placeholder="${esc(t.mbps)}" inputmode="decimal"></td><td><input data-p="ports.${p}.up" value="${esc(spec.ports[p].up)}" placeholder="${esc(t.mbps)}" inputmode="decimal"></td>` : '<td></td><td></td>') + '</tr>';
        }
        return `<p class="muted">${esc(t.portsIntro)}</p>${bw ? '' : `<p class="box warnbox">${esc(t.bwNo)}</p>`}${dev.bw === 'partial' ? `<p class="muted">${esc(t.bwPartial)}</p>` : ''}
          <div class="tablewrap"><table class="ports"><thead><tr><th>${esc(t.port)}</th><th>${esc(t.role)}</th><th>${esc(t.desc)}</th><th>${bw ? esc(t.down) : ''}</th><th>${bw ? esc(t.up) : ''}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      case 4: {
        let h = check_('guest.enabled', t.guestOn);
        if (spec.guest.enabled) h += `<div class="grid2">${field(t.guestIp, input('guest.address'))}${field(t.lanPrefix, select('guest.prefix', prefixes(20, 29), false))}</div>`;
        spec.cams ||= { enabled: false, address: '192.168.50.1', prefix: 24, internet: false };
        h += `<h3>${esc(t.camTitle)}</h3>${check_('cams.enabled', t.camOn)}`;
        if (spec.cams.enabled) {
          h += `<div class="grid2">${field(t.camIp, input('cams.address'))}${field(t.lanPrefix, select('cams.prefix', prefixes(20, 29), false))}</div>`;
          h += `<div class="secopt">${check_('cams.internet', t.camNet)}<small>${esc(t.camNetHint)}</small></div><p class="muted">${esc(t.camPorts)}</p>`;
        }
        if (!dev.wifi) return h + `<p class="muted">${esc(t.noWifi)}</p>`;
        h += `<h3>${esc(t.wifi)}</h3>${check_('wifi.enabled', t.wifi)}`;
        if (spec.wifi.enabled) {
          h += `<div class="grid2">${field(t.ssid, input('wifi.ssid'))}${field(t.wifiPass, pass('wifi.pass'))}</div>`;
          if (spec.guest.enabled) h += `<div class="grid2">${field(t.guestSsid, input('wifi.guestSsid'))}${field(t.guestPass, pass('wifi.guestPass'))}</div>`;
        }
        return h;
      }
      case 5: {
        const fw = spec.forwards.map((f, i) => `<div class="rowcard">
          <div class="grid3">${field(t.fName, input(`forwards.${i}.name`))}${field(t.proto, select(`forwards.${i}.proto`, [['tcp', 'TCP'], ['udp', 'UDP'], ['both', 'TCP+UDP']], false))}${field(t.extPort, input(`forwards.${i}.extPort`, 'placeholder="8080" inputmode="numeric"'))}</div>
          <div class="grid3">${field(t.intIp, input(`forwards.${i}.ip`, 'placeholder="192.168.88.50"'))}${field(t.intPort, input(`forwards.${i}.intPort`, 'placeholder="80" inputmode="numeric"'))}${field(t.src, input(`forwards.${i}.src`))}</div>
          <button class="link" data-del="forwards.${i}">${esc(t.remove)}</button></div>`).join('');
        const lm = spec.limits.map((l, i) => `<div class="rowcard"><div class="grid4">${field(t.fName, input(`limits.${i}.name`))}${field(t.target, input(`limits.${i}.target`, 'placeholder="192.168.88.100-192.168.88.150"'))}${field(t.down, input(`limits.${i}.down`, `placeholder="${esc(t.mbps)}" inputmode="decimal"`))}${field(t.up, input(`limits.${i}.up`, `placeholder="${esc(t.mbps)}" inputmode="decimal"`))}</div><button class="link" data-del="limits.${i}">${esc(t.remove)}</button></div>`).join('');
        return `<h3>${esc(t.fwd)}</h3>${fw}<button class="chip" data-addrow="forwards">${esc(t.fwdAdd)}</button>${spec.forwards.length ? check_('hairpin', t.hairpin) : ''}
          <h3>${esc(t.lim)}</h3>${lm}<button class="chip" data-addrow="limits">${esc(t.limAdd)}</button>
          <h3>${esc(t.secTitle)}</h3>${secHtml()}`;
      }
      case 6: {
        const r = result;
        if (r.errors.length) return `<div class="box warnbox"><b>${esc(t.errors)}</b><ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
        const ck = check ? (check.issues.length ? `<div class="box warnbox"><b>${esc(t.checkBad)}</b><ul>${check.issues.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : `<div class="box ok">✓ ${esc(spec.ros === '6' ? t.checkV6 : t.checkOk(check.schema || '7'))}</div>`) : '';
        return `${ck}<div class="box accent"><b>${esc(t.notes)}</b><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
          <div class="out-head"><h3>RouterOS</h3><div class="btns"><button data-act="copy">Copy</button><button data-act="dl">.rsc</button></div></div>
          <pre>${esc(r.script)}</pre><h3>${esc(t.howApply)}</h3><ol class="muted apply">${t.apply(fname()).map((a) => `<li>${code(a)}</li>`).join('')}</ol>`;
      }
    }
    return '';
  }

  function render() {
    const t = T();
    if (step === 6) result = build(spec, getLang());
    root.innerHTML = `<p class="muted">${esc(t.wizIntro)}</p>
      <ol class="stepper">${t.steps.map((s, i) => `<li class="${i === step ? 'cur' : i < step ? 'done' : ''}"><button data-go="${i}"><span>${i + 1}</span>${esc(s)}</button></li>`).join('')}</ol>
      <div class="dg-box">${diagram()}</div>
      <div class="stepbody">${stepHtml()}</div>
      <div class="actions">
        <button class="btn-reset" data-act="reset" title="${esc(t.resetConfirm)}"><span aria-hidden="true">↺</span> ${esc(t.reset)}</button>
        <div class="btns">${step > 0 ? `<button data-act="back">${esc(t.back)}</button>` : ''}${step < 6 ? `<button class="primary" data-act="next">${esc(step === 5 ? t.finish : t.next)}</button>` : ''}</div>
      </div>`;
    if (step === 6 && result.script && !check) {
      fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: result.script, deviceId: spec.device, ros: spec.ros }) })
        .then((r) => r.json()).then((c) => { check = c; if (step === 6) render(); }).catch(() => {});
    }
  }

  function onInput(e) {
    const el = e.target.closest('[data-p]'); if (!el) return;
    const p = el.dataset.p;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (/\.prefix$/.test(p) && v !== '') v = Number(v);
    if (p === 'device') {
      const d = defaultSpec(v);
      spec.device = v; spec.ports = d.ports; spec.wan1.port = 'ether1'; spec.wan2.port = d.wan2.port; spec.wan2.type = d.wan2.type; spec.wifi.enabled = !!DEVICE_PORTS[v].wifi;
      for (const k of ['wan1', 'wan2']) if (DEVICE_PORTS[v].noLte && spec[k].type === 'lte') spec[k].type = 'dhcp';
    } else set(spec, p, v);
    if (p === 'ros' && v === '6' && DEVICE_PORTS[spec.device]?.v7only) { const d = defaultSpec('any'); spec.device = 'any'; spec.ports = d.ports; spec.wan1.port = 'ether1'; spec.wan2.port = d.wan2.port; spec.wifi.enabled = false; }
    check = null; save();
    if (el.hasAttribute('data-re')) render(); else refreshDiagram();
  }

  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-ccsearch]')) {
      const q = e.target.value.trim().toLowerCase();
      root.querySelectorAll('.cc').forEach((l) => { l.hidden = q && !l.dataset.q.includes(q); });
      return;
    }
    onInput(e);
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.cc) {
      const cur = geoList(spec.security.geoCountries).filter((c) => c !== e.target.dataset.cc);
      return setCountries(e.target.checked ? [...cur, e.target.dataset.cc] : cur);
    }
    if (e.target.matches('select, input[type=checkbox]')) onInput(e);
  });
  const jump = (e) => {
    const g = e.target.closest && e.target.closest('[data-dg-go]');
    if (!g) return false;
    step = +g.dataset.dgGo; render();
    return true;
  };
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && jump(e)) e.preventDefault(); });
  root.addEventListener('click', async (e) => {
    if (jump(e)) return;
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault();
    if (b.hasAttribute('data-sim')) { sim.down = !sim.down; refreshDiagram(true); }
    else if (b.dataset.ccrm) setCountries(geoList(spec.security.geoCountries).filter((c) => c !== b.dataset.ccrm));
    else if (b.hasAttribute('data-ccclear')) setCountries([]);
    else if (b.dataset.go) { step = +b.dataset.go; render(); }
    else if (b.dataset.addrow) {
      spec[b.dataset.addrow].push(b.dataset.addrow === 'forwards' ? { name: '', proto: 'tcp', extPort: '', ip: '', intPort: '', src: '' } : { name: '', target: '', down: '', up: '' });
      save(); render();
    } else if (b.dataset.del) { const [k, i] = b.dataset.del.split('.'); spec[k].splice(+i, 1); save(); render(); }
    else if (b.dataset.act === 'next') { step = Math.min(6, step + 1); render(); root.scrollIntoView({ behavior: 'smooth' }); }
    else if (b.dataset.act === 'back') { step = Math.max(0, step - 1); render(); }
    else if (b.dataset.act === 'reset') {
      if (!confirm(T().resetConfirm)) return; spec = defaultSpec(spec.device); step = 0; save(); render(); }
    else if (b.dataset.act === 'copy' && result?.script) { await navigator.clipboard.writeText(result.script); toast('✓'); }
    else if (b.dataset.act === 'dl' && result?.script) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([result.script], { type: 'text/plain' }));
      a.download = fname(); a.click();
    }
  });

  return { render };
}
