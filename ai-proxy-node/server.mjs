/**
 * Figma 插件 <-> peta.ctripcorp.com 之间的本地 Node 中转。
 *
 * 与 peta.auth 那套走的是两条不同接入:
 *   本文件转发到 https://peta.ctripcorp.com/agentApi/openai/chat/completions
 *   靠浏览器登录态 cookie 鉴权(而不是 apikey querykey)。
 *
 * 用法:
 *   cd ai-proxy-node
 *   cp .env.example .env
 *   # 打开 peta.ctripcorp.com → 登录 → devtools Application → Cookies → 全选复制成 name=value; 串
 *   # 粘进 .env 的 PETA_COOKIE=
 *   npm start
 *
 * 接口:
 *   GET  /health
 *   POST /analyze  (payload 与 Python 版一致,plugin/src/ai/prompt.ts 无需改)
 */
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';

const {
  PETA_URL = 'https://peta.ctripcorp.com/agentApi/openai/chat/completions',
  PETA_COOKIE = '',
  PETA_MODEL = 'gpt-6-astra',
  PETA_PROVIDER = 'OpenAI',
  PETA_BASE_URL = 'http://aigw.fx.ctripcorp.com/llm/100000420/v1',
  PETA_SUPPLIER = 'azure',
  PORT = '8787',
  ALLOW_INSECURE_TLS = '1', // 公司自签 CA(Ctrip Root CA)node fetch 认不了,本地开发默认放行
} = process.env;

// node 内建 fetch 走 undici,忽略自签证书最简做法就是设进程级环境变量
if (ALLOW_INSECURE_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// bodyLimit 提到 30MB:tree 大 + 1500x2000 PNG base64 通常 3-8MB,留足富裕。
const app = Fastify({ logger: false, bodyLimit: 30 * 1024 * 1024 });
await app.register(cors, { origin: true });

/** 拼 prompt(与 Python 版语义一致,简化写法)。 */
function buildPrompt(req) {
  const lines = [
    '你是 Figma 设计稿分析助手。基于图层树 + 截图,为 pp-d2c 出打标建议。',
    '',
    'pp-d2c 前缀协议(基础前缀,单选):',
    '- sub-: 独立子组件',
    '- img-: 整块图片,内部不拆',
    '- bg-: 背景图(单独一张图,无内容压在上面)',
    '- bgc-: 父级背景与装饰(纯 CSS 可画,通常和内容压在一起)',
    '- btn-: 可点击容器',
    '- input-: 输入框',
    '- scrollx- / scrolly-: 横/纵向滚动容器',
    '- x-: 完全忽略(不生成 DOM)',
    '',
  ];
  if (req.capability === 'all' || req.capability === 'bg_vs_bgc') {
    lines.push('能力 A(bg/bgc 消歧):判某个 frame 应打 bg- 还是 bgc-。');
  }
  if (req.capability === 'all' || req.capability === 'visual_group') {
    lines.push(
      '能力 B(视觉分组):找视觉贴在一起但图层没成组的多个节点,建议 merge + img-/sub-。',
    );
  }
  lines.push('', '图层树(depth 缩进):');
  const tree = req.tree || [];
  for (const n of tree.slice(0, 400)) {
    const indent = '  '.repeat(n.depth || 0);
    const px = n.existingPrefix ? ` [${n.existingPrefix}]` : '';
    lines.push(`${indent}- ${n.type} ${n.id} ${JSON.stringify(n.name)}${px}`);
  }
  if (tree.length > 400) lines.push(`... (省略 ${tree.length - 400} 个节点)`);
  lines.push(
    '',
    '严格只输出如下 JSON,不要额外文字或 markdown 代码块:' +
      '{"suggestions":[{"nodeIds":["..."],"action":"tag"|"merge",' +
      '"suggestedPrefix":"img-"|"bg-"|...,"reason":"...","confidence":0.0..1.0}]}',
  );
  return lines.join('\n');
}

/** 从 LLM 输出里抠出 suggestions JSON。 */
function parseSuggestions(text) {
  let stripped = String(text || '').trim();
  const m1 = stripped.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/);
  if (m1) stripped = m1[1];
  const m2 = stripped.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
  if (!m2) return [];
  let data;
  try {
    data = JSON.parse(m2[0]);
  } catch {
    return [];
  }
  const raw = Array.isArray(data.suggestions) ? data.suggestions : [];
  return raw
    .filter((s) => s && Array.isArray(s.nodeIds) && s.nodeIds.length > 0)
    .map((s) => ({
      nodeIds: s.nodeIds.map(String),
      action: s.action === 'merge' || s.action === 'delete' ? s.action : 'tag',
      suggestedPrefix: s.suggestedPrefix,
      reason: String(s.reason || ''),
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.6,
    }));
}

