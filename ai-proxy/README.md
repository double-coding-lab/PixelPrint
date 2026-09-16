# pp-d2c AI proxy

Figma 插件 <-> PETA(公司 AI 网关)之间的本地中转。因为 Figma 沙箱只能 fetch HTTP(S),而 PETA 的 Python SDK `peta-ai-client` 依赖本地凭证(公司账号),所以插件不能直接调 PETA;需要在本机起一个 FastAPI 中转,插件 fetch → 本进程 → PETA。

## 目录结构

```
ai-proxy/
├── main.py            # FastAPI 应用
├── requirements.txt   # Python 依赖
├── run.sh             # 一键启动(自动建 venv、装依赖、跑 uvicorn)
├── .env.example       # 拷成 .env 填 PETA 凭证
├── .env               # (gitignore) 真实凭证
├── .venv/             # (gitignore) 虚拟环境
└── README.md
```

## 启动

首次:

```bash
cd ai-proxy
cp .env.example .env
# 编辑 .env,填入 PAAS_APP_APPID 与 PETA_KEY_ID
bash run.sh
```

之后每次直接 `bash run.sh`。服务会监听 `http://127.0.0.1:8787`。

**健康检查**:

```bash
curl http://localhost:8787/health
# {"ok":true,"hasCredentials":true,"defaultModel":"gemini-3.7-flash"}
```

若 `hasCredentials=false`,说明 `.env` 没配好;此时 `/analyze` 会返回 `degraded=true`,不会调用 PETA。

## 接口

### `POST /analyze`

**Request**:

```json
{
  "scope": "page",
  "tree": [
    {"id":"1:2","name":"Frame 1","type":"FRAME","depth":0,"existingPrefix":null},
    {"id":"1:3","name":"logo","type":"VECTOR","depth":1,"parentId":"1:2"}
  ],
  "imageBase64": "iVBORw0KGgo...",
  "capability": "all",
  "model": "gemini-3.7-flash"
}
```

- `scope`: `"page"` 或 `"selection"`
- `tree`: 精简的图层树(id/name/type/depth/parentId/existingPrefix)
- `imageBase64`: 整个 scope 的 PNG base64,不带 `data:` 前缀。前端已限制尺寸 ≤ 1500x2000。
- `capability`: `"all"` / `"bg_vs_bgc"` / `"visual_group"`
- `model`: 可选,不传用 `.env` 里的 `PETA_DEFAULT_MODEL`

**Response**:

```json
{
  "suggestions": [
    {
      "nodeIds": ["1:2"],
      "action": "tag",
      "suggestedPrefix": "bg-",
      "reason": "整块图上没有内容压在上面",
      "confidence": 0.8
    }
  ],
  "model": "gemini-3.7-flash",
  "degraded": false
}
```

- `degraded=true` 时 `suggestions=[]`,通常是没配凭证或 PETA 调用失败;`message` 会给原因。

### `GET /health`

如上。

## 与 Figma 插件的联动

- 插件 `manifest.json` 的 `networkAccess.allowedDomains` 里必须包含 `http://localhost:8787`。
- 插件端 `plugin/src/ai/client.ts` fetch 本服务。10s 超时;超时或 5xx → UI 提示"AI 不可用,先用纯代码 Analyze"。
- 未启动 ai-proxy 时,插件的"AI 建议"按钮会立即失败,并提示用户 `cd ai-proxy && bash run.sh`。

## 安全边界

- `.env` 在 `.gitignore` 里,凭证不会进仓库。
- 服务只监听 `127.0.0.1`,不接受外部访问。
- **不要**把这个服务部署到公网——PETA 凭证是个人账号绑定,泄露风险高。真正生产化时应做服务化 + 网关鉴权。
