import { STR } from './i18n.js';
import { WZ } from './wizard-i18n.js';
import { createWizard } from './wizard.js';
import { createSettingsDialog } from './settings.js';

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

let lang = store.get('lang') || 'az';
let mode = 'generate';
let last = null;
let devices = { any: 'Any / unspecified' };
const drafts = { generate: '', review: '' };

const t = (k) => STR[lang][k] ?? STR.en[k] ?? k;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg, bad) {
  const el = $('toast'); el.textContent = msg; el.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.add('hidden'), 3500);
}

function render() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(!AI && el.dataset.t === 'tagline' ? 'taglinePlain' : el.dataset.t); });
  document.querySelectorAll('#langs button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $('inputLabel').textContent = mode === 'generate' ? t('reqLabel') : t('exportLabel');
  $('input').placeholder = mode === 'generate' ? t('reqPh') : t('exportPh');
  $('hint').textContent = mode === 'generate' ? t('hintGen') : t('hintRev');
  $('examplesWrap').classList.toggle('hidden', mode !== 'generate');
  $('run').textContent = $('run').disabled ? t('running') : mode === 'generate' ? t('run') : t('runReview');
  $('examples').innerHTML = Object.entries(STR[lang].ex).map(([id, [title]]) => `<button class="chip" data-ex="${id}">${esc(title)}</button>`).join('');
  $('steps').innerHTML = t('steps').map((s) => `<li>${esc(s)}</li>`).join('');
  const sel = $('device'), cur = sel.value || 'any';
  sel.innerHTML = Object.entries(devices).map(([k, v]) => `<option value="${k}">${esc(k === 'any' ? '—' : v)}</option>`).join('');
  sel.value = cur;
  if (last) showResult(last);
  $('vWiz').textContent = WZ[lang].tabWizard; $('vAi').textContent = WZ[lang].tabAi;
  document.querySelectorAll('.view').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('wizView').classList.toggle('hidden', view !== 'wiz'); $('aiView').classList.toggle('hidden', view !== 'ai');
  wizard?.render();
}
const AI = document.documentElement.dataset.ai !== '0';
const settingsDlg = createSettingsDialog({ lang: () => lang, toast });
$('gear').addEventListener('click', () => settingsDlg.open());
let view = AI ? store.get('view') || 'wiz' : 'wiz';
$('ros').value = store.get('aiRos') === '6' ? '6' : '7';
$('ros').addEventListener('change', () => store.set('aiRos', $('ros').value));
let wizard = null;

function showResult(r) {
  $('out').classList.remove('hidden');
  $('summary').textContent = r.summary;
  $('script').textContent = r.script || t('empty');
  const list = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const box = (id, show, html) => { $(id).classList.toggle('hidden', !show); $(id).innerHTML = show ? html : ''; };
  box('fixed', r.auto_fixed, `<b>${esc(t('autofixed'))}</b>${list(r.fixed_issues || [])}`);
  box('missing', r.missing_details.length > 0, `<b>${esc(t('missing'))}</b>${list(r.missing_details)}`);
  box('lint', r.lint_issues.length > 0, `<b>${esc(t('lint'))}</b>${list(r.lint_issues)}`);
  const f = r.findings || [];
  box('findings', f.length > 0, `<h3>${esc(t('findings'))}</h3>` + f.map((x) =>
    `<div class="finding sev-${esc(x.severity || 'low')}"><span class="sev">${esc(x.severity || '')}</span><b>${esc(x.title || '')}</b><p>${esc(x.detail || '')}</p></div>`).join(''));
}

async function runIt() {
  const input = $('input').value.trim();
  if (input.length < 3) return;
  $('run').disabled = true; render();
  try {
    const res = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, input, deviceId: $('device').value, ros: $('ros').value, lang }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    last = data; showResult(data);
    $('out').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    toast(`${t('error')}: ${e.message}`, true);
  } finally {
    $('run').disabled = false; render();
  }
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.closest('#wizView')) return; // wizard handles its own clicks
  if (b.dataset.view) { view = b.dataset.view; store.set('view', view); render(); return; }
  if (b.dataset.lang) { lang = b.dataset.lang; store.set('lang', lang); render(); }
  else if (b.dataset.mode && b.dataset.mode !== mode) { drafts[mode] = $('input').value; mode = b.dataset.mode; $('input').value = drafts[mode]; render(); }
  else if (b.dataset.ex) { $('input').value = STR[lang].ex[b.dataset.ex][1]; $('input').focus(); }
  else if (b.id === 'run') runIt();
  else if (b.id === 'copy' && last?.script) { await navigator.clipboard.writeText(last.script); toast(t('copied')); }
  else if (b.id === 'dl' && last?.script) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([last.script], { type: 'text/plain' }));
    a.download = `routeros-${last.mode}-${new Date().toISOString().slice(0, 10)}.rsc`; a.click();
  }
});
$('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runIt(); });

wizard = createWizard($('wizView'), { lang: () => lang, labels: () => devices, toast: (m) => toast(m) });
fetch('/api/info').then((r) => r.json()).then((i) => { devices = i.devices; if (i.model) $('modelName').textContent = i.model; render(); }).catch(() => {});
render();
