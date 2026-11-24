// Runtime settings changed from the UI (AI on/off and the LLM connection).
// Stored in a JSON file on the data volume; anything not set there falls back to .env / environment.
// The API key is encrypted at rest (AES-256-GCM, key file next to the settings) and never sent to the browser.
// A saved key is bound to the LLM address it was saved with, so changing the address cannot leak it.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

// field -> [env variable, parser/validator]
const FIELDS = {
  ai: ['AI_ENABLED', (v) => !!v],
  base: ['LLM_BASE_URL', (v) => {
    const s = String(v || '').trim().replace(/\/+$/, '');
    if (s && !/^https?:\/\/[^\s/]+/i.test(s)) throw new Error('LLM address must start with http:// or https://');
    return s;
  }],
  model: ['LLM_MODEL', (v) => String(v || '').trim().slice(0, 200)],
  maxTokens: ['LLM_MAX_TOKENS', (v) => clampInt(v, 256, 65536, 'Max tokens')],
  timeoutMs: ['LLM_TIMEOUT_MS', (v) => clampInt(v, 10_000, 1_800_000, 'Timeout')],
  thinking: ['LLM_THINKING', (v) => !!v],
  fixRounds: ['FIX_ROUNDS', (v) => clampInt(v, 0, 5, 'Fix rounds')],
};
function clampInt(v, min, max, name) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number between ${min} and ${max}`);
  return n;
}

export function createSettings({ file, envCfg }) {
  let data = { ai: {}, key: null };
  try { data = { ai: {}, key: null, ...JSON.parse(readFileSync(file, 'utf8')) }; } catch { /* first run */ }
  delete data.admin; // older versions kept an admin password here
  const persist = () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 1), { mode: 0o600 });
  };

  // ---- encryption of the API key ----
  // SETTINGS_SECRET (any string) or a random 32-byte file created on first use
  const secretFile = join(dirname(file), '.settings-secret');
  function secret() {
    if (process.env.SETTINGS_SECRET) return createHash('sha256').update(process.env.SETTINGS_SECRET).digest();
    if (!existsSync(secretFile)) { mkdirSync(dirname(secretFile), { recursive: true }); writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600 }); }
    return Buffer.from(readFileSync(secretFile, 'utf8').trim(), 'hex');
  }
  function encrypt(text, base) {
    const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', secret(), iv);
    const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: enc.toString('base64'), base };
  }
  function decrypt(k) {
    try {
      const d = createDecipheriv('aes-256-gcm', secret(), Buffer.from(k.iv, 'base64'));
      d.setAuthTag(Buffer.from(k.tag, 'base64'));
      return Buffer.concat([d.update(Buffer.from(k.data, 'base64')), d.final()]).toString('utf8');
    } catch { return ''; } // secret changed or file damaged: behave as "no key"
  }

  // ---- values ----
  function effective() {
    const e = { ...envCfg, ...data.ai };
    // the key is only ever sent to the address it belongs to
    if (data.key) e.key = data.key.base === e.base ? decrypt(data.key) : '';
    else e.key = e.base === envCfg.base ? envCfg.key : '';
    return e;
  }
  const source = (k) => (k in data.ai ? 'settings' : process.env[FIELDS[k][0]] ? 'env' : 'default');
  // what the browser may see: never the key itself
  function view() {
    const e = effective();
    return {
      ai: e.ai, base: e.base, model: e.model, maxTokens: e.maxTokens, timeoutMs: e.timeoutMs, thinking: e.thinking, fixRounds: e.fixRounds,
      keySet: !!e.key, keySource: data.key ? 'settings' : e.key ? 'env' : 'default',
      sources: Object.fromEntries(Object.keys(FIELDS).map((k) => [k, source(k)])),
    };
  }
  function update(p) {
    const next = { ...data.ai };
    for (const k of Object.keys(FIELDS)) if (p[k] !== undefined) next[k] = FIELDS[k][1](p[k]);
    const base = next.base ?? envCfg.base;
    if (next.ai && !base) throw new Error('Set the LLM address before turning the AI on');
    let key = data.key;
    if (typeof p.key === 'string' && p.key.trim()) key = encrypt(p.key.trim().slice(0, 500), base);
    else if (p.keyAction === 'clear') key = null;
    else if (key && key.base !== base) key = null; // address changed without a new key: forget the old one
    data = { ...data, ai: next, key };
    persist();
  }
  function resetToEnv() { data = { ai: {}, key: null }; persist(); }

  return { effective, view, update, resetToEnv };
}
