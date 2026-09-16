# ai-proxy 终稿

> 本地 AI 请求中转服务。作用是把 Figma 插件 / 其它本地工具的 AI 调用**转发到内网 PETA**(`peta.ctripcorp.com/agentApi/openai/chat/completions`),因为 PETA 只对内网 Cookie / peta-auth querykey 开放,浏览器 / Figma 沙箱侧无法直接调。端口固定 `8787`,两个实现并存:Python 版(FastAPI + peta-auth querykey)与 Node 版(fastify + Cookie + agentApi)。当前主用 **Node 版**,Python 版留作兜底。

## 一、为什么需要中转

Figma 插件跑在 Figma 桌面版的 QuickJS 沙箱里,直接调 `peta.ctripcorp.com` 会遇到:

1. **鉴权问题**:PETA agentApi 走 Cookie(`login_uid` / `cticket` / `PRO_cas_principal` / sk-*),沙箱没法带公司 SSO Cookie;peta-auth 走 querykey,querykey 也不能明文写死在插件里(会随打包分发出去);
2. **CORS 与 TLS 问题**:公司自签 CA(Ctrip Root CA),Figma 沙箱 fetch 不认;
3. **模型契约不透明**:`gpt-6-astra` 只接受 `temperature=1` 且强制 `stream=true`,插件侧不应关心这些细节。

把上述都封装在本地 `localhost:8787`,插件只发一个语义化的 `POST /ai/suggest`,proxy 负责鉴权、TLS、SSE 解析、参数校正,再把最终结果回给插件。

## 二、两个版本的选型

| 维度 | Python 版 (`ai-proxy/`) | Node 版 (`ai-proxy-node/`) |
|---|---|---|
| 入口 | FastAPI + uvicorn(`main.py` / `run.sh`) | fastify(`server.mjs`) |
| 依赖 | `pip install -r requirements.txt`(FastAPI / uvicorn / httpx / python-dotenv) | `npm install`(fastify) |
| 鉴权方式 | peta-auth querykey(bindKey + queryKey) | Cookie(`login_uid` + `cticket` + `PRO_cas_principal` + `sk-*`) |
| 端点 | `/v1/chat/completions`(peta-auth 兼容 OpenAI) | `/agentApi/openai/chat/completions`(PETA agentApi) |
| 是否 SSE | 支持 | 支持(**必须**,gpt-6-astra 强制 stream=true) |
| TLS 处理 | httpx `verify=False` | Node fetch `process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'` |
| 状态 | **兜底方案**,当前不推荐主用 | **当前主用**,插件 UI 默认调它 |
| 已知坑 | peta-auth bindKey 报错时不好排查 | Cookie 有过期期,须定期 re-login |
| 日志页 | 无 | 有 `/logs` + `/logs/view`(3s auto-refresh HTML) |

**推荐**:日常开发用 Node 版,Cookie 到期时切回 Python 版应急;两个版本都监听 `8787`,插件无感切换。

## 三、Node 版实现要点(`ai-proxy-node/server.mjs`)

### 3.1 fastify 起手

```js
import Fastify from 'fastify';
import cors from '@fastify/cors';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';   // 公司自签 CA,dev 专用

const fastify = Fastify({
  bodyLimit: 30 * 1024 * 1024,   // 30 MB,给图层树 + PNG base64 留余量
  logger: true,
});
await fastify.register(cors, { origin: '*' });
```

### 3.2 端点契约

```
POST /ai/suggest
Content-Type: application/json
Body: {
  tree: TreeNode[],
  imageBase64: string,          // PNG,不含 "data:image/png;base64," 前缀
  capability: 'tag' | 'merge' | 'all',
  prompt?: string,              // 可选,不传走 default system prompt
}

Response 200: { suggestions: Suggestion[], degraded: boolean, message?: string }
Response 5xx: { error: string, detail?: string }
```

### 3.3 转发到 PETA 的关键契约

```js
const petaBody = {
  model: 'gpt-6-astra',
  temperature: 1,               // ★ 硬编码,gpt-6-astra 只支持 1
  stream: true,                 // ★ 硬编码,gpt-6-astra 强制 stream
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
    ]},
  ],
};

const upstream = await fetch(
  'https://peta.ctripcorp.com/agentApi/openai/chat/completions',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': process.env.PETA_COOKIE,      // 从 .env 读,不入版本控制
    },
    body: JSON.stringify(petaBody),
  }
);
```

**重要**:

- **不能改 `temperature`**——传 0.7 会 returnCode:400 `only temperature=1 is supported`;
- **不能改 `stream: false`**——传 false 也会 400 `stream is required for gpt-6-astra`;
- **`stream_options` 不能传**,PETA 会拒;
- **Cookie 必须包含完整四段**(`login_uid` / `cticket` / `PRO_cas_principal` / `sk-*`),缺一段 401;
- **Cookie 会过期**(通常几天到一周),UI 侧一旦收到 401,提醒用户重新登录 PETA + 更新 `.env`。

### 3.4 SSE 解析

```js
const reader = upstream.body.getReader();
const decoder = new TextDecoder();
let full = '';
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const parsed = JSON.parse(payload);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) full += delta;
    } catch { /* keep buffer */ }
  }
}
// 拿到 full 后按 prompt 约定 JSON.parse,产出 suggestions[]
```

### 3.5 日志页

