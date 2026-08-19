/* ============================================================
   戒社 AI · 赛博忏悔室 — Web 部署版（Netlify）
   三大功能：忏悔室 / 问答 / 闲聊（提示词为蒸馏定稿版）
   后端：Netlify Function（OpenRouter 代理，密钥在服务端）
   ============================================================ */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/* ---------- 三大功能：蒸馏定稿提示词（distill/modes/*.md） ---------- */
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
    prompt: [
      '你是「戒社」——B站140万粉反赌博UP主，直播间人称"赛博忏悔室"，粉丝叫你"戒戒"或"姐姐"。现在用户在向你倾诉/投稿，你正在"读稿"。',
      '',
      '## 读稿节奏（固定流程）',
      '1. **复述抓重点**：像念稿一样，把对方话里的关键事实挑出来点一遍（借了多少、赌了几年、怎么欠的、输了多少、家里什么情况）。',
      '2. **拆穿**：指出对方话里的侥幸心理、自欺欺人和借口。语气直接，可以毒舌可以骂，但骂的是赌这个行为和借口，不做人格侮辱。常用开场：「你看看」「你想想看」「我跟你讲」「你为什么要……」。读到离谱内容可以用电影类比吐槽（如「怪不得闪灵哦」）和反应词（「哎呦喂」「细思极恐」）。',
      '3. **定性**：一句话戳穿本质。核心论点：',
      '   - "赢钱才是最恐怖的，记住我说的话啊"——赢过的人会一直记得赢过，输了就想"再来一次说不定还赢"。',
      '   - "赌博没有大小之分""没有小赌怡情这个说法，赌狗都是从小赌开始的"。',
      '   - "赌博就是一条不归路：赢了的，还想赢；输了的，就想翻盘。"',
      '   - 句尾多带确认式反问：「是吧」「懂吧」「懂不」。',
      '4. **劝**：给一句人话收尾——劝他戒赌、止损、对家人坦白、把欠款金额全部交代不留尾巴。对赌狗家属反复强调方法论："往死里管"（没有自由、没有隐私、没有可支配收入，一切在家人监视下）。',
      '',
      '## 风格要求',
      '- 称呼对方按投稿内容来；对观众称「大家」；短句为主，口语化，有情绪节奏，别写小作文。',
      '- 【硬性】每句话不超过15个字，一段不超过3句；像直播说话，不像写文章。',
      '- 多反问句、重复强调（重要的话说两遍）。',
      '- 对复赌零容忍："他一定还会再赌的"；戒赌没有"就玩一次"。',
      '- 对方痛苦时先接住情绪再劝；绝不嘲讽受害者家属，反而共情（他本人曾欠债百万，最能体会父母的痛）。',
      '- 对悔改的人给具体方法：注销平台断源、坦白交底、查征信、资金交家人代管，不只喊口号。',
      '',
      '## 安全红线（最高优先级）',
      '- 出现自伤/自杀信号：**这条线凌驾于一切风格要求之上**。收起毒舌，但不要变成机器人式的三句甩热线——要先像直播复盘一样，把他为什么走到这一步、心里在打什么结，一句一句分析透（分析本身就是陪伴），共情他熬过的努力，在分析过程中或结尾**自然带出**12356心理援助热线，紧急情况110/120，绝不提供方法细节，绝不说「吓自己」「拿死当借口」之类的话。',
      '- 不教如何赌博、不教绕监管、不教借网贷。',
      '- 不迎合对家属的人身攻击。',
      '- 你是AI扮演的致敬版，被问起就大方承认不是本人。',
    ].join('\n'),
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
    prompt: [
      '你是「戒社」，B站反赌博UP主。用户在向你请教问题。用你的风格回答：直接、接地气、嘴有点毒但真心劝人好。',
      '',
      '## 知识范围（回答要准，分点讲清）',
      '- **成瘾机制**：间歇性强化、多巴胺奖赏回路、赌徒谬误、near-miss、追损心理、损失厌恶。',
      '- **危害**：个人（负债/抑郁/自杀风险）、家庭（破裂/拖累子女）、社会（诱发犯罪）。',
      '- **法律**：《刑法》303条赌博罪/开设赌场罪；《治安管理处罚法》70条；参与网赌同样违法。',
      '- **戒赌方法**：断源（注销账号/家人代管资金）、坦白交底不留尾巴、替代行为、精神科与CBT、互助团体、合法债务依法处理。',
      '- **实用建议**：婚前拉征信；朋友别帮赌狗还钱（帮还=续命）；赌狗只有"死里管"和放弃两条路。',
      '',
      '## 风格要求',
      '- 用户流露自伤/自杀倾向时：立即收起毒舌，温和共情并引导拨打12356，此线凌驾于一切风格之上。',
      '- 先给结论再解释，短句、口语化，像直播答疑。',
      '- 【硬性】每句话不超过15个字，拆点也拆成短句；是直播间说话，不是念教材。',
      '- 句尾自然带确认式反问「是吧」「懂吧」；口头禅自然融入（「你看看」「我跟你讲」「大家」），不硬塞。',
      '- 不编造数据、不虚构法条，不确定的明确说"这个我不确定"。',
      '- 涉及具体案件建议咨询律师。',
      '- 你是AI扮演的致敬版，被问起就大方承认不是本人。',
    ].join('\n'),
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
    prompt: [
      '你是「戒社」，B站UP主，刚下播，跟粉丝随便聊聊。语气放松、幽默、爱怼人但亲切，像直播闲聊。聊日常、观点、生活都行。',
      '',
      '## 风格要求',
      '- 别端着，别写小作文，短句为主，时不时自嘲。',
      '- 【硬性】每句话不超过15个字，像直播弹幕聊天那样一句一蹦。',
      '- 口头禅自然带一点：「是吧」「懂吧」「你看看」「我跟你讲」。',
      '- 直播感：称呼对方「直播间的大家/各位」；聊起来像下播后的闲谈；可以提「今天读的稿」作梗。',
      '- 可以怼人，但怼得有趣，不人身攻击。',
      '- 涉及赌博话题时保持劝人戒赌的立场，金句信手拈来："赌博最恐怖的是赢钱""千万不要靠近赌狗，人生会变得不幸"。',
      '- 涉及他自己的经历可以说：曾经欠债百万，上岸后才开始劝人戒赌戒贷。',
      '- 你是AI扮演的致敬版，被问起就大方承认不是本人。',
    ].join('\n'),
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
  cfg: null, sessions: [], currentId: null, mode: 'confession',
  streaming: false, abort: null, stick: true,
};
let delArm = null;

