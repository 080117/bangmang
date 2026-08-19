/* ============================================================
   戒社 AI · 赛博忏悔室 — 前端逻辑 v2
   三大功能：忏悔室(confession) / 问答(qa) / 闲聊(chat)
   架构：ChatGPT 式（侧栏 + 居中对话列 + 悬浮输入区 + 模式选择器）
   ============================================================ */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/* ---------- 三大功能：模式元信息（提示词会被蒸馏版热覆盖） ---------- */
const MODES = {
  confession: {
    name: '忏悔室', icon: '🕯', glyph: '🕯',
    tagline: '读稿 · 拆穿 · 劝醒',
    welcome: {
      h: '赛博忏悔室 · 已开门',
      p: '把你想说的说出来。投稿、倾诉、复赌、悔恨——我都接着。',
      placeholder: '说出来吧，我听着…',
      suggestions: ['我又去赌了，输光了，现在很后悔', '家里人欠了赌债，我该怎么办？', '想复赌，心里痒得不行', '输了钱不敢跟家里说'],
    },
    prompt: "你是「戒社」——B站140万粉反赌博UP主，直播间人称「赛博忏悔室」，专门读粉丝投稿和私信。现在用户在向你倾诉，你正在「读稿」。\n风格要求：\n1. 先复述抓重点：像念稿一样把对方话里的关键事实挑出来点一遍；\n2. 再拆穿：指出对方话里的侥幸心理、自欺欺人和借口，语气直接、可以毒舌可以骂，但骂的是赌这个行为和借口，不做人格侮辱；\n3. 最后劝：给一句人话，劝他戒赌、止损、面对家人、及时收手；\n4. 称呼对方「兄弟」「老哥」，短句为主，口语化，有情绪节奏，别写小作文；\n5. 对方痛苦时先接住情绪再劝，绝不嘲讽受害者家属，绝不幸灾乐祸；\n6. 你是AI扮演的致敬版，被问起就大方承认不是本人。",
  },
  qa: {
    name: '问答', icon: '📖', glyph: '📖',
    tagline: '科普 · 拆套路 · 给方法',
    welcome: {
      h: '问吧，老哥知无不言',
      p: '成瘾机制、平台套路、法律后果、戒赌方法——往死里给你讲明白。',
      placeholder: '想问点什么？直接问…',
      suggestions: ['赌博为什么会上瘾？', '网赌平台后台是怎么控制输赢的？', '欠了网贷和高利贷怎么办？', '怎么才能真正戒掉赌博？'],
    },
    prompt: "你是「戒社」，B站反赌博UP主。用户在向你请教问题。用你的风格回答：直接、接地气、嘴有点毒但真心劝人好。\n涉及赌博成瘾机制、危害、法律后果、戒赌方法时，给出靠谱准确的科普，分点讲清楚，给可执行的行动建议。\n不编造数据、不虚构法条，不确定的明确说「这个我不确定」。",
  },
  chat: {
    name: '闲聊', icon: '☕', glyph: '☕',
    tagline: '下播了 · 随便聊',
    welcome: {
      h: '下播了，随便聊聊',
      p: '日常、观点、吐槽都行，别端着。赌的话题我立场不变。',
      placeholder: '随便聊聊，别见外…',
      suggestions: ['老哥最近过得咋样？', '你是怎么入行做反赌的？', '来点人生建议', '最近有啥有意思的投稿吗？'],
    },
    prompt: "你是「戒社」，B站UP主，刚下播，跟粉丝随便聊聊。语气放松、幽默、爱怼人但亲切，像直播闲聊。聊日常、观点、生活都行。\n别端着，别写小作文，短句为主。涉及赌博话题时保持劝人戒赌的立场。你是AI扮演的致敬版，被问起就大方承认。",
  },
};

