// 戒社AI 本地服务（零依赖 Node 22+）
// 用法: node app/server.mjs  ->  http://127.0.0.1:7788
import http from 'node:http';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const SESS_DIR = path.join(DATA_DIR, 'sessions');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const PORT = Number(process.env.PORT ?? 7788);
const TTS_URL = process.env.TTS_URL ?? 'http://127.0.0.1:7790';
const ASR_URL = process.env.ASR_URL ?? 'http://127.0.0.1:7791';

await mkdir(SESS_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.9,
  maxTokens: 2048,
  ttsEnabled: false,
  ttsEngine: 'browser',
};
const PROVIDER_PRESETS = {
  deepseek:   { name: 'DeepSeek',        baseURL: 'https://api.deepseek.com/v1',            model: 'deepseek-chat' },
  siliconflow:{ name: '硅基流动',         baseURL: 'https://api.siliconflow.cn/v1',          model: 'deepseek-ai/DeepSeek-V3' },
  openrouter: { name: 'OpenRouter',      baseURL: 'https://openrouter.ai/api/v1',           model: 'deepseek/deepseek-chat:free' },
  qwen:       { name: '通义千问',         baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  custom:     { name: '自定义',           baseURL: '', model: '' },
};

function loadConfig() {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) }; }
  catch { return { ...DEFAULT_CONFIG }; }
}
const readFileSync = (await import('node:fs')).readFileSync;
async function saveConfig(cfg) { await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8'); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

const CRISIS_PATTERN = /自杀|自残|想死|不想活|活不下去|轻生|结束生命|了结自己|跳楼|割腕|烧炭|吞药|安眠药自杀|遗书|不想活了|死了算了|一了百了|解脱了|活着没意思|活腻了|生无可恋|重开/;
const CRISIS_INSTRUCTION = '【安全指令】用户上一条消息疑似表达自伤/自杀倾向。请转为温和关切的口吻，但不要变成机器人式的三句甩热线：先共情、接住情绪，然后像直播复盘一样把他为什么走到这一步、心里在打什么结一句一句分析透（分析本身就是陪伴），肯定他熬过的努力，在分析过程中或结尾自然带出全国统一心理援助热线 12356，或联系家人朋友陪伴，情况紧急时拨打 110/120；不要评价、不要刺激、绝不提供任何方法细节。';

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function readRawBody(req) {
  return new Promise((ok, err) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > 20e6) { req.destroy(); err(new Error('body too large')); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', err);
  });
}
function readBody(req) { return new Promise((ok, err) => { let b = ''; req.on('data', c => { b += c; if (b.length > 5e6) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { err(e); } }); req.on('error', err); }); }