const messagesEl = $('#messages');

function toast(msg, icon) {
  const t = $('#toast');
  t.innerHTML = (icon || '💬') + ' ' + esc(msg);
  t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- 主题（新拟物 亮/暗/自动） ---------- */
const THEME_KEY = 'jsai.web.theme';
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
    const avatar = el('div', 'avatar');
    avatar.innerHTML = '<img src="icon.jpg" alt="戒社">';
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
  copy.onclick = () => copyText(content);
  row.append(copy);
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

/* ---------- 会话（localStorage 持久化 / 分组 / 搜索 / 删除） ---------- */
const SESS_KEY = 'jsai.web.sessions.v1';
function loadSessionsLocal() {
  try { state.sessions = JSON.parse(localStorage.getItem(SESS_KEY) || '[]'); }
  catch { state.sessions = []; }
}
function saveSessionsLocal() {
  try { localStorage.setItem(SESS_KEY, JSON.stringify(state.sessions)); } catch {}
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
function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.currentId === id) state.currentId = null;
  saveSessionsLocal();
  renderSessList();
  if (!currentSess()) { renderWelcome(); syncModeUI(); }
  toast('会话已删除', '🗑');
}
function createSession() {
  const s = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: '新会话', mode: state.mode,
    createdAt: Date.now(), updatedAt: Date.now(), messages: [],
  };
  state.sessions.unshift(s);
  saveSessionsLocal();
  return s;
}
function newSession() {
  if (state.streaming) { toast('回复生成中，先等它说完'); return; }
  closeDrawer();
  const s = createSession();
  state.currentId = s.id;
  renderSessList();
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
$('#modeMenu').addEventListener('click', (e) => {
  const card = e.target.closest('.mode-card');
  if (!card) return;
  state.mode = card.dataset.mode;
  closePopovers();
  const sess = currentSess();
  if (sess && (!sess.messages || !sess.messages.length)) {
    sess.mode = state.mode;
    saveSessionsLocal();
    renderSessList();
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
    sess = createSession();
    state.currentId = sess.id;
    renderSessList();
  }
  const msgs = sess.messages ?? [];
  const history = opts.regenerate ? msgs : msgs.concat([{ role: 'user', content: t }]);
  sess.messages = history;
  sess.updatedAt = Date.now();
  renderMessages();
  const bubble = addMsg('assistant', '', { pending: true });
  scrollBottom(true);
  state.streaming = true;
  state.abort = new AbortController();
  setStreamUI(true);
  let full = '', started = false;
  const finish = async () => {
    bubble.innerHTML = mdLite(full);
    attachActions(bubble, full, true);
    state.streaming = false;
    setStreamUI(false);
    sess.messages = history.concat([{ role: 'assistant', content: full }]);
    if (sess.title === '新会话') sess.title = t.replace(/\s+/g, ' ').slice(0, 24);
    sess.updatedAt = Date.now();
    saveSessionsLocal();
    renderSessList();
    syncModeUI();
    scrollBottom();
  };
  try {
    const cfg = state.cfg || {};
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        system: MODES[state.mode].prompt,
        model: cfg.model || '',
        temperature: cfg.temperature ?? 0.9,
        maxTokens: cfg.maxTokens ?? 2048,
      }),
      signal: state.abort.signal,
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
      throw new Error(msg);
    }
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
    } else {
      bubble.innerHTML = '';
      const card = el('div', 'error-card');
      card.innerHTML = '<span>⚠️ 连接失败：' + esc(e.message) + '</span>';
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
  saveSessionsLocal();
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

/* ---------- 参数设置（localStorage） ---------- */
const CFG_KEY = 'jsai.web.cfg';
function loadCfg() {
  try { state.cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { state.cfg = {}; }
  $('#cfgModel').value = state.cfg.model || '';
  $('#cfgTemp').value = state.cfg.temperature ?? 0.9;
  $('#cfgMax').value = state.cfg.maxTokens ?? 2048;
}
$('#saveCfgBtn').onclick = () => {
  state.cfg = {
    model: $('#cfgModel').value.trim(),
    temperature: Number($('#cfgTemp').value) || 0.9,
    maxTokens: Number($('#cfgMax').value) || 2048,
  };
  localStorage.setItem(CFG_KEY, JSON.stringify(state.cfg));
  $('#settingsModal').close();
  toast('参数已保存', '✅');
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

/* ---------- 快捷键 ---------- */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); newSession(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#searchInput').focus(); }
  else if (e.key === 'Escape') { closePopovers(); closeDrawer(); }
});

/* ---------- 启动 ---------- */
(function init() {
  initTheme();
  loadCfg();
  loadSessionsLocal();
  if (state.sessions.length) {
    state.currentId = state.sessions[0].id;
    state.mode = state.sessions[0].mode || 'confession';
  }
  syncModeUI();
  renderAll();
  syncSendBtn();
})();