/* ---------- 扁平插画（每模式一幅，置于新拟物内凹圆盘中） ---------- */
const ILLUS = {
  confession:
    '<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<ellipse cx="75" cy="128" rx="40" ry="8" fill="#b9c4d2" opacity=".9"/>' +
    '<rect x="57" y="64" width="36" height="58" rx="12" fill="#f7efe0"/>' +
    '<path d="M57 64 h36 v12 a18 11 0 0 1 -36 0 z" fill="#f0dfc0"/>' +
    '<path d="M61 50 q6 -15 14 0 q-7 4 -7 8 q0 -4 -7 -1 z" fill="#f0a13c"/>' +
    '<path d="M70 47 q3.5 -9 7.5 0 q-3.5 2 -3.5 5 q0 -3 -4 0 z" fill="#fff3d6"/>' +
    '<circle cx="75" cy="58" r="30" fill="#f0a13c" opacity=".16"/>' +
    '<path d="M100 26 l1.8 4.5 4.5 1.8 -4.5 1.8 -1.8 4.5 -1.8 -4.5 -4.5 -1.8 4.5 -1.8 z" fill="#f0a13c" opacity=".85"/>' +
    '<path d="M44 92 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 z" fill="#d0453b" opacity=".6"/>' +
    '<path d="M118 70 l1.1 2.8 2.8 1.1 -2.8 1.1 -1.1 2.8 -1.1 -2.8 -2.8 -1.1 2.8 -1.1 z" fill="#c8903a" opacity=".7"/>' +
    '</svg>',
  qa:
    '<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<ellipse cx="75" cy="127" rx="40" ry="8" fill="#b9c4d2" opacity=".9"/>' +
    '<path d="M75 62 C 63 46, 40 44, 27 48 L 27 102 C 40 98, 63 100, 75 116 Z" fill="#fff6e6" stroke="#e2d0ae" stroke-width="2"/>' +
    '<path d="M75 62 C 87 46, 110 44, 123 48 L 123 102 C 110 98, 87 100, 75 116 Z" fill="#f4e7cd" stroke="#e2d0ae" stroke-width="2"/>' +
    '<path d="M71 60 h8 l-4 22 z" fill="#d0453b"/>' +
    '<path d="M75 82 v7 M75 97 v7" stroke="#c8b48c" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="112" cy="34" r="15" fill="#f0a13c"/>' +
    '<text x="112" y="40" font-size="20" font-weight="700" fill="#fff" text-anchor="middle" font-family="Georgia, serif">?</text>' +
    '<path d="M38 30 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#c8903a" opacity=".8"/>' +
    '</svg>',
  chat:
    '<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<ellipse cx="75" cy="126" rx="42" ry="8" fill="#b9c4d2" opacity=".9"/>' +
    '<path d="M40 46 q4 -15 15 -9 M58 52 q4 -15 15 -9 M76 58 q4 -15 15 -9" stroke="#9fb0c2" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M52 66 h46 v8 h-46 z" fill="#e8dcc2"/>' +
    '<path d="M54 74 h42 v30 a8 8 0 0 1 -8 8 h-26 a8 8 0 0 1 -8 -8 z" fill="#f7f1e4"/>' +
    '<path d="M96 80 h14 a11 11 0 0 1 0 22 h-14" fill="none" stroke="#f7f1e4" stroke-width="9"/>' +
    '<path d="M58 88 q10 -7 20 0 t20 0 v24 h-40 z" fill="#7a5233"/>' +
    '<circle cx="119" cy="46" r="6" fill="#d0453b" opacity=".85"/>' +
    '<path d="M32 86 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z" fill="#f0a13c" opacity=".8"/>' +
    '</svg>',
};

/* ---------- 状态 ---------- */
const state = {
  config: null, hasKey: false, sessions: [], currentId: null, mode: 'confession',
  streaming: false, abort: null, stick: true, ttsEnabled: false,
  mic: null, localMicRec: null, speechSynthesisOn: 'speechSynthesis' in window,
};
let currentAudio = null;   // 克隆音色播放器
let delArm = null;         // 会话删除二次确认

const messagesEl = $('#messages');

