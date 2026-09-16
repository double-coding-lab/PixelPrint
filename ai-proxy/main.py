"""
Figma 插件 <-> PETA 之间的本地中转服务。

架构:两跳
1) POST {PETA_AUTH_URL}/api-key/querykey → 拿 apikey + endpoint(有缓存,默认 TTL 30min)
2) POST {endpoint}/v1/chat/completions → 拿 completion(OpenAI 兼容,支持 multimodal)

启动:
  cd ai-proxy
  cp .env.example .env  # 填 PETA_APP_ID / PETA_KEY_NAME / (生产)PETA_HERALD_TOKEN
  bash run.sh

接口:
  GET  /health                          健康检查
  POST /analyze                         分析入口,body 见 AnalyzeRequest

参考:https://trip.larkenterprise.com/wiki/ATBlwMLxAium0VkLQH2cTyNOnSh
"""
from __future__ import annotations

import base64
import os
import socket
import time
from typing import Any, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# 鉴权地址:UAT 可选,生产必须显式指向 pro
# PRO: http://peta.auth.ctripcorp.com
# UAT: http://peta.auth.uat.qa.nt.ctripcorp.com
PETA_AUTH_URL = os.getenv("PETA_AUTH_URL", "").strip().rstrip("/")
PETA_APP_ID = os.getenv("PETA_APP_ID", "").strip()
PETA_KEY_NAME = os.getenv("PETA_KEY_NAME", "").strip()
PETA_HERALD_TOKEN = os.getenv("PETA_HERALD_TOKEN", "").strip()
PETA_HOST_IP = os.getenv("PETA_HOST_IP", "").strip()
DEFAULT_MODEL = os.getenv("PETA_DEFAULT_MODEL", "gpt-6-astra").strip()

# apikey/endpoint 缓存(避免每次调都跑一次 querykey)
_APIKEY_CACHE: dict[str, Any] = {"apikey": None, "endpoint": None, "expires_at": 0.0}
_APIKEY_TTL_SEC = 30 * 60  # 30 分钟

app = FastAPI(title="pp-d2c AI proxy", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class TreeNodeLite(BaseModel):
    id: str
    name: str
    type: str
    depth: int
    parentId: Optional[str] = None
    existingPrefix: Optional[str] = None


class AnalyzeRequest(BaseModel):
    scope: str  # 'page' | 'selection'
    tree: List[TreeNodeLite]
    imageBase64: Optional[str] = None
    capability: str = "all"  # 'all' | 'bg_vs_bgc' | 'visual_group'
    model: Optional[str] = None


class AiSuggestion(BaseModel):
    """回给插件的一条建议。字段与 plugin/src/types.ts 的 Suggestion 对齐。"""

    nodeIds: List[str]
    action: str  # 'tag' | 'merge' | 'delete'
    suggestedPrefix: Optional[str] = None
    reason: str
    confidence: float


class AnalyzeResponse(BaseModel):
    suggestions: List[AiSuggestion]
    model: str
    degraded: bool = False
    message: Optional[str] = None


def _is_prod_auth(url: str) -> bool:
    return "uat" not in url.lower()


def _has_min_config() -> bool:
    if not (PETA_AUTH_URL and PETA_APP_ID and PETA_KEY_NAME):
        return False
    # 生产环境要求 heraIdToken
    if _is_prod_auth(PETA_AUTH_URL) and not PETA_HERALD_TOKEN:
        return False
    return True


def _detect_host_ip() -> str:
    """猜本机 IP;querykey 的 ip 字段是 PETA 侧记录来源用的,不用精确。"""
    if PETA_HOST_IP:
        return PETA_HOST_IP
    try:
        # 用一个 UDP dry-connect 拿到出网 IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 53))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


async def _fetch_apikey_endpoint() -> tuple[str, str]:
    """querykey → (apikey, endpoint),命中缓存直接返。"""
    now = time.time()
    cached = _APIKEY_CACHE
    if cached["apikey"] and cached["endpoint"] and cached["expires_at"] > now:
        return cached["apikey"], cached["endpoint"]

    payload = {
        "ip": _detect_host_ip(),
        "heraIdToken": PETA_HERALD_TOKEN,
        "appId": PETA_APP_ID,
        "keyName": PETA_KEY_NAME,
    }
    url = f"{PETA_AUTH_URL}/api-key/querykey"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=payload)
    if r.status_code != 200:
        raise RuntimeError(
            f"PETA querykey HTTP {r.status_code}: {r.text[:300]}"
        )
    try:
        data = r.json()
    except Exception as exc:
        raise RuntimeError(f"PETA querykey 返回非 JSON: {r.text[:300]}") from exc

    apikey = data.get("apikey") or data.get("apiKey") or data.get("data", {}).get("apikey")
    endpoint = data.get("endpoint") or data.get("data", {}).get("endpoint")
    if not apikey or not endpoint:
        raise RuntimeError(f"PETA querykey 响应缺 apikey/endpoint: {data}")

    _APIKEY_CACHE.update(
        {"apikey": apikey, "endpoint": endpoint.rstrip("/"), "expires_at": now + _APIKEY_TTL_SEC}
    )
    return apikey, endpoint.rstrip("/")


