// Local RouterOS config generator: static UI + one API endpoint proxying to an
// OpenAI-compatible LLM (LocalAI, Ollama, LM Studio, OpenAI...). No dependencies.
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { systemPrompt, fixPrompt, lint, sanitize, DEVICES } from './prompts.mjs';
import { SCHEMA } from './schema.mjs';
import { createSettings } from './settings.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
let VERSION = 'dev';
try { VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version; } catch { /* running without package.json */ }

// .env loader (KEY=value lines)
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const CFG = {
  port: Number(process.env.PORT || 3090),
  host: process.env.HOST || '127.0.0.1',
  base: (process.env.LLM_BASE_URL || '').replace(/\/$/, ''),
  key: process.env.LLM_API_KEY || '',
  model: process.env.LLM_MODEL || 'qwen2.5-coder:14b',
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 240000),
  maxTokens: Number(process.env.LLM_MAX_TOKENS || 8000),
  thinking: /^(1|true|yes)$/i.test(process.env.LLM_THINKING || 'false'),
  fixRounds: Number(process.env.FIX_ROUNDS || 2),
  // AI_ENABLED=false: plain configurator, no LLM calls, no AI wording in the UI
  // empty / unset: on only when an LLM endpoint is configured
  ai: process.env.AI_ENABLED ? !/^(0|false|no|off)$/i.test(process.env.AI_ENABLED) : !!process.env.LLM_BASE_URL,
};

// Settings saved from the UI override .env; .env stays as the fallback (and the source for a reset).
const SETTINGS_FILE = process.env.SETTINGS_FILE || join(dirname(process.env.MISTAKES_FILE || join(ROOT, 'data', 'mistakes.json')), 'settings.json');
const settings = createSettings({
  file: SETTINGS_FILE,
  envCfg: { ai: CFG.ai, base: CFG.base, key: CFG.key, model: CFG.model, timeoutMs: CFG.timeoutMs, maxTokens: CFG.maxTokens, thinking: CFG.thinking, fixRounds: CFG.fixRounds },
});
const applySettings = () => Object.assign(CFG, settings.effective());
applySettings();

async function readJson(req) {
  let body = '';
  for await (const c of req) { body += c; if (body.length > 400_000) throw new Error('Input too large'); }
  return JSON.parse(body || '{}');
}
const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