const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || r.status);
  return d;
};
function toast(msg, icon) {
  const t = $('#toast');
  t.innerHTML = (icon || '💬') + ' ' + esc(msg);
  t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- 主题（新拟物 亮/暗/自动） ---------- */
const THEME_KEY = 'jsai.theme';
function resolveTheme(pref) {
  if (pref === 'dark' || pref === 'light') return pref;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(pref) {
  document.documentElement.dataset.theme = resolveTheme(pref);
  $$('.theme-seg button').forEach(b => b.classList.toggle('active', b.dataset.themeSet === pref));
  $('#themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '🌙';
}
function cycleTheme() {
  const order = ['light', 'dark', 'auto'];
  let pref = localStorage.getItem(THEME_KEY) || 'auto';
  pref = order[(order.indexOf(pref) + 1) % order.length];
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
}
function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'auto');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem(THEME_KEY) || 'auto') === 'auto') applyTheme('auto');
  });
  $$('.theme-seg button').forEach(b => b.onclick = () => {
    localStorage.setItem(THEME_KEY, b.dataset.themeSet);
    applyTheme(b.dataset.themeSet);
  });
  $('#themeBtn').onclick = cycleTheme;
}

/* ---------- Markdown-lite ---------- */
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mdLite(src) {
  let s = esc(src);
  const codeBlocks = [];
  s = s.replace(/\x60{3}([\s\S]*?)\x60{3}/g, (_, c) => { codeBlocks.push(c.trim()); return '\x01B' + (codeBlocks.length - 1) + '\x01'; });
  s = s.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  s = s.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
  s = s.replace(/^\s*---\s*$/gm, '<hr>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
  s = s.replace(/\x01B(\d+)\x01/g, (_, i) => '<pre><code>' + esc(codeBlocks[i]) + '</code></pre>');
  return s;
}

/* ---------- 消息渲染 ---------- */
function currentSess() { return state.sessions.find(s => s.id === state.currentId) || null; }

function renderWelcome() {
  const m = MODES[state.mode] || MODES.confession;
  messagesEl.innerHTML = '';
  const wrap = el('div', 'welcome');
  const hero = el('div', 'welcome-hero');
  hero.innerHTML =
    '<div class="illu-wrap">' + ILLUS[state.mode] + '</div>' +
    '<h2>' + esc(m.welcome.h) + '</h2>' +
    '<p>' + esc(m.welcome.p) + '</p>';
  const grid = el('div', 'suggest-grid');
  for (const sug of m.welcome.suggestions) {
    const b = el('button', 'suggest');
    b.innerHTML = '<span class="suggest-icon">' + m.glyph + '</span>' + esc(sug);
    b.onclick = () => send(sug);
    grid.append(b);
  }
  wrap.append(hero, grid);
  messagesEl.append(wrap);
}

function addMsg(role, content, opts = {}) {
  const wrap = el('div', 'msg ' + role);
  if (role === 'assistant') {
    const avatar = el('div', 'avatar', '戒');
    const body = el('div', 'body');
    const name = el('div', 'name', '戒社');
    const bubble = el('div', 'bubble');
    if (opts.pending) bubble.innerHTML = '<span class="typing" style="display:inline-flex;gap:4px"><i></i><i></i><i></i></span>';
    else bubble.innerHTML = mdLite(content);
    body.append(name, bubble);
    wrap.append(avatar, body);
    messagesEl.append(wrap);
    return bubble;
  }
  const bubble = el('div', 'bubble', mdLite(content));
  wrap.append(bubble);
  messagesEl.append(wrap);
  return bubble;
}

function attachActions(bubble, content, canRegenerate) {
  const row = el('div', 'msg-actions');
  const copy = el('button', 'act-btn', '📋 复制');
  const speakB = el('button', 'act-btn', '🔊 朗读');
  copy.onclick = () => copyText(content);
  speakB.onclick = async function () { await speak(content, this); };
  row.append(copy, speakB);
  if (canRegenerate) {
    const reg = el('button', 'act-btn', '↻ 重新生成');
    reg.onclick = () => regenerate();
    row.append(reg);
  }
  bubble.after(row);
}

function renderMessages() {
  messagesEl.innerHTML = '';
  const sess = currentSess();
  const msgs = sess?.messages ?? [];
  const bubbles = [];
  for (const m of msgs) {
    if (m.role === 'assistant' && m.content) bubbles.push({ b: addMsg('assistant', m.content), c: m.content });
    else addMsg(m.role, m.content);
  }
  bubbles.forEach((x, i) => attachActions(x.b, x.c, i === bubbles.length - 1));
}

function renderAll() {
  const sess = currentSess();
  if (!sess || !sess.messages || !sess.messages.length) renderWelcome();
  else renderMessages();
  scrollBottom(true);
}

function scrollBottom(instant) {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
}
messagesEl.addEventListener('scroll', () => {
  const nb = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  $('#scrollBtn').hidden = nb;
  state.stick = nb;
});
$('#scrollBtn').onclick = () => scrollBottom();

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制到剪贴板', '📋'); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板', '📋'); }
    catch { toast('复制失败，请手动选择复制'); }
    ta.remove();
  }
}

