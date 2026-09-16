# pp-d2c ai-proxy (Node 版)

Figma 插件 → 本进程 → `peta.ctripcorp.com/agentApi/openai/chat/completions`。用**浏览器登录态 cookie** 鉴权,不走 `peta.auth` 的 apikey/bindKey 那套(避免 `No binding found` 之类的授权问题)。

## 一次性

```bash
cd ai-proxy-node
npm install
cp .env.example .env
```

## 抓 cookie

1. 打开 https://peta.ctripcorp.com,登录。
2. DevTools → Application → Cookies → 域 `https://peta.ctripcorp.com`
3. 全选后粘成 `name1=value1; name2=value2; ...` 的一整串(或 Network 里找一次请求,右键 Copy → Copy as cURL,取 `-b '...'` 里的内容)。
4. 粘到 `.env` 的 `PETA_COOKIE=` 后面。

**Cookie 有时效**:一般几小时到几天。/analyze 返 401/403 就重抓一次。

## 启动

```bash
npm start
# 或开发时监听改动
npm run dev
```

服务跑在 `http://127.0.0.1:8787`,和 Python 版同端口,Figma 插件 `manifest.json` 已配。

## 验证

```bash
curl -s http://localhost:8787/health | python3 -m json.tool
# { "ok": true, "hasCookie": true, "cookieLen": 3xxx, ... }

curl -sS -X POST http://localhost:8787/analyze \
  -H 'Content-Type: application/json' \
  -d '{"scope":"page","tree":[{"id":"0:1","name":"test","type":"FRAME","depth":0}],"capability":"all"}' \
  | python3 -m json.tool
```

期望 `"degraded": false`,`suggestions` 可能是空数组(空 tree 没啥可推)也可能返 1~2 条。

## 与 Python 版共存

两份都保留:

- `ai-proxy/` = Python + peta.auth(querykey → apikey → chat),需要 bindKey 授权
- `ai-proxy-node/` = Node + peta cookie 直连

**选一个跑**即可,别同时跑(都用 8787 会冲突)。Figma 插件不区分,只要 8787 通就行。

## 安全

- `.env` 已在 `.gitignore`,cookie 不进仓库。
- 服务只监听 127.0.0.1。
- **不要贴 cookie 到公共渠道**——里头的 `login_uid` / `cticket` / `PRO_cas_principal` 是你的 SSO session,泄露等于账号被别人接管。