- 内存 ring buffer(最近 500 条,每条含 timestamp / method / path / status / durationMs / bodyPreview)
- `GET /logs`:JSON;
- `GET /logs/view`:HTML,`<meta http-equiv="refresh" content="3">` 3 秒自动刷新;
- 无持久化,重启即清空(简单 dev 场景够用)。

## 四、Python 版实现要点(`ai-proxy/main.py`)

**主要差异**:走 peta-auth,不走 agentApi Cookie。

```python
import os
import httpx
from fastapi import FastAPI

app = FastAPI()
BIND_KEY = os.environ['PETA_BIND_KEY']
QUERY_KEY = os.environ['PETA_QUERY_KEY']

@app.post('/ai/suggest')
async def suggest(req: Request):
    body = await req.json()
    peta_body = {
        'model': 'gpt-6-astra',
        'temperature': 1,
        'stream': True,
        'messages': [...],   # 同 Node 版
    }
    async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
        upstream = await client.post(
            f'https://peta.ctripcorp.com/petaapi/v1/chat/completions?queryKey={QUERY_KEY}&bindKey={BIND_KEY}',
            json=peta_body,
        )
        # 同样解 SSE,拼 full
    return { 'suggestions': [...], 'degraded': False }
```

**关键坑**:peta-auth 的 `bindKey` / `queryKey` 生成规则不透明,首次配置需要在 PETA 后台申请后填 `.env`。

## 五、共同的 .env(不入版本控制)

```
# .env (both versions gitignored)
PETA_COOKIE="login_uid=xxx; cticket=xxx; PRO_cas_principal=xxx; sk-xxx=xxx"   # Node 版

PETA_BIND_KEY=xxx                                                              # Python 版
PETA_QUERY_KEY=xxx                                                              # Python 版

PORT=8787
```

## 六、Figma 插件 manifest 白名单

`plugin/manifest.json`:

```json
{
  "networkAccess": {
    "allowedDomains": ["*"],
    "devAllowedDomains": ["http://localhost:8787"]
  }
}
```

- `allowedDomains: ["*"]` 是**开发模式为方便调试**留的口,生产分发前应改为明确域名;
- `devAllowedDomains` 单独列 localhost,Figma manifest 校验器**不接受 IP、不接受纯端口**,必须完整 http URL。

## 七、启动与验证

**Node 版**:

```bash
cd ai-proxy-node
npm install
cp .env.example .env       # 填 PETA_COOKIE
node server.mjs            # 监听 8787
```

打开浏览器访问 `http://localhost:8787/logs/view` 应能看到实时日志页。

**Python 版**:

```bash
cd ai-proxy
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # 填 PETA_BIND_KEY / PETA_QUERY_KEY
./run.sh                   # 内部 uvicorn main:app --host 0.0.0.0 --port 8787
```

**自测**:

```bash
curl -X POST http://localhost:8787/ai/suggest \
  -H 'Content-Type: application/json' \
  -d '{"tree":[],"imageBase64":"...","capability":"all"}'
```

## 八、故障排查

| 症状 | 根因 | 处理 |
|---|---|---|
| `401 Unauthorized` | Cookie 过期(Node 版)/ bindKey 错(Python 版) | 重新登录 PETA 拿 Cookie 更新 `.env` |
| `400 only temperature=1 is supported` | 请求体传了 temp≠1 | 检查 body 强制写 `temperature: 1` |
| `400 stream is required` | 传了 stream:false | 强制 `stream: true`,server 侧解 SSE |
| `413 Payload Too Large` | tree + PNG 超 1MB(fastify 默认) | server 设 `bodyLimit: 30 * 1024 * 1024` |
| `fetch failed` (Node) | 公司自签 CA 不认 | `process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'`(dev 专用,勿上生产) |
| Figma manifest 报 `'http://localhost:8787' must be a valid URL` | Figma 校验器不接受纯端口 | 用完整 `http://localhost:8787`;主要域白名单走 `allowedDomains: ["*"]` |
| Figma 沙箱 `AbortController is not defined` | QuickJS 沙箱无该 API | 插件侧改 `Promise.race([fetch, timeout])`,不是 proxy 的问题 |
| UI 收到 `[object Object]` 错误 | 沙箱抛非 Error 对象 | 插件侧 `formatError()` 统一序列化,不是 proxy 的问题 |

## 九、安全提醒(重要)

- **`PETA_COOKIE` / `PETA_BIND_KEY` / `PETA_QUERY_KEY` 属于个人凭证**,若在调试中意外泄露(粘对话、截图、commit),**立即**登出 PETA + 重新登录换新凭证。这些凭证若被他人拿到,可以以你的身份消耗 PETA 额度、读取你能访问的所有模型接口。
- **`.env` 必须在 `.gitignore` 里**,`ai-proxy-node/.env` 与 `ai-proxy/.env` 都不入版本控制。
- **`NODE_TLS_REJECT_UNAUTHORIZED=0` 是 dev 专用行为**,生产分发时应改为在 Node 侧信任公司 Root CA(通过 `NODE_EXTRA_CA_CERTS` 环境变量),而非全局关 TLS 校验。

## 十、相关资料

- 关联 topic:[pp-d2c-prep-plugin](../topics/pp-d2c-prep-plugin.md)(唯一使用者)
- 关联 stock-doc:[pp-d2c-prep-plugin 终稿](./pp-d2c-prep-plugin_终稿.md)
- 源码入口:`ai-proxy-node/server.mjs`(Node 版主用)/ `ai-proxy/main.py`(Python 版兜底)