/* ---------- 会话（分组 / 搜索 / 删除） ---------- */
async function loadSessions() {
  try { state.sessions = await api('/api/sessions'); }
  catch (e) { toast('会话列表加载失败：' + e.message); state.sessions = []; }
  renderSessList();
}
function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return '前 7 天';
  return '更早';
}
function renderSessList() {
  const list = $('#sessionList'); list.innerHTML = '';
  const q = ($('#searchInput').value || '').trim().toLowerCase();
  const items = state.sessions.filter(s => !q || String(s.title || '').toLowerCase().includes(q));
  if (!items.length) {
    list.innerHTML = '<div class="sess-empty">' + (q ? '没有匹配的会话' : '还没有会话<br>点「新开一场」开始') + '</div>';
    return;
  }
  let lastGroup = null;
  for (const s of items) {
    const g = dayLabel(s.updatedAt);
    if (g !== lastGroup) { list.append(el('div', 'sess-group', g)); lastGroup = g; }
    const item = el('div', 'sess-item' + (s.id === state.currentId ? ' active' : ''));
    const glyph = el('span', 'sess-glyph', (MODES[s.mode] || MODES.confession).glyph);
    const t = el('span', 't', esc(s.title || '新会话'));
    t.title = s.title || '新会话';
    const d = el('button', 'del', '✕');
    d.title = '删除会话';
    item.append(glyph, t, d);
    item.onclick = () => {
      state.currentId = s.id; state.mode = s.mode || 'confession';
      syncModeUI(); renderAll(); closeDrawer();
    };
    d.onclick = (e) => {
      e.stopPropagation();
      if (delArm === s.id) { delArm = null; deleteSession(s.id); return; }
      delArm = s.id; d.textContent = '删除?'; d.classList.add('arm');
      setTimeout(() => { if (delArm === s.id) { delArm = null; renderSessList(); } }, 2500);
    };
    list.append(item);
  }
}
async function deleteSession(id) {
  try {
    await api('/api/sessions/' + id, { method: 'DELETE' });
    if (state.currentId === id) state.currentId = null;
    await loadSessions();
    if (!currentSess()) { renderWelcome(); syncModeUI(); }
    toast('会话已删除', '🗑');
  } catch (e) { toast('删除失败：' + e.message); }
}
async function createSession() {
  try { return await api('/api/sessions', { method: 'POST', body: JSON.stringify({ mode: state.mode }) }); }
  catch (e) { toast('创建会话失败：' + e.message); return null; }
}
async function newSession() {
  if (state.streaming) { toast('回复生成中，先等它说完'); return; }
  closeDrawer();
  const s = await createSession();
  if (!s) return;
  state.currentId = s.id;
  await loadSessions();
  syncModeUI(); renderAll();
  $('#input').focus();
}