async function listSessions() {
  const files = (await readdir(SESS_DIR)).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try { const s = JSON.parse(await readFile(path.join(SESS_DIR, f), 'utf8')); out.push({ id: s.id, title: s.title, mode: s.mode, createdAt: s.createdAt, updatedAt: s.updatedAt, messages: s.messages ?? [] }); } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---- 上游流式调用 ----
async function streamUpstream(cfg, messages, onDelta) {
  const res = await fetch(cfg.baseURL.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, max_tokens: cfg.maxTokens, stream: true }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`上游 ${res.status}: ${t.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {}
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    // ---- 静态文件 ----
    if (req.method === 'GET' && !p.startsWith('/api/')) {
      let fp = path.join(PUBLIC, p === '/' ? 'index.html' : p.replace(/^\//, ''));
      if (!existsSync(fp) || !fp.startsWith(PUBLIC)) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(fp));
      return;
    }
    // ---- 人格文档（蒸馏产物热加载）----
    if (p === '/api/persona' && req.method === 'GET') {
      const out = { persona: null, modes: {} };
      const personaPath = path.join(__dirname, '..', 'distill', 'jieshe-persona.md');
      if (existsSync(personaPath)) out.persona = await readFile(personaPath, 'utf8');
      for (const m of ['confession', 'qa', 'chat']) {
        const mp = path.join(__dirname, '..', 'distill', 'modes', m + '.md');
        if (existsSync(mp)) out.modes[m] = await readFile(mp, 'utf8');
      }
      json(res, 200, out);
      return;
    }
    // ---- 配置 ----
    if (p === '/api/config' && req.method === 'GET') {
      const cfg = loadConfig();
      json(res, 200, { ...cfg, apiKey: '', hasKey: !!cfg.apiKey, presets: PROVIDER_PRESETS });
      return;
    }
    if (p === '/api/config' && req.method === 'PUT') {
      const body = await readBody(req);
      const cfg = loadConfig();
      if (body.apiKey !== undefined && body.apiKey !== '') cfg.apiKey = body.apiKey;
      for (const k of ['provider', 'baseURL', 'model', 'temperature', 'maxTokens', 'ttsEnabled', 'ttsEngine']) if (body[k] !== undefined) cfg[k] = body[k];
      await saveConfig(cfg);
      json(res, 200, { ok: true, hasKey: !!cfg.apiKey });
      return;
    }
    // ---- 连接测试 ----
    if (p === '/api/test' && req.method === 'POST') {
      const cfg = loadConfig();
      if (!cfg.apiKey) { json(res, 400, { ok: false, error: '未配置 API Key' }); return; }
      try {
        const r = await fetch(cfg.baseURL.replace(/\/$/, '') + '/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: '你好，请回复"连接成功"' }], max_tokens: 20 }),
        });
        const d = await r.json().catch(() => ({}));
        json(res, r.ok ? 200 : 502, r.ok ? { ok: true, reply: d.choices?.[0]?.message?.content?.slice(0, 60) } : { ok: false, error: `${r.status} ${JSON.stringify(d).slice(0, 200)}` });
      } catch (e) { json(res, 502, { ok: false, error: e.message }); }
      return;
    }
    // ---- TTS / ASR 同源代理（前端只访问一个源，朋友端才可用）----
    if (p === '/api/tts' && req.method === 'POST') {
      try {
        const body = await readRawBody(req);
        const up = await fetch(TTS_URL + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const buf = Buffer.from(await up.arrayBuffer());
        res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'audio/wav', 'Cache-Control': 'no-store' });
        res.end(buf);
      } catch (e) { json(res, 502, { error: '克隆TTS服务不可用（需启动 tts/tts_server.py）: ' + e.message }); }
      return;
    }
    if (p === '/api/asr' && req.method === 'POST') {
      try {
        const body = await readRawBody(req);
        const up = await fetch(ASR_URL + '/asr', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || 'audio/webm' }, body });
        const buf = Buffer.from(await up.arrayBuffer());
        res.writeHead(up.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(buf);
      } catch (e) { json(res, 502, { error: '语音识别服务不可用（需启动 tts/asr_server.py）: ' + e.message }); }
      return;
    }
    // ---- 会话 ----
    if (p === '/api/sessions' && req.method === 'GET') { json(res, 200, await listSessions()); return; }
    if (p === '/api/sessions' && req.method === 'POST') {
      const body = await readBody(req);
      const s = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), title: '新会话', mode: body.mode ?? 'confession', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      await writeFile(path.join(SESS_DIR, s.id + '.json'), JSON.stringify(s, null, 2), 'utf8');
      json(res, 200, s); return;
    }
    const sm = p.match(/^\/api\/sessions\/([\w-]+)$/);
    if (sm) {
      const fp = path.join(SESS_DIR, sm[1] + '.json');
      if (!existsSync(fp)) { json(res, 404, { error: 'not found' }); return; }
      if (req.method === 'GET') { json(res, 200, JSON.parse(await readFile(fp, 'utf8'))); return; }
      if (req.method === 'DELETE') { await unlink(fp); json(res, 200, { ok: true }); return; }
      if (req.method === 'PATCH') {
        const body = await readBody(req);
        const s = JSON.parse(await readFile(fp, 'utf8'));
        if (body.title) s.title = body.title;
        if (body.mode) s.mode = body.mode;
        s.updatedAt = Date.now();
        await writeFile(fp, JSON.stringify(s, null, 2), 'utf8');
        json(res, 200, { ok: true }); return;
      }
    }
    // ---- 对话（SSE 流式）----
    if (p === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req);
      const cfg = loadConfig();
      const fp = path.join(SESS_DIR, body.sessionId + '.json');
      const sess = existsSync(fp) ? JSON.parse(await readFile(fp, 'utf8')) : null;
      if (!sess) { json(res, 404, { error: 'session not found' }); return; }

      const lastUser = [...body.messages].reverse().find(m => m.role === 'user')?.content ?? '';
      const crisis = CRISIS_PATTERN.test(lastUser);
      const sys = body.system + (crisis ? '\n\n' + CRISIS_INSTRUCTION : '');
      const upstream = [{ role: 'system', content: sys }, ...body.messages];

      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      res.write(`data: ${JSON.stringify({ meta: { crisis } })}\n\n`);
      let aborted = false;
      res.on('close', () => { aborted = true; });
      let full = '';
      try {
        await streamUpstream(cfg, upstream, (delta) => {
          if (aborted) throw new Error('client aborted');
          full += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        });
        res.write('data: [DONE]\n\n');
        if (body.replace) { while (sess.messages.length && sess.messages[sess.messages.length - 1].role === 'assistant') sess.messages.pop(); }
        sess.messages.push(...body.messages.slice(sess.messages.length), { role: 'assistant', content: full, ts: Date.now() });
        if (sess.title === '新会话') {
          const first = body.messages.find(m => m.role === 'user')?.content ?? '';
          sess.title = first.replace(/\s+/g, ' ').slice(0, 24);
        }
        sess.updatedAt = Date.now();
        await writeFile(fp, JSON.stringify(sess, null, 2), 'utf8');
      } catch (e) {
        if (!aborted) { try { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); } catch { /* 连接已断开 */ } }
      }
      try { res.end(); } catch { /* 连接已断开 */ }
      return;
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`戒社AI 本地服务: http://127.0.0.1:${PORT}`));
