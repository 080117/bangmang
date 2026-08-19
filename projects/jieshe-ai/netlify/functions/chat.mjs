// 戒社 AI · Netlify Function：OpenRouter 聊天代理
// 密钥在服务端环境变量（OPENROUTER_API_KEY），前端不接触密钥。
// 上游为 OpenAI 兼容 SSE，这里转成前端已有契约：meta(crisis) / delta / error / [DONE]

const CRISIS_PATTERN = /自杀|自残|想死|不想活|活不下去|轻生|结束生命|了结自己|跳楼|割腕|烧炭|吞药|安眠药自杀|遗书|不想活了|死了算了|一了百了|解脱了|活着没意思|活腻了|生无可恋|重开/;
const CRISIS_INSTRUCTION = '【安全指令】用户上一条消息疑似表达自伤/自杀倾向。请转为温和关切的口吻，但不要变成机器人式的三句甩热线：先共情、接住情绪，然后像直播复盘一样把他为什么走到这一步、心里在打什么结一句一句分析透（分析本身就是陪伴），肯定他熬过的努力，在分析过程中或结尾自然带出全国统一心理援助热线 12356，或联系家人朋友陪伴，情况紧急时拨打 110/120；不要评价、不要刺激、绝不提供任何方法细节。';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'not found' }, 404);

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return json({ error: '站点尚未配置 OpenRouter 密钥，请联系站长。' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: '请求格式错误' }, 400); }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json({ error: '没有消息内容' }, 400);

  const model = (body.model && String(body.model).trim()) || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
  const baseURL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const temperature = Math.min(Math.max(Number(body.temperature ?? 0.9) || 0.9, 0), 2);
  const maxTokens = Math.min(Math.max(Number(body.maxTokens ?? 2048) || 2048, 256), 4096);

  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const crisis = CRISIS_PATTERN.test(lastUser);
  const system = (body.system || '') + (crisis ? '\n\n' + CRISIS_INSTRUCTION : '');
  const upstreamMessages = [{ role: 'system', content: system }, ...messages.filter(m => m.role !== 'system')];

  let up;
  try {
    up = await fetch(baseURL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': 'https://jieshe-ai.netlify.app',
        'X-Title': 'JieShe AI',
      },
      body: JSON.stringify({ model, messages: upstreamMessages, temperature, max_tokens: maxTokens, stream: true }),
    });
  } catch (e) {
    return json({ error: '上游连接失败：' + e.message }, 502);
  }
  if (!up.ok || !up.body) {
    const t = await up.text().catch(() => '');
    return json({ error: 'OpenRouter ' + up.status + '：' + t.slice(0, 300) }, 502);
  }

  const encoder = new TextEncoder();
  const reader = up.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ meta: { crisis } }) + '\n\n'));
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta }) + '\n\n'));
          } catch {}
        }
      } catch (e) {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify({ error: e.message }) + '\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
};