/* ---------- 模式切换（三大功能） ---------- */
function syncModeUI() {
  const m = MODES[state.mode] || MODES.confession;
  $('#modeBtn').innerHTML = m.icon + ' ' + m.name + ' <span class="chev">▾</span>';
  $$('#modeMenu .mode-card').forEach(c => c.classList.toggle('active', c.dataset.mode === state.mode));
  const i = $('#input');
  if (!i.value.trim()) i.placeholder = m.welcome.placeholder;
  const s = currentSess();
  $('#sessionTitle').textContent = (s && s.title && s.title !== '新会话') ? s.title : (m.icon + ' ' + m.name);
}
function closePopovers() {
  $('#modeMenu').hidden = true;
  $('#modeBtn').setAttribute('aria-expanded', 'false');
}
$('#modeBtn').onclick = (e) => {
  e.stopPropagation();
  const m = $('#modeMenu');
  const willOpen = m.hidden;
  closePopovers();
  if (willOpen) { m.hidden = false; $('#modeBtn').setAttribute('aria-expanded', 'true'); }
};
$('#modeMenu').addEventListener('click', async (e) => {
  const card = e.target.closest('.mode-card');
  if (!card) return;
  state.mode = card.dataset.mode;
  closePopovers();
  const sess = currentSess();
  if (sess && (!sess.messages || !sess.messages.length)) {
    sess.mode = state.mode;
    await api('/api/sessions/' + sess.id, { method: 'PATCH', body: JSON.stringify({ mode: state.mode }) }).catch(() => {});
    await loadSessions();
  }
  syncModeUI();
  renderAll();
  toast('已切换到「' + MODES[state.mode].name + '」', MODES[state.mode].icon);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.mode-picker')) closePopovers();
});

/* ---------- 发送 / 流式 / 停止 / 重新生成 ---------- */
async function send(text, opts = {}) {
  const t = String(text ?? '').trim();
  if (!t || state.streaming) return;
  closePopovers();
  closeDrawer();
  let sess = currentSess();
  if (!sess) {
    const s = await createSession();
    if (!s) return;
    state.currentId = s.id;
    await loadSessions();
    sess = currentSess();
    if (!sess) return;
  }
  const msgs = sess.messages ?? [];
  const history = opts.regenerate ? msgs : msgs.concat([{ role: 'user', content: t }]);
  sess.messages = history;
  renderMessages();
  const bubble = addMsg('assistant', '', { pending: true });
  scrollBottom(true);
  state.streaming = true;
  state.abort = new AbortController();
  setStreamUI(true);
  stopSpeak();
  let full = '', started = false;
  const finish = async () => {
    bubble.innerHTML = mdLite(full);
    attachActions(bubble, full, true);
    state.streaming = false;
    setStreamUI(false);
    if (state.ttsEnabled && full.trim()) speak(full);
    await loadSessions();
    syncModeUI();
    scrollBottom();
  };
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.currentId, messages: history, system: MODES[state.mode].prompt, replace: !!opts.regenerate }),
      signal: state.abort.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { await finish(); break; }
      buf += dec.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop();
      for (const evt of events) {
        const lines = evt.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            if (j.meta?.crisis) showCrisis();
            if (j.error) { bubble.innerHTML = mdLite('⚠️ 出错了：' + j.error); }
            if (j.delta) {
              if (!started) { bubble.innerHTML = ''; started = true; }
              full += j.delta;
              bubble.innerHTML = mdLite(full) + '<span class="cursor"></span>';
              if (state.stick) scrollBottom(true);
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      bubble.innerHTML = mdLite(full) +
        '<div style="font-size:12px;color:var(--faint);margin-top:8px">⏹ 已停止生成</div>';
      state.streaming = false;
      setStreamUI(false);
      await loadSessions();
    } else {
      bubble.innerHTML = '';
      const card = el('div', 'error-card');
      card.innerHTML = '<span>⚠️ 连接失败：' + esc(e.message) + '（可在 ⚙ 设置里检查模型接入）</span>';
      const btn = el('button', 'retry-btn', '重试');
      btn.onclick = () => regenerate();
      card.append(btn);
      bubble.append(card);
      state.streaming = false;
      setStreamUI(false);
    }
  }
}
async function regenerate() {
  if (state.streaming) return;
  const sess = currentSess();
  if (!sess) return;
  const msgs = sess.messages ?? [];
  let li = -1;
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user') { li = i; break; }
  if (li === -1) { toast('没有可重新生成的消息'); return; }
  const lastUser = msgs[li].content;
  sess.messages = msgs.slice(0, li + 1);
  await send(lastUser, { regenerate: true });
}
function setStreamUI(streaming) {
  const b = $('#sendBtn');
  if (streaming) {
    b.classList.add('stop');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';
    b.disabled = false;
    b.title = '停止生成'; b.setAttribute('aria-label', '停止生成');
  } else {
    b.classList.remove('stop');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.disabled = !$('#input').value.trim();
    b.title = '发送'; b.setAttribute('aria-label', '发送');
  }
}
function stopStream() { if (state.abort) state.abort.abort(); }
function crisisOffset() {
  const b = $('#crisisBanner');
  if (b && !b.hidden) document.body.style.setProperty('--toast-top', (b.offsetHeight + 72) + 'px');
  else document.body.style.removeProperty('--toast-top');
}
function showCrisis() {
  $('#crisisBanner').hidden = false;
  clearTimeout(showCrisis._t);
  showCrisis._t = setTimeout(() => { $('#crisisBanner').hidden = true; crisisOffset(); }, 45000);
  crisisOffset();
}
window.addEventListener('resize', crisisOffset);