/** 组装 peta 请求 body(非流式,插件不需要 SSE)。 */
function buildPetaBody(prompt, imageBase64, model) {
  const userContent = [{ type: 'text', text: prompt }];
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imageBase64}` },
    });
  }
  return {
    model,
    provider: PETA_PROVIDER,
    baseURL: PETA_BASE_URL,
    supplier: PETA_SUPPLIER,
    messages: [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: userContent },
    ],
    // peta agentApi 强制走 SSE 流式,stream:false 会被它自作聪明地转成 stream:true 但报 stream_options 冲突。
    // 直接开 stream,下面 callPeta 会把 SSE 拼回完整字符串,插件侧看到的仍是同步一次性响应。
    stream: true,
    // gpt-6-astra 只支持 temperature=1
    temperature: 1,
    top_p: 1,
    frequency_penalty: 0,
  };
}

/** 调 peta,返回 assistant content。stream=false 时是标准 OpenAI 响应。 */
async function callPeta(prompt, imageBase64, model) {
  if (!PETA_COOKIE) throw new Error('PETA_COOKIE 未配置(浏览器 devtools 复制的 cookie)');
  const body = buildPetaBody(prompt, imageBase64, model);
  const res = await fetch(PETA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: PETA_COOKIE,
      Origin: 'https://peta.ctripcorp.com',
      Referer: 'https://peta.ctripcorp.com/view/modelSquare/modelExpCenter?id=' + encodeURIComponent(model),
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`peta HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const text = await res.text();
  if (process.env.DEBUG_RAW === '1') {
    console.log('[peta raw response, first 2000 chars]:', text.slice(0, 2000));
  }
  // 尝试:直接 JSON
  try {
    const j = JSON.parse(text);
    // peta 会把上游 4xx/5xx 包成 200 + {returnCode: 400, error: ...} — 显式判一下
    if (j?.returnCode && j.returnCode !== 0 && j.returnCode !== 200) {
      const detail = j.error?.message || j.returnMsg || JSON.stringify(j);
      throw new Error(`peta returnCode=${j.returnCode}: ${detail.slice(0, 500)}`);
    }
    return j?.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    if (err?.message?.startsWith('peta returnCode=')) throw err;
    // SSE 兼容(peta 有时无视 stream:false 仍返 SSE)
    const chunks = [];
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^data:\s*(.+)\s*$/);
      if (!m) continue;
      const payload = m[1].trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        // OpenAI 流式:choices[0].delta.content
        const delta = j?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') chunks.push(delta);
        // 有的转发层用 choices[0].message.content(非标准流式)
        const message = j?.choices?.[0]?.message?.content;
        if (typeof message === 'string') chunks.push(message);
      } catch {
        /* ignore */
      }
    }
    return chunks.join('');
  }
}

// ============== 内存日志环缓(方便调试) ==============
const LOG_CAP = 100;
/** @type {Array<{id:number, at:string, latencyMs:number, ok:boolean, model:string,
 *   treeSize:number, hasImage:boolean, imageBytes:number,
 *   suggestions:number, degraded:boolean, message?:string,
 *   petaStatus?:number, prompt:string, rawResponse?:string, error?:string}>} */
const LOGS = [];
let LOG_SEQ = 0;

function pushLog(entry) {
  LOGS.push({ id: ++LOG_SEQ, at: new Date().toISOString(), ...entry });
  if (LOGS.length > LOG_CAP) LOGS.shift();
}

app.get('/health', async () => ({
  ok: true,
  hasCookie: !!PETA_COOKIE,
  cookieLen: PETA_COOKIE.length,
  peta: PETA_URL,
  defaultModel: PETA_MODEL,
  logCount: LOGS.length,
}));