def _build_prompt(req: AnalyzeRequest) -> str:
    """拼 system + user 之外的知识背景。"""
    lines: List[str] = []
    lines.append(
        "你是 Figma 设计稿分析助手。基于图层树 + 截图,为 pp-d2c 出打标建议。"
    )
    lines.append("")
    lines.append("pp-d2c 前缀协议(基础前缀,单选):")
    lines.append("- sub-: 独立子组件")
    lines.append("- img-: 整块图片,内部不拆")
    lines.append("- bg-: 背景图(单独一张图,无内容压在上面)")
    lines.append("- bgc-: 父级背景与装饰(纯 CSS 可画,通常和内容压在一起)")
    lines.append("- btn-: 可点击容器")
    lines.append("- input-: 输入框")
    lines.append("- scrollx- / scrolly-: 横/纵向滚动容器")
    lines.append("- x-: 完全忽略(不生成 DOM)")
    lines.append("")
    if req.capability in ("all", "bg_vs_bgc"):
        lines.append("能力 A(bg/bgc 消歧):判某个 frame 应打 bg- 还是 bgc-。")
    if req.capability in ("all", "visual_group"):
        lines.append(
            "能力 B(视觉分组):找视觉贴在一起但图层没成组的多个节点,建议 merge + img-/sub-。"
        )
    lines.append("")
    lines.append("图层树(depth 缩进):")
    for n in req.tree[:400]:
        indent = "  " * n.depth
        p = f" [{n.existingPrefix}]" if n.existingPrefix else ""
        lines.append(f"{indent}- {n.type} {n.id} {n.name!r}{p}")
    if len(req.tree) > 400:
        lines.append(f"... (省略 {len(req.tree) - 400} 个节点)")
    lines.append("")
    lines.append(
        '严格只输出如下 JSON,不要额外文字或 markdown 代码块:'
        '{"suggestions":[{"nodeIds":["..."],"action":"tag"|"merge",'
        '"suggestedPrefix":"img-"|"bg-"|...,"reason":"...","confidence":0.0..1.0}]}'
    )
    return "\n".join(lines)


async def _call_peta_chat(prompt: str, image_b64: Optional[str], model: str) -> str:
    """调 {endpoint}/v1/chat/completions,返回 assistant content。"""
    apikey, endpoint = await _fetch_apikey_endpoint()

    user_content: List[dict] = [{"type": "text", "text": prompt}]
    if image_b64:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{image_b64}"},
            }
        )

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": user_content},
        ],
        "stream": False,
        "temperature": 0.1,
        "top_p": 1,
    }
    url = f"{endpoint}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {apikey}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body)
    if r.status_code != 200:
        raise RuntimeError(f"PETA chat HTTP {r.status_code}: {r.text[:500]}")
    try:
        data = r.json()
    except Exception as exc:
        raise RuntimeError(f"PETA chat 返回非 JSON: {r.text[:500]}") from exc
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"PETA chat 响应结构异常: {data}") from exc


def _parse_suggestions(text: str) -> List[AiSuggestion]:
    """尽力从 LLM 输出里抠出 suggestions JSON。"""
    import json
    import re

    # 去掉可能的 ```json ... ``` 包裹
    stripped = text.strip()
    m_block = re.match(r"^```(?:json)?\s*(.+?)\s*```$", stripped, re.S)
    if m_block:
        stripped = m_block.group(1)

    m = re.search(r"\{[\s\S]*\"suggestions\"[\s\S]*\}", stripped)
    if not m:
        return []
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return []
    raw = data.get("suggestions") or []
    out: List[AiSuggestion] = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        node_ids = s.get("nodeIds") or []
        if not node_ids:
            continue
        try:
            out.append(
                AiSuggestion(
                    nodeIds=[str(x) for x in node_ids],
                    action=str(s.get("action", "tag")),
                    suggestedPrefix=s.get("suggestedPrefix"),
                    reason=str(s.get("reason", "")),
                    confidence=float(s.get("confidence", 0.6)),
                )
            )
        except (ValueError, TypeError):
            continue
    return out


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "hasMinConfig": _has_min_config(),
        "authUrl": PETA_AUTH_URL or "(未配置)",
        "authEnv": "prod" if _is_prod_auth(PETA_AUTH_URL) else "uat",
        "defaultModel": DEFAULT_MODEL,
        "cachedApiKey": bool(_APIKEY_CACHE["apikey"]),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    if not _has_min_config():
        missing: List[str] = []
        if not PETA_AUTH_URL:
            missing.append("PETA_AUTH_URL")
        if not PETA_APP_ID:
            missing.append("PETA_APP_ID")
        if not PETA_KEY_NAME:
            missing.append("PETA_KEY_NAME")
        if _is_prod_auth(PETA_AUTH_URL) and not PETA_HERALD_TOKEN:
            missing.append("PETA_HERALD_TOKEN(生产必填)")
        return AnalyzeResponse(
            suggestions=[],
            model=req.model or DEFAULT_MODEL,
            degraded=True,
            message=f"ai-proxy 缺配置: {', '.join(missing)}。请在 ai-proxy/.env 填好后重启。",
        )

    if req.imageBase64:
        try:
            base64.b64decode(req.imageBase64[:512], validate=True)
        except Exception as exc:
            raise HTTPException(400, f"imageBase64 不是合法 base64: {exc}")

    model = req.model or DEFAULT_MODEL
    prompt = _build_prompt(req)
    try:
        raw = await _call_peta_chat(prompt, req.imageBase64, model)
    except Exception as exc:
        return AnalyzeResponse(
            suggestions=[],
            model=model,
            degraded=True,
            message=f"PETA 调用失败:{exc}",
        )
    return AnalyzeResponse(
        suggestions=_parse_suggestions(raw),
        model=model,
        degraded=False,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8787, reload=True)