/* ---------- TTS ---------- */
let currentUtterance = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  return vs.find(v => /Xiaoxiao|晓晓/i.test(v.name) && /zh/i.test(v.lang))
    || vs.find(v => /zh/i.test(v.lang))
    || vs.find(v => /Microsoft Huihui|Yunxi|云希/i.test(v.name)) || vs[0];
}
async function speak(text, btn) {
  stopSpeak();
  const clean = text.replace(/[*#\x60>\[\]]/g, '');
  if (state.config?.ttsEngine === 'clone') {
    if (btn) btn.textContent = '⏳ 合成中…';
    toast('音色克隆合成中，稍等…（较慢）');
    try {
      const r = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean.slice(0, 80) }),
      });
      if (r.status === 429) throw new Error('上一条还没合成完，稍等再点');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; };
      currentAudio.play().catch(() => toast('播放被浏览器拦截，请用系统浏览器（Edge/Chrome）打开本页'));
    } catch (e) {
      toast('克隆TTS失败：' + e.message + '（需先启动 tts/tts_server.py）');
    }
    if (btn) btn.textContent = '🔊 朗读';
    return;
  }
  if (!state.speechSynthesisOn) { toast('当前浏览器不支持语音合成'); return; }
  currentUtterance = new SpeechSynthesisUtterance(clean);
  currentUtterance.lang = 'zh-CN';
  const v = pickVoice(); if (v) currentUtterance.voice = v;
  currentUtterance.rate = 1.05; currentUtterance.pitch = 0.95;
  speechSynthesis.speak(currentUtterance);
}
function stopSpeak() {
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}
$('#ttsToggle').onclick = () => { state.ttsEnabled = !state.ttsEnabled; syncTTSBtn(); toast(state.ttsEnabled ? '已开启自动朗读' : '已关闭自动朗读', '🔊'); };
function syncTTSBtn() {
  $('#ttsToggle').textContent = state.ttsEnabled ? '🔊' : '🔇';
  $('#ttsToggle').classList.toggle('on', state.ttsEnabled);
}