// lists the models of an OpenAI-compatible endpoint; used by the settings page to check the connection
async function testLlm(base, key) {
  const r = await fetch(`${base}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return (j.data || j.models || []).map((m) => m.id || m.name || m.model).filter(Boolean).slice(0, 300);
}

async function settingsApi(req, res, path) {
  const ip = req.socket.remoteAddress || '';
  if (path === '/api/settings' && req.method === 'GET') return sendJson(res, 200, settings.view());
  if (path === '/api/settings' && req.method === 'PUT') {
    settings.update(await readJson(req)); applySettings();
    console.log(`[settings] saved from ${ip}: AI ${CFG.ai ? `on (${CFG.model} @ ${CFG.base})` : 'off'}`);
    return sendJson(res, 200, settings.view());
  }
  if (path === '/api/settings/reset' && req.method === 'POST') { settings.resetToEnv(); applySettings(); return sendJson(res, 200, settings.view()); }
  if (path === '/api/settings/test' && req.method === 'POST') {
    const p = await readJson(req);
    const base = String(p.base || CFG.base || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) throw new Error('LLM address must start with http:// or https://');
    // a typed key is used as is; the saved key only goes to the address it was saved for
    const key = (typeof p.key === 'string' && p.key.trim()) || (base === CFG.base ? CFG.key : '');
    try {
      const models = await testLlm(base, key);
      return sendJson(res, 200, { ok: true, models, modelFound: !p.model || models.includes(p.model) });
    } catch (e) { return sendJson(res, 200, { ok: false, error: String(e.message || e).slice(0, 200) }); }
  }
  return sendJson(res, 404, { error: 'Not found' });
}

// Mistake memory: counts of lint findings across runs; the most frequent go into the prompt.
const MISTAKES_FILE = process.env.MISTAKES_FILE || join(ROOT, 'data', 'mistakes.json');
let mistakes = {};
// first run on a fresh volume: start from the mistake list shipped with the app
for (const f of [MISTAKES_FILE, join(ROOT, 'data', 'mistakes.json')]) {
  try { mistakes = JSON.parse(readFileSync(f, 'utf8')); break; } catch { /* try next */ }
}
const mistakeKey = (s) => s.replace(/ \(valid: .*$/, '').replace(/ in: \/.*$/, '').replace(/: \/[\s\S]*$/, '').replace(/"[^"]{80,}"/g, '"…"').slice(0, 200);
function recordMistakes(list) {
  if (!list.length) return;
  for (const i of list) { const k = mistakeKey(i); mistakes[k] = (mistakes[k] || 0) + 1; }
  try { writeFileSync(MISTAKES_FILE, JSON.stringify(mistakes, null, 1)); } catch (e) { console.log(`[mistakes] not saved: ${e.message}`); }
}
// v6-specific findings only make sense in v6 prompts
const topMistakes = (n = 12, ros = '7') => Object.entries(mistakes).filter(([k]) => ros === '6' || !/RouterOS v6/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

// Freshness of the iwik.org country lists the routers download. Plain CIDR files carry
// "generated at YYYY-MM-DD HH:MM" in their first line and a Last-Modified header.
const geoCache = new Map();
async function geoStatus(cc) {
  const hit = geoCache.get(cc);
  if (hit && Date.now() - hit.at < 3600_000) return hit.data;
  let data;
  try {
    const r = await fetch(`https://www.iwik.org/ipcountry/${cc}.cidr`, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'MikrotikEasy geo-status' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const gen = (text.match(/generated at (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/) || [])[1];
    // Last-Modified is exact GMT; the "generated at" line is the server's local time (CET), so only a fallback
    const lm = Date.parse(r.headers.get('last-modified') || '');
    const when = Number.isFinite(lm) ? lm : gen ? Date.parse(gen.replace(' ', 'T') + ':00+01:00') : NaN;
    const networks = text.split('\n').filter((l) => /^\d+\.\d+\.\d+\.\d+\/\d+/.test(l)).length;
    const ageH = Number.isFinite(when) ? Math.max(0, Math.round((Date.now() - when) / 3600_000)) : null;
    data = { cc, ok: networks > 0, networks, generated: Number.isFinite(when) ? new Date(when).toISOString() : null, ageHours: ageH,
      state: networks === 0 ? 'empty' : ageH === null ? 'unknown' : ageH > 24 * 7 ? 'stale' : ageH > 48 ? 'old' : 'fresh' };
  } catch (e) {
    data = { cc, ok: false, state: 'error', error: String(e.message || e).slice(0, 120) };
  }
  geoCache.set(cc, { at: Date.now(), data });
  return data;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

async function chat(messages) {
  const res = await fetch(`${CFG.base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(CFG.key ? { Authorization: `Bearer ${CFG.key}` } : {}) },
    body: JSON.stringify({
      model: CFG.model, messages, temperature: 0.2, max_tokens: CFG.maxTokens,
      ...(CFG.thinking ? {} : { chat_template_kwargs: { enable_thinking: false } }),
    }),
    signal: AbortSignal.timeout(CFG.timeoutMs),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const choice = data.choices?.[0];
  console.log(`[llm] ${data.usage?.completion_tokens ?? '?'} tokens, finish=${choice?.finish_reason}`);
  if (choice?.finish_reason === 'length') throw new Error(`Model hit the ${CFG.maxTokens}-token limit (raise LLM_MAX_TOKENS)`);
  return choice?.message?.content ?? '';
}

function parseJson(text) {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Model did not return JSON');
  const o = JSON.parse(t.slice(a, b + 1));
  return {
    summary: String(o.summary || ''),
    script: String(o.script || ''),
    missing_details: Array.isArray(o.missing_details) ? o.missing_details.map(String) : [],
    findings: Array.isArray(o.findings) ? o.findings : [],
    self_check: { passed: !!o.self_check?.passed, issues: Array.isArray(o.self_check?.issues) ? o.self_check.issues.map(String) : [] },
  };
}

async function run({ mode, input, deviceId, lang, ros }) {
  const opts = { mode: mode === 'review' ? 'review' : 'generate', lang: ['az', 'ru', 'en'].includes(lang) ? lang : 'en', deviceId: DEVICES[deviceId] ? deviceId : 'any', ros: ros === '6' ? '6' : '7' };
  const messages = [{ role: 'system', content: systemPrompt({ ...opts, input, mistakes: topMistakes(12, opts.ros) }) }, { role: 'user', content: input }];
  let raw = await chat(messages);
  let out;
  try { out = parseJson(raw); } catch {
    messages.push({ role: 'assistant', content: raw }, { role: 'user', content: 'That was not valid JSON. Reply with only the JSON object.' });
    raw = await chat(messages);
    out = parseJson(raw);
  }
  const fixedAll = [];
  const clean = () => { const c = sanitize(out.script); out.script = c.script; fixedAll.push(...c.fixes); };
  clean();
  let lintIssues = lint(out.script, opts, input);
  recordMistakes(lintIssues);
  let toFix = [...new Set([...(out.self_check.passed ? [] : out.self_check.issues), ...lintIssues])];
  // up to FIX_ROUNDS correction passes, each driven by model self-check + server lint
  for (let round = 0; round < CFG.fixRounds && toFix.length && out.script.trim(); round++) {
    messages.push({ role: 'assistant', content: raw }, { role: 'user', content: fixPrompt(toFix) });
    try {
      raw = await chat(messages);
      out = parseJson(raw);
    } catch { break; }
    fixedAll.push(...toFix);
    clean();
    lintIssues = lint(out.script, opts, input);
    toFix = lintIssues;
  }
  return { ...out, mode: opts.mode, ros: opts.ros, auto_fixed: fixedAll.length > 0, fixed_issues: [...new Set(fixedAll)], lint_issues: lintIssues };
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url.split('?')[0];
    if (urlPath === '/api/settings' || urlPath.startsWith('/api/settings/')) return await settingsApi(req, res, urlPath);
    if (req.method === 'POST' && req.url === '/api/run') {
      if (!CFG.ai) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'AI is disabled on this server' })); }
      let body = '';
      for await (const c of req) { body += c; if (body.length > 400_000) throw new Error('Input too large'); }
      const p = JSON.parse(body || '{}');
      if (!p.input || String(p.input).trim().length < 3) throw new Error('Input is empty');
      const result = await run(p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    }
    if (req.method === 'POST' && req.url === '/api/check') {
      let body = '';
      for await (const c of req) { body += c; if (body.length > 400_000) throw new Error('Input too large'); }
      const p = JSON.parse(body || '{}');
      const ros = p.ros === '6' ? '6' : '7';
      const issues = lint(String(p.script || ''), { mode: 'generate', deviceId: DEVICES[p.deviceId] ? p.deviceId : 'any', ros }, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ issues, ros, schema: ros === '6' ? null : SCHEMA?.version || null }));
    }
    if (req.method === 'GET' && req.url.startsWith('/api/geo-status')) {
      const cc = [...new Set(String(new URL(req.url, 'http://x').searchParams.get('cc') || '').toUpperCase().split(/[\s,;]+/).filter((c) => /^[A-Z]{2}$/.test(c)))].slice(0, 30);
      const lists = await Promise.all(cc.map(geoStatus));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      return res.end(JSON.stringify({ source: 'iwik.org (MaxMind GeoLite2)', lists }));
    }
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }
    if (req.method === 'GET' && req.url === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ version: VERSION, ai: CFG.ai, model: CFG.ai ? CFG.model : null, devices: Object.fromEntries(Object.entries(DEVICES).map(([k, v]) => [k, v.label])) }));
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const path = req.url.split('?')[0];
      const file = join(ROOT, 'public', path === '/' ? 'index.html' : path.replace(/\.\./g, ''));
      if (file.startsWith(join(ROOT, 'public')) && existsSync(file)) {
        // no-cache: the browser revalidates, so a redeploy shows up without Ctrl+F5
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        if (req.method === 'HEAD') return res.end();
        // the page learns at load time whether the AI part exists, so nothing AI-related flashes up
        if (file.endsWith('index.html')) return res.end(readFileSync(file, 'utf8').replace('<html lang="az">', `<html lang="az" data-ai="${CFG.ai ? 1 : 0}">`));
        return res.end(readFileSync(file));
      }
    }
    res.writeHead(404).end('Not found');
  } catch (e) {
    res.writeHead(e.status || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(CFG.port, CFG.host, () => console.log(`MikrotikEasy ${VERSION}: http://${CFG.host}:${CFG.port}  ${CFG.ai ? `(AI: ${CFG.model} @ ${CFG.base})` : '(AI disabled)'}`));