app.post('/analyze', async (req, reply) => {
  const body = req.body || {};
  const t0 = Date.now();
  const treeSize = Array.isArray(body.tree) ? body.tree.length : 0;
  const imageB64 = body.imageBase64 || '';

  if (!PETA_COOKIE) {
    const msg =
      'PETA_COOKIE 未配置。请打开 peta.ctripcorp.com 登录 → devtools Application → Cookies → 复制成 name=value; 串,粘进 ai-proxy-node/.env 的 PETA_COOKIE=,然后重启服务。';
    pushLog({
      latencyMs: Date.now() - t0,
      ok: false,
      model: body.model || PETA_MODEL,
      treeSize,
      hasImage: !!imageB64,
      imageBytes: imageB64.length,
      suggestions: 0,
      degraded: true,
      message: msg,
      prompt: '(未生成 prompt:cookie 缺)',
    });
    return reply.send({
      suggestions: [],
      model: body.model || PETA_MODEL,
      degraded: true,
      message: msg,
    });
  }
  const model = body.model || PETA_MODEL;
  const prompt = buildPrompt(body);
  try {
    const raw = await callPeta(prompt, body.imageBase64, model);
    const suggestions = parseSuggestions(raw);
    pushLog({
      latencyMs: Date.now() - t0,
      ok: true,
      model,
      treeSize,
      hasImage: !!imageB64,
      imageBytes: imageB64.length,
      suggestions: suggestions.length,
      degraded: false,
      prompt,
      rawResponse: raw,
    });
    return {
      suggestions,
      model,
      degraded: false,
      raw: process.env.DEBUG_RAW === '1' ? raw : undefined,
    };
  } catch (err) {
    const emsg = err?.message || String(err);
    pushLog({
      latencyMs: Date.now() - t0,
      ok: false,
      model,
      treeSize,
      hasImage: !!imageB64,
      imageBytes: imageB64.length,
      suggestions: 0,
      degraded: true,
      message: `peta 调用失败:${emsg}`,
      prompt,
      error: emsg,
    });
    return {
      suggestions: [],
      model,
      degraded: true,
      message: `peta 调用失败:${emsg}`,
    };
  }
});

// ============== 日志接口 ==============

app.get('/logs', async (req) => {
  const limit = Math.min(Number(req.query?.limit) || 50, LOG_CAP);
  return LOGS.slice(-limit).reverse();
});

app.get('/logs/:id', async (req, reply) => {
  const id = Number(req.params.id);
  const item = LOGS.find((l) => l.id === id);
  if (!item) return reply.code(404).send({ error: 'log not found' });
  return item;
});

app.delete('/logs', async () => {
  const n = LOGS.length;
  LOGS.length = 0;
  return { cleared: n };
});

/** 一个自刷新的 HTML 日志页面。浏览器打开 http://localhost:8787/logs/view 即可。 */
app.get('/logs/view', async (req, reply) => {
  reply.type('text/html; charset=utf-8').send(LOG_VIEW_HTML);
});