/* ---------- 语音输入（浏览器识别 + 本地 whisper 兜底） ---------- */
async function startLocalASR() {
  if (state.localMicRec) return;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (err) { toast('麦克风不可用: ' + (err.name || err.message) + '（页面需在 127.0.0.1 或 https 打开）'); return; }
  const rec = new MediaRecorder(stream);
  const chunks = [];
  state.localMicRec = rec;
  $('#micBtn').classList.add('listening');
  toast('本地识别中：说完了再点一下麦克风结束', '🎤');
  rec.ondataavailable = e => chunks.push(e.data);
  rec.onstop = async () => {
    state.localMicRec = null;
    $('#micBtn').classList.remove('listening');
    stream.getTracks().forEach(t => t.stop());
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    toast('识别中…', '🎤');
    try {
      const r = await fetch('/api/asr', { method: 'POST', body: blob });
      const d = await r.json();
      if (d.text) { $('#input').value = d.text; autoGrow(); syncSendBtn(); toast('识别完成', '✅'); }
      else toast('没识别到内容，靠近麦克风再试一次');
    } catch (e) { toast('本地识别服务不可用（需启动 tts/asr_server.py）: ' + e.message); }
  };
  rec.start();
}
function toggleMic() {
  if (state.streaming) { toast('回复生成中，先等它说完'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (state.mic) { state.mic.stop(); return; }
  if (state.localMicRec) { state.localMicRec.stop(); return; }
  if (!SR) { startLocalASR(); return; }
  const rec = new SR();
  rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false;
  state.mic = rec;
  $('#micBtn').classList.add('listening');
  rec.onresult = (e) => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    $('#input').value = t; autoGrow(); syncSendBtn();
  };
  rec.onend = () => { state.mic = null; $('#micBtn').classList.remove('listening'); };
  rec.onerror = (e) => {
    const hints = {
      'not-allowed': '没有麦克风权限，点地址栏左侧的锁图标允许麦克风',
      'network': '浏览器语音服务连不上（Google 服务国内不通）',
      'no-speech': '没听到声音，检查麦克风是否被占用/静音',
      'audio-capture': '找不到麦克风设备',
      'service-not-allowed': '浏览器/系统禁用了语音服务',
    };
    $('#micBtn').classList.remove('listening');
    if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'not-allowed') {
      toast('浏览器语音识别不可用（' + (hints[e.error] || e.error) + '），自动切换本地识别');
      startLocalASR();
    } else {
      toast('语音识别失败: ' + e.error + '——' + (hints[e.error] || '换个浏览器试试'));
    }
  };
  rec.start();
}

/* ---------- 设置 ---------- */
function showHint() {
  const h = $('#keyHint');
  h.textContent = state.hasKey ? 'AI 生成 · 非本人 · 仅供娱乐' : '⚠️ 尚未配置模型 Key，点左侧 ⚙ 设置';
  h.classList.toggle('warn', !state.hasKey);
}
async function loadConfig() {
  try {
    state.config = await api('/api/config');
    const c = state.config;
    state.hasKey = !!c.hasKey;
    state.ttsEnabled = !!c.ttsEnabled;
    $('#cfgProvider').value = c.provider || 'deepseek';
    $('#cfgBaseURL').value = c.baseURL || '';
    $('#cfgModel').value = c.model || '';
    $('#cfgTemp').value = c.temperature ?? 0.9;
    $('#cfgMax').value = c.maxTokens ?? 2048;
    $('#cfgTTS').checked = !!c.ttsEnabled;
    $('#cfgTtsEngine').value = c.ttsEngine || 'browser';
    $('#cfgKey').placeholder = c.hasKey ? '已保存 · 留空不变' : '未配置';
    syncTTSBtn(); showHint();
  } catch { showHint(); }
}
$('#cfgProvider').addEventListener('change', () => {
  const presets = state.config?.presets ?? {};
  const p = presets[$('#cfgProvider').value];
  if (p?.baseURL) $('#cfgBaseURL').value = p.baseURL;
  if (p?.model) $('#cfgModel').value = p.model;
});
async function saveConfig(closeAfter) {
  const body = {
    provider: $('#cfgProvider').value, baseURL: $('#cfgBaseURL').value.trim(),
    model: $('#cfgModel').value.trim(), temperature: Number($('#cfgTemp').value),
    maxTokens: Number($('#cfgMax').value), ttsEnabled: $('#cfgTTS').checked,
    ttsEngine: $('#cfgTtsEngine').value,
  };
  if ($('#cfgKey').value.trim()) body.apiKey = $('#cfgKey').value.trim();
  await api('/api/config', { method: 'PUT', body: JSON.stringify(body) });
  $('#cfgKey').value = '';
  if (!state.config) state.config = {};
  Object.assign(state.config, body);
  if (body.apiKey) state.hasKey = true;
  state.ttsEnabled = body.ttsEnabled;
  syncTTSBtn(); showHint();
  if (closeAfter) {
    $('#settingsModal').close();
    toast('设置已保存', '✅');
  }
}
$('#saveCfgBtn').onclick = () => saveConfig(true);
$('#testBtn').onclick = async () => {
  const r = $('#testResult');
  r.textContent = '测试中…'; r.className = 'test-result';
  try { await saveConfig(false); }
  catch (e) { r.textContent = '❌ 保存失败：' + e.message; r.className = 'test-result err'; return; }
  try {
    const d = await api('/api/test', { method: 'POST', body: '{}' });
    r.textContent = '✅ ' + (d.reply || '连接成功');
    r.className = 'test-result ok';
  } catch (e) {
    r.textContent = '❌ ' + e.message;
    r.className = 'test-result err';
  }
};
$('#settingsBtn').onclick = () => { $('#settingsModal').showModal(); };
$('#hotlineBtn').onclick = $('#hotlineBtn2').onclick = () => { $('#hotlineModal').showModal(); };
$('#crisisClose').onclick = () => { $('#crisisBanner').hidden = true; clearTimeout(showCrisis._t); crisisOffset(); };

