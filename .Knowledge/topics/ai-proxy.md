---
id: ai-proxy
revision: 0
summary: "本地 AI 中转:把 Figma 插件调用转发到 PETA gpt-6-astra,固定端口 8787"
primary: module
confidence: manual
tags: [config]
---
# ai-proxy

> 本地 AI 请求中转服务,端口固定 `8787`。作用是把 Figma 插件 / 其它本地工具的 AI 调用**转发到内网 PETA** (`peta.ctripcorp.com/agentApi/openai/chat/completions`),处理 Cookie 鉴权、公司自签 CA、SSE 拆包、`gpt-6-astra` 特殊契约。当前主用 **Node 版**(`ai-proxy-node/server.mjs`),Python 版(`ai-proxy/main.py`)留作兜底。

## 适用场景

- Figma 插件(见 [[pp-d2c-prep-plugin]])需要调 PETA 拿 AI 建议;
- 排查"AI 建议按钮点了没反应" / "400 only temperature=1" / "401 unauthorized" / "413 payload too large" / "fetch failed 自签 CA" 等中转链路问题;
- 需要给其它本地开发工具接一路"直连 PETA 的语义化端点",不想每个工具都自己封鉴权。

**不适用**:AI 建议内容质量、prompt 工程 → 那是 [[pp-d2c-prep-plugin]] 的 `plugin/src/ai/prompt.ts` 职责;PETA 本身可用性 → 上游服务,插件侧不 own。

## 两个版本的选型

| 维度 | Python 版 `ai-proxy/` | Node 版 `ai-proxy-node/` |
|---|---|---|
| 鉴权 | peta-auth **querykey**(bindKey + queryKey) | **Cookie**(login_uid + cticket + PRO_cas_principal + sk-*) |
| 端点 | `peta.ctripcorp.com/petaapi/v1/chat/completions` | `peta.ctripcorp.com/agentApi/openai/chat/completions` |
| 依赖 | FastAPI + uvicorn + httpx | fastify |
| 日志页 | 无 | 有(`/logs` JSON + `/logs/view` HTML 3s auto-refresh) |
| 状态 | **兜底**(Cookie 过期时应急) | **当前主用** |

## 关键契约(接 gpt-6-astra 必读)

请求 PETA 的 body **硬编码**:

- `model: 'gpt-6-astra'`
- `temperature: 1`——**只能是 1**,传 0.7 会 `400 only temperature=1 is supported`;
- `stream: true`——**强制**,传 false 会 `400 stream is required`;
- **禁止**传 `stream_options`,PETA 会拒;
- Cookie(Node 版)必须包含完整四段 `login_uid` / `cticket` / `PRO_cas_principal` / `sk-*`,缺一段 401。

server 侧解 SSE(`data:` 行 → JSON.parse → `delta.content` 累加 → 遇 `[DONE]` 结束),拼完整响应后一次性回给插件。

## 网络与安全约束

- **fastify `bodyLimit: 30 * 1024 * 1024`**:图层树 + PNG base64 常常几 MB,fastify 默认 1MB 会 413;
- **公司自签 CA**:Node 侧 `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`(dev 专用);Python 侧 httpx `verify=False`;
- **Figma manifest 白名单**:`allowedDomains: ["*"]` + `devAllowedDomains: ["http://localhost:8787"]`(Figma manifest 校验器不接受纯 IP / 纯端口,必须完整 http URL);
- **Cookie 会过期**(通常几天到一周),401 时提示用户重新登录 PETA + 更新 `.env`;
- **`.env` 必须 gitignore**(`ai-proxy/.env` + `ai-proxy-node/.env` 都不入版本控制);
- **Cookie / bindKey / queryKey 泄露即刻处理**:登出 PETA + 换新凭证,原凭证会被人以你身份消耗额度。

## 端点

```
POST /ai/suggest
Body: { tree: TreeNode[], imageBase64: string, capability: 'tag'|'merge'|'all', prompt?: string }
Response: { suggestions: Suggestion[], degraded: boolean, message?: string }
```

Node 版另有 `GET /logs` 与 `GET /logs/view` 供本地排障。

## 启动

**Node 版**(推荐):

```bash
cd ai-proxy-node
npm install
cp .env.example .env    # 填 PETA_COOKIE
node server.mjs
```

**Python 版**(兜底):

```bash
cd ai-proxy
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # 填 PETA_BIND_KEY / PETA_QUERY_KEY
./run.sh
```

两版都监听 8787,插件无感切换。

## 边界与禁止

- ❌ **禁止把 `PETA_COOKIE` / `PETA_BIND_KEY` / `PETA_QUERY_KEY` 提交入库**(`.env` 必须 gitignore);
- ❌ **禁止**在生产分发时保留 `NODE_TLS_REJECT_UNAUTHORIZED=0`(dev 专用,生产改用 `NODE_EXTRA_CA_CERTS` 信任公司 Root CA);
- ❌ **禁止**改 `temperature` / `stream`——`gpt-6-astra` 契约硬约束;
- ❌ **禁止**用 IP + 端口写 Figma manifest 白名单;
- ❌ **禁止**在插件里明文写 querykey / Cookie(会随打包分发出去)——所以才需要本地中转。

## 详细背景

- [ai-proxy 终稿](../stock-docs/ai-proxy_终稿.md)——两版实现要点、SSE 解析、日志页、故障排查表、安全提醒。
- 关联 topic:[[pp-d2c-prep-plugin]](唯一使用者)。
