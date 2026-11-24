// Settings dialog: AI on/off and the LLM connection. Values are stored on the server (data volume)
// and override .env. The API key is encrypted on the server and never comes back to the browser.
const S = {
  az: {
    title: 'Ayarlar', close: 'Bağla',
    aiTitle: 'AI köməkçisi', aiOn: 'AI köməkçisini aç', aiHint: 'Söndürülü olanda proqram sadə konfiqurator kimi işləyir: AI bölməsi və AI haqqında yazılar görünmür, LLM-ə sorğu getmir.',
    base: 'LLM ünvanı (OpenAI-uyğun API)', baseHint: 'məs. http://localai:8080/v1 və ya http://ollama:11434/v1',
    key: 'API açarı (lazımdırsa)', keySaved: 'saxlanılıb: şifrələnib, göstərilmir', keyEnv: '.env-dən götürülür, göstərilmir', keyNone: 'açar yoxdur', keyClear: 'Saxlanmış açarı sil',
    keyHint: 'Açar serverdə şifrələnmiş saxlanılır və yalnız bu ünvana göndərilir. Ünvanı dəyişsəniz, açarı yenidən yazın.',
    model: 'Model', maxTokens: 'Maks. token', timeout: 'Gözləmə müddəti (saniyə)', thinking: '"Thinking" rejimi (Qwen3 üçün söndürülü saxlayın)', fixRounds: 'Avtomatik düzəliş dövrləri',
    test: 'Bağlantını yoxla', testing: 'Yoxlanılır...', testOk: (n) => `Qoşuldu: ${n} model tapıldı.`, testModelMissing: 'Seçilmiş model bu siyahıda yoxdur.', testBad: 'Qoşulmadı',
    save: 'Yadda saxla', saved: 'Saxlanıldı', reset: '.env-ə qaytar', resetConfirm: 'Ayarlarda saxlanmış AI parametrləri və açar silinəcək, .env dəyərləri istifadə olunacaq. Davam edilsin?',
    src: { settings: 'ayarlardan', env: '.env-dən', default: 'standart' }, reload: 'Dəyişiklik tətbiq olunur...',
  },
  ru: {
    title: 'Настройки', close: 'Закрыть',
    aiTitle: 'AI-помощник', aiOn: 'Включить AI-помощника', aiHint: 'Когда выключено, приложение работает как простой конфигуратор: раздела AI и упоминаний AI нет, запросов к LLM нет.',
    base: 'Адрес LLM (OpenAI-совместимый API)', baseHint: 'напр. http://localai:8080/v1 или http://ollama:11434/v1',
    key: 'API-ключ (если нужен)', keySaved: 'сохранён: зашифрован, не показывается', keyEnv: 'берётся из .env, не показывается', keyNone: 'ключа нет', keyClear: 'Удалить сохранённый ключ',
    keyHint: 'Ключ хранится на сервере в зашифрованном виде и отправляется только на этот адрес. Если смените адрес, введите ключ заново.',
    model: 'Модель', maxTokens: 'Макс. токенов', timeout: 'Тайм-аут (секунды)', thinking: 'Режим «thinking» (для Qwen3 держите выключенным)', fixRounds: 'Циклы автоисправления',
    test: 'Проверить подключение', testing: 'Проверка...', testOk: (n) => `Подключено: найдено моделей: ${n}.`, testModelMissing: 'Выбранной модели нет в списке.', testBad: 'Не подключилось',
    save: 'Сохранить', saved: 'Сохранено', reset: 'Вернуть .env', resetConfirm: 'Сохранённые параметры AI и ключ будут удалены, будут использоваться значения из .env. Продолжить?',
    src: { settings: 'из настроек', env: 'из .env', default: 'по умолчанию' }, reload: 'Применяем изменения...',
  },
  en: {
    title: 'Settings', close: 'Close',
    aiTitle: 'AI assistant', aiOn: 'Turn the AI assistant on', aiHint: 'When off, the app is a plain configurator: no AI section, no AI wording, no LLM requests.',
    base: 'LLM address (OpenAI-compatible API)', baseHint: 'e.g. http://localai:8080/v1 or http://ollama:11434/v1',
    key: 'API key (if needed)', keySaved: 'saved: encrypted, not shown', keyEnv: 'taken from .env, not shown', keyNone: 'no key', keyClear: 'Remove the saved key',
    keyHint: 'The key is stored encrypted on the server and only sent to this address. If you change the address, type the key again.',
    model: 'Model', maxTokens: 'Max tokens', timeout: 'Timeout (seconds)', thinking: '"Thinking" mode (keep off for Qwen3)', fixRounds: 'Automatic fix rounds',
    test: 'Test connection', testing: 'Testing...', testOk: (n) => `Connected: ${n} models found.`, testModelMissing: 'The chosen model is not in this list.', testBad: 'Could not connect',
    save: 'Save', saved: 'Saved', reset: 'Back to .env', resetConfirm: 'The AI values and the key saved in settings will be removed and the .env values used. Continue?',
    src: { settings: 'from settings', env: 'from .env', default: 'default' }, reload: 'Applying the change...',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createSettingsDialog({ lang, toast }) {
  const dlg = document.getElementById('settingsDlg');
  const body = dlg.querySelector('.set-body');
  const T = () => S[lang()] || S.en;
  let view = null, models = [], keyAction = '';

  const api = async (path, method = 'GET', data) => {
    const r = await fetch(`/api/settings${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  };
  const msg = (text, bad) => { const m = body.querySelector('.set-msg'); if (m) { m.textContent = text; m.className = `set-msg ${bad ? 'bad' : 'ok'}`; } };

  function render() {
    const t = T(), v = view;
    const src = (k) => `<em class="src src-${v.sources[k]}">${esc(t.src[v.sources[k]])}</em>`;
    const fld = (k, label, input, hint = '') => `<label class="f"><span>${esc(label)} ${k ? src(k) : ''}</span>${input}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
    const keyPh = keyAction === 'clear' || !v.keySet ? t.keyNone : v.keySource === 'env' ? t.keyEnv : t.keySaved;
    body.innerHTML = `<form class="set-form">
      <h3>${esc(t.aiTitle)}</h3>
      <label class="switch"><input type="checkbox" name="ai" ${v.ai ? 'checked' : ''}><span class="sw"></span><b>${esc(t.aiOn)}</b> ${src('ai')}</label>
      <p class="muted">${esc(t.aiHint)}</p>
      <div class="set-ai" ${v.ai ? '' : 'hidden'}>
        ${fld('base', t.base, `<input name="base" value="${esc(v.base)}" placeholder="http://localai:8080/v1" spellcheck="false">`, t.baseHint)}
        <div class="grid2">
          ${fld('', t.key, `<input type="password" name="key" autocomplete="new-password" placeholder="${esc(keyPh)}">`, t.keyHint)}
          ${fld('model', t.model, `<input name="model" value="${esc(v.model)}" list="setModels" spellcheck="false"><datalist id="setModels">${models.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`)}
        </div>
        ${v.keySource === 'settings' && keyAction !== 'clear' ? `<button type="button" class="link" data-act="keyclear">${esc(t.keyClear)}</button>` : ''}
        <div class="grid3">
          ${fld('maxTokens', t.maxTokens, `<input name="maxTokens" type="number" min="256" max="65536" value="${v.maxTokens}">`)}
          ${fld('timeoutMs', t.timeout, `<input name="timeout" type="number" min="10" max="1800" value="${Math.round(v.timeoutMs / 1000)}">`)}
          ${fld('fixRounds', t.fixRounds, `<input name="fixRounds" type="number" min="0" max="5" value="${v.fixRounds}">`)}
        </div>
        <label class="chk"><input type="checkbox" name="thinking" ${v.thinking ? 'checked' : ''}> ${esc(t.thinking)} ${src('thinking')}</label>
        <div class="set-test"><button type="button" data-act="test">${esc(t.test)}</button><span class="set-tres"></span></div>
      </div>
      <div class="set-actions"><button type="button" class="link" data-act="reset">${esc(t.reset)}</button><span class="set-msg"></span><button class="primary" type="submit">${esc(t.save)}</button></div>
    </form>`;
  }

  async function load() {
    body.innerHTML = '<p class="muted">…</p>';
    try { view = await api(''); keyAction = ''; render(); } catch (e) { body.innerHTML = `<p class="set-msg bad">${esc(e.message)}</p>`; }
  }
  // the AI flag changes what the whole page shows: reload once it is saved
  const afterSave = (before) => { if (before !== view.ai) { toast(T().reload); setTimeout(() => location.reload(), 500); } };

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, t = T(), before = view.ai;
    try {
      view = await api('', 'PUT', {
        ai: f.ai.checked, base: f.base.value, model: f.model.value, maxTokens: Number(f.maxTokens.value), timeoutMs: Number(f.timeout.value) * 1000,
        fixRounds: Number(f.fixRounds.value), thinking: f.thinking.checked,
        ...(f.key.value.trim() ? { key: f.key.value } : keyAction === 'clear' ? { keyAction: 'clear' } : {}),
      });
      keyAction = ''; render(); msg(t.saved); afterSave(before);
    } catch (err) { msg(err.message, true); }
  });

  body.addEventListener('change', (e) => { if (e.target.name === 'ai') body.querySelector('.set-ai').hidden = !e.target.checked; });

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const t = T(), f = body.querySelector('form');
    try {
      if (b.dataset.act === 'test') {
        const out = body.querySelector('.set-tres'); out.className = 'set-tres'; out.textContent = t.testing;
        const r = await api('/test', 'POST', { base: f.base.value, key: f.key.value, model: f.model.value });
        if (r.ok) {
          models = r.models;
          body.querySelector('#setModels').innerHTML = models.map((m) => `<option value="${esc(m)}">`).join('');
          out.textContent = `✓ ${t.testOk(models.length)}${r.modelFound ? '' : ` ${t.testModelMissing}`}`; out.className = `set-tres ${r.modelFound ? 'ok' : 'warn'}`;
        } else { out.textContent = `✕ ${t.testBad}: ${r.error}`; out.className = 'set-tres bad'; }
      } else if (b.dataset.act === 'keyclear') {
        keyAction = 'clear'; const keep = new FormData(f); render(); restore(keep);
      } else if (b.dataset.act === 'reset') {
        if (!confirm(t.resetConfirm)) return;
        const before = view.ai; view = await api('/reset', 'POST'); render(); msg(t.saved); afterSave(before);
      }
    } catch (err) { msg(err.message, true); }
  });
  // keep what the user typed when the form is re-rendered
  function restore(fd) {
    const f = body.querySelector('form'); if (!f) return;
    for (const [k, v] of fd) if (f[k] && f[k].type !== 'checkbox' && k !== 'key') f[k].value = v;
    f.ai.checked = fd.has('ai'); f.thinking.checked = fd.has('thinking');
    body.querySelector('.set-ai').hidden = !f.ai.checked;
  }

  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  return {
    open() { dlg.querySelector('.set-title').textContent = T().title; dlg.querySelector('[data-close]').setAttribute('aria-label', T().close); dlg.showModal(); load(); },
  };
}