/* ---------- 输入区 ---------- */
function autoGrow() { const i = $('#input'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 160) + 'px'; }
function syncSendBtn() { if (!state.streaming) $('#sendBtn').disabled = !$('#input').value.trim(); }
$('#input').addEventListener('input', () => { autoGrow(); syncSendBtn(); });
$('#input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($('#input').value); }
});
$('#sendBtn').onclick = () => { state.streaming ? stopStream() : send($('#input').value); };
$('#micBtn').onclick = toggleMic;
$('#newChatBtn').onclick = newSession;
$('#searchInput').addEventListener('input', renderSessList);

/* ---------- 侧栏抽屉 / 折叠 ---------- */
const isMobile = () => matchMedia('(max-width: 900px)').matches;
function openDrawer() { $('#sidebar').classList.add('open'); $('#backdrop').hidden = false; }
function closeDrawer() { $('#sidebar').classList.remove('open'); $('#backdrop').hidden = true; }
$('#menuBtn').onclick = () => { isMobile() ? openDrawer() : $('#app').classList.toggle('collapsed'); };
$('#sidebarClose').onclick = closeDrawer;
$('#backdrop').onclick = closeDrawer;
matchMedia('(max-width: 900px)').addEventListener('change', (e) => { if (!e.matches) closeDrawer(); });

/* ---------- 金句试听（预合成克隆音频，秒播） ---------- */
let clipAudio = null;
$$('.clip').forEach(b => b.onclick = () => {
  if (clipAudio) { clipAudio.pause(); clipAudio = null; }
  $$('.clip').forEach(x => {
    x.classList.remove('playing');
    x.querySelector('.clip-play').textContent = '▶';
  });
  b.classList.add('playing');
  b.querySelector('.clip-play').textContent = '▣';
  clipAudio = new Audio(b.dataset.clip);
  const done = () => { b.classList.remove('playing'); b.querySelector('.clip-play').textContent = '▶'; clipAudio = null; };
  clipAudio.onended = done;
  clipAudio.onerror = () => { done(); toast('音频播放失败，试试在系统浏览器里打开页面'); };
  clipAudio.play().catch(() => { done(); toast('播放被浏览器拦截，请用系统浏览器（Edge/Chrome）打开本页'); });
});

/* ---------- 人格文档热加载 ---------- */
async function loadPersona() {
  try {
    const d = await api('/api/persona');
    if (d.modes?.confession) MODES.confession.prompt = d.modes.confession;
    if (d.modes?.qa) MODES.qa.prompt = d.modes.qa;
    if (d.modes?.chat) MODES.chat.prompt = d.modes.chat;
    return !!d.persona;
  } catch { return false; }
}

/* ---------- 快捷键 ---------- */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); newSession(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#searchInput').focus(); }
  else if (e.key === 'Escape') { closePopovers(); closeDrawer(); }
});

/* ---------- 启动 ---------- */
(async function init() {
  initTheme();
  await loadPersona();
  await loadConfig();
  await loadSessions();
  if (state.sessions.length) {
    state.currentId = state.sessions[0].id;
    state.mode = state.sessions[0].mode || 'confession';
  }
  syncModeUI();
  renderAll();
  syncSendBtn();
})();