const LOG_VIEW_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>ai-proxy 日志</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; font-size: 13px; color: #1f2937; background: #f3f4f6; }
  .topbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 10px 16px; display: flex; align-items: center; gap: 12px; z-index: 10; }
  .topbar h1 { font-size: 15px; margin: 0; font-weight: 600; }
  .topbar .stats { color: #6b7280; font-size: 12px; }
  .topbar button, .topbar label { padding: 4px 10px; border: 1px solid #d1d5db; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .topbar button:hover { background: #f9fafb; }
  .list { padding: 12px 16px; }
  .row { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; }
  .row.ok { border-left: 3px solid #10b981; }
  .row.bad { border-left: 3px solid #ef4444; }
  .row header { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .badge { padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.bad { background: #fee2e2; color: #991b1b; }
  .row .meta { color: #6b7280; font-size: 11px; margin-left: auto; }
  .row .brief { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row .detail { display: none; margin-top: 10px; }
  .row.expanded .detail { display: block; }
  .kv { display: grid; grid-template-columns: 100px 1fr; gap: 4px 12px; font-size: 12px; margin-bottom: 8px; }
  .kv dt { color: #6b7280; }
  .kv dd { margin: 0; font-family: "SF Mono", Menlo, Consolas, monospace; word-break: break-all; }
  pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; overflow: auto; max-height: 400px; font-size: 12px; font-family: "SF Mono", Menlo, Consolas, monospace; }
  .empty { text-align: center; color: #9ca3af; padding: 40px 0; }
</style>
</head>
<body>
<div class="topbar">
  <h1>ai-proxy 日志</h1>
  <span class="stats" id="stats">加载中…</span>
  <button onclick="load()">🔄 刷新</button>
  <label><input type="checkbox" id="autoRefresh" checked> 自动刷新 3s</label>
  <button onclick="clearAll()" style="color:#dc2626">清空</button>
  <a href="/health" target="_blank" style="margin-left:auto; font-size:12px; color:#3b82f6;">/health</a>
</div>
<div class="list" id="list"><div class="empty">加载中…</div></div>

<script>
let items = [];
let expanded = new Set();

async function load() {
  try {
    const r = await fetch('/logs?limit=100');
    items = await r.json();
    render();
  } catch (e) {
    document.getElementById('list').innerHTML = '<div class="empty" style="color:#dc2626">加载失败: ' + e.message + '</div>';
  }
}

function render() {
  const stats = document.getElementById('stats');
  const okN = items.filter(i => i.ok).length;
  const badN = items.length - okN;
  stats.textContent = items.length + ' 条 · ' + okN + ' 成功 / ' + badN + ' 失败';

  const list = document.getElementById('list');
  if (items.length === 0) {
    list.innerHTML = '<div class="empty">还没有日志。在插件里点 AI 建议后回来刷新。</div>';
    return;
  }
  list.innerHTML = items.map(it => {
    const cls = 'row ' + (it.ok ? 'ok' : 'bad') + (expanded.has(it.id) ? ' expanded' : '');
    const brief = it.ok
      ? '返回 ' + it.suggestions + ' 条建议'
      : (it.message || it.error || '未知错误');
    return \`<div class="\${cls}" data-id="\${it.id}">
      <header onclick="toggle(\${it.id})">
        <span class="badge \${it.ok ? 'ok' : 'bad'}">\${it.ok ? '成功' : '失败'}</span>
        <span>#\${it.id}</span>
        <span class="brief">\${escapeHtml(brief)}</span>
        <span class="meta">\${it.latencyMs}ms · tree \${it.treeSize} · \${it.hasImage ? 'img ' + Math.round(it.imageBytes/1024) + 'KB' : 'no img'} · \${new Date(it.at).toLocaleTimeString()}</span>
      </header>
      <div class="detail">
        <dl class="kv">
          <dt>时间</dt><dd>\${it.at}</dd>
          <dt>耗时</dt><dd>\${it.latencyMs} ms</dd>
          <dt>模型</dt><dd>\${it.model}</dd>
          <dt>tree 大小</dt><dd>\${it.treeSize} 节点</dd>
          <dt>截图</dt><dd>\${it.hasImage ? Math.round(it.imageBytes/1024) + ' KB base64' : '未带'}</dd>
          <dt>建议数</dt><dd>\${it.suggestions}</dd>
          \${it.message ? '<dt>消息</dt><dd style="color:#dc2626">' + escapeHtml(it.message) + '</dd>' : ''}
        </dl>
        \${it.prompt ? '<div><b style="font-size:12px;color:#6b7280;">Prompt(截 2KB)</b><pre>' + escapeHtml(String(it.prompt).slice(0, 2000)) + (it.prompt.length > 2000 ? '\\n... (' + (it.prompt.length - 2000) + ' more)' : '') + '</pre></div>' : ''}
        \${it.rawResponse ? '<div><b style="font-size:12px;color:#6b7280;">Peta 原始响应</b><pre>' + escapeHtml(String(it.rawResponse).slice(0, 4000)) + '</pre></div>' : ''}
        \${it.error ? '<div><b style="font-size:12px;color:#dc2626;">Error</b><pre style="color:#dc2626">' + escapeHtml(String(it.error)) + '</pre></div>' : ''}
      </div>
    </div>\`;
  }).join('');
}

function toggle(id) {
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
  render();
}

async function clearAll() {
  if (!confirm('清空所有日志?')) return;
  await fetch('/logs', { method: 'DELETE' });
  load();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#39;' }[c]));
}

load();
setInterval(() => {
  if (document.getElementById('autoRefresh').checked) load();
}, 3000);
</script>
</body>
</html>`;

const port = Number(PORT) || 8787;
// 监听 0.0.0.0 → localhost / 127.0.0.1 / ::1 都通,避免 Figma fetch localhost 走 IPv6 断连
app.listen({ host: '0.0.0.0', port }).then(() => {
  console.log(`[ai-proxy-node] http://127.0.0.1:${port}`);
  console.log(`[ai-proxy-node] http://localhost:${port}`);
  console.log(`[ai-proxy-node] PETA_URL=${PETA_URL}`);
  console.log(`[ai-proxy-node] cookie ${PETA_COOKIE ? 'set (' + PETA_COOKIE.length + ' chars)' : 'MISSING'}`);
  console.log(`[ai-proxy-node] 日志页面: http://127.0.0.1:${port}/logs/view`);
